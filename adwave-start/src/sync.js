import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AuthError, TokenStore, refreshTokens, secondsUntilExpiry } from "./auth.js";
import { AdwaveApiError, AdwaveClient } from "./client.js";
import { defaultPeriod, formatChunk, iterChunks, parseDate, splitChunk, todayIso } from "./chunking.js";
import { ENTITIES, LEAD_LIKE_ENTITIES, METRIC_ENTITIES, fillPath, resolveEntities } from "./endpoints.js";
import { Journal } from "./journal.js";
import { logger } from "./logging.js";
import { FailureTracker, maybeNotify } from "./notify.js";
import { Store, extractRows, storageKey } from "./storage.js";

export class SyncRunner {
  constructor(settings) {
    this.settings = settings;
    this.storeTokens = new TokenStore(settings);
    this.store = new Store(settings.outputDir);
    this.journal = new Journal(settings.outputDir);
    this.failures = new FailureTracker(settings.outputDir);
  }

  async probe() {
    const result = {
      auth: this.storeTokens.accessStatus(),
      refresh: null,
      checks: [],
    };
    if (!this.storeTokens.hasAccess() && !this.storeTokens.hasRefresh()) {
      result.status = "needs_login";
      result.message = "No tokens. Run: npm run login";
      return result;
    }

    const ttl = this.storeTokens.accessToken ? secondsUntilExpiry(this.storeTokens.accessToken) : null;
    if (this.storeTokens.hasRefresh() && (ttl == null || ttl < 60)) {
      try {
        result.refresh = await refreshTokens(this.settings, this.storeTokens);
      } catch (error) {
        result.refresh = { ok: false, error: error.message };
        result.status = "refresh_failed";
        return result;
      }
    }

    const client = new AdwaveClient(this.settings, this.storeTokens);
    const today = todayIso();
    const access = await this.inspectWorkspaceAccess(client);
    result.workspace_access = access;
    const checks = [
      ["profile", "GET", "user/profile", null, undefined],
      ["workspaces", "GET", "workspaces", null, undefined],
      ["workspace", "GET", `workspaces/${this.settings.workspaceId}`, null, undefined],
      ["projects", "GET", `workspaces/${this.settings.workspaceId}/projects`, null, undefined],
      [
        "metrics",
        "POST",
        `workspaces/${this.settings.workspaceId}/dashboards/byProjects`,
        { from: today, to: today },
        {},
      ],
    ];

    for (const [name, method, pathName, params, body] of checks) {
      const item = { name, method, path: pathName, params };
      try {
        const payload = await client.request(method, pathName, { params, jsonBody: body });
        const rows = extractRows(name, payload);
        item.ok = true;
        item.status_code = 200;
        item.row_count = rows.length;
        item.top_level_keys = payload && typeof payload === "object" && !Array.isArray(payload)
          ? Object.keys(payload).sort()
          : typeof payload;
      } catch (error) {
        item.ok = false;
        item.status_code = error.statusCode || null;
        item.error = error.message;
      }
      result.checks.push(item);
    }

    result.status = result.checks.every((item) => item.ok) ? "ok" : "partial";
    if (access.message) result.message = access.message;
    return result;
  }

  async sync({ dateFrom = null, dateTo = null, entities = null, chunkDays = null } = {}) {
    const started = new Date();
    let start = dateFrom ? parseDate(dateFrom) : null;
    let end = dateTo ? parseDate(dateTo) : null;
    if (!start || !end) {
      const [defaultStart, defaultEnd] = defaultPeriod(this.settings.defaultDays);
      start = start || defaultStart;
      end = end || defaultEnd;
    }
    const selected = resolveEntities(entities);
    const chunkSize = chunkDays || this.settings.chunkDays;
    const runId = started.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const runDir = path.join(this.settings.outputDir, "runs", runId);
    mkdirSync(runDir, { recursive: true });

    const summary = {
      run_id: runId,
      started_at: started.toISOString(),
      period: { from: start, to: end },
      chunk_days: chunkSize,
      workspace_id: this.settings.workspaceId,
      entities: {},
      status: "ok",
      errors: [],
    };

    try {
      await this.ensureAuth();
      const client = new AdwaveClient(this.settings, this.storeTokens);
      const access = await this.inspectWorkspaceAccess(client);
      summary.workspace_access = access;
      if (!access.ok) {
        throw new AdwaveApiError(access.message, { statusCode: access.status_code || 403 });
      }
      for (const name of selected) {
        const spec = ENTITIES[name];
        const entityResult = await this.syncEntity(client, spec, start, end, chunkSize, runDir);
        summary.entities[name] = entityResult;
        this.journal.append({
          event: "entity_sync",
          run_id: runId,
          entity: name,
          period_from: start,
          period_to: end,
          record_count: entityResult.row_count,
          status: entityResult.status,
          error: entityResult.error || null,
          chunk_count: entityResult.chunk_count,
        });
        if (entityResult.status !== "ok") {
          summary.errors.push({ entity: name, error: entityResult.error });
        }
      }
    } catch (error) {
      if (error instanceof AuthError || error instanceof AdwaveApiError) {
        summary.status = "failed";
        summary.errors.push({ entity: "*", error: error.message });
        logger.error(`Sync aborted: ${error.message}`);
      } else {
        throw error;
      }
    }

    if (summary.errors.length && summary.status === "ok") summary.status = "partial";
    const anyOk = Object.values(summary.entities).some((item) => item.status === "ok");
    if (summary.errors.length && !anyOk) summary.status = "failed";

    summary.finished_at = new Date().toISOString();
    writeFileSync(path.join(runDir, "manifest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    this.journal.append({
      event: "run",
      run_id: runId,
      period_from: start,
      period_to: end,
      entities: selected,
      status: summary.status,
      error: summary.errors.map((item) => item.error).filter(Boolean).join("; ") || null,
    });

    if (summary.status === "ok") {
      this.failures.recordSuccess();
    } else {
      const state = this.failures.recordFailure(summary.errors.map((item) => item.error || "").join("; "));
      await maybeNotify(this.settings.notifyWebhook, this.settings.notifyAfterFailures, this.failures, {
        run_id: runId,
        status: summary.status,
        state,
      });
    }
    return summary;
  }

  async stabilityTest({ runs = 3, days = null, entities = "sprint1" } = {}) {
    const [start, end] = defaultPeriod(days || Math.min(3, this.settings.defaultDays));
    const results = [];
    const signatures = {};
    for (let index = 1; index <= runs; index += 1) {
      logger.info(`Stability run ${index}/${runs}`);
      const summary = await this.sync({ dateFrom: start, dateTo: end, entities });
      results.push({
        run_id: summary.run_id,
        status: summary.status,
        entities: Object.fromEntries(
          Object.entries(summary.entities || {}).map(([name, item]) => [
            name,
            {
              row_count: item.row_count,
              duplicates_in_response: item.duplicates_in_response,
              schema_keys: item.schema_keys,
              status: item.status,
            },
          ]),
        ),
        errors: summary.errors,
      });
      for (const [name, item] of Object.entries(summary.entities || {})) {
        signatures[name] ??= [];
        signatures[name].push({ row_count: item.row_count, schema_keys: item.schema_keys });
      }
    }

    const comparison = {};
    for (const [name, items] of Object.entries(signatures)) {
      const counts = items.map((item) => item.row_count);
      const schemas = items.map((item) => JSON.stringify(item.schema_keys || []));
      comparison[name] = {
        row_counts: counts,
        row_count_stable: new Set(counts).size <= 1,
        schema_stable: new Set(schemas).size <= 1,
        needs_otp: false,
      };
    }

    return {
      period: { from: start, to: end },
      runs: results,
      comparison,
      refresh_required_otp: false,
      overall_status: results.every((run) => run.status === "ok") ? "ok" : "failed",
    };
  }

  async inspectWorkspaceAccess(client) {
    const configuredId = this.settings.workspaceId;
    let available = [];
    try {
      available = extractRows("workspaces", await client.get("workspaces"));
    } catch (error) {
      return {
        ok: false,
        configured_workspace_id: configuredId,
        available_workspace_ids: [],
        status_code: error.statusCode || null,
        message: `Cannot list workspaces: ${error.message}`,
      };
    }

    const availableIds = available.map((row) => row._id || row.id).filter(Boolean);
    if (availableIds.includes(configuredId)) {
      return { ok: true, configured_workspace_id: configuredId, available_workspace_ids: availableIds };
    }

    try {
      await client.get(`workspaces/${configuredId}`);
      return { ok: true, configured_workspace_id: configuredId, available_workspace_ids: availableIds };
    } catch (error) {
      if (error.statusCode !== 403 && error.statusCode !== 404) {
        return {
          ok: false,
          configured_workspace_id: configuredId,
          available_workspace_ids: availableIds,
          status_code: error.statusCode || null,
          message: error.message,
        };
      }
    }

    if (availableIds.length === 1) {
      logger.warn(`Workspace ${configuredId} is forbidden; switching to ${availableIds[0]}`);
      this.settings.workspaceId = availableIds[0];
      return {
        ok: true,
        configured_workspace_id: configuredId,
        using_workspace_id: availableIds[0],
        available_workspace_ids: availableIds,
        switched: true,
      };
    }

    if (availableIds.length > 1) {
      return {
        ok: false,
        configured_workspace_id: configuredId,
        available_workspace_ids: availableIds,
        status_code: 403,
        message:
          `Workspace ${configuredId} is forbidden. This account can access: ${availableIds.join(", ")}. Set ADWAVE_WORKSPACE_ID to one of them.`,
      };
    }

    return {
      ok: false,
      configured_workspace_id: configuredId,
      available_workspace_ids: [],
      status_code: 403,
      message:
        `Workspace ${configuredId} is forbidden, and GET /workspaces returned []. This login has no workspace membership. Use the Adwave account from the TZ (workspace owner) or invite this user into that workspace.`,
    };
  }

  async ensureAuth() {
    if (!this.storeTokens.hasAccess() && !this.storeTokens.hasRefresh()) {
      throw new AuthError("No tokens found. Run npm run login");
    }
    const ttl = this.storeTokens.accessToken ? secondsUntilExpiry(this.storeTokens.accessToken) : null;
    if (!this.storeTokens.hasAccess() || (ttl != null && ttl < 30)) {
      await refreshTokens(this.settings, this.storeTokens);
    }
  }

  async syncEntity(client, spec, start, end, chunkDays, runDir) {
    const entityPath = fillPath(spec.path, this.settings.workspaceId);
    if (spec.kind === "get") {
      try {
        const payload = await client.get(entityPath);
        const rows = extractRows(spec.name, payload);
        const dupes = this.store.countDuplicatesIn(rows, spec.name, null, null);
        const stats = this.store.upsertRows(spec.name, this.settings.workspaceId, rows);
        const files = this.store.exportSnapshot(runDir, spec.name, payload, rows, this.settings.exportFormat);
        return {
          status: "ok",
          row_count: rows.length,
          duplicates_in_response: dupes,
          upsert: stats,
          chunk_count: 0,
          files,
          schema_keys: schemaKeys(rows),
        };
      } catch (error) {
        return { status: "failed", error: error.message, row_count: 0, chunk_count: 0 };
      }
    }

    const queue = iterChunks(start, end, chunkDays);
    const allRows = [];
    const chunkReports = [];
    const mergedPayload = { chunks: [] };
    let failed = false;
    let lastError = null;

    while (queue.length) {
      const chunk = queue.shift();
      const params = formatChunk(chunk);
      try {
        const payload = await client.post(entityPath, {}, params);
        const rows = extractRows(spec.name, payload);
        if (LEAD_LIKE_ENTITIES.has(spec.name) || METRIC_ENTITIES.has(spec.name)) {
          for (const row of rows) {
            row._period_from ??= params.from;
            row._period_to ??= params.to;
          }
        }
        allRows.push(...rows);
        mergedPayload.chunks.push({ params, row_count: rows.length, payload });
        chunkReports.push({ params, status: "ok", row_count: rows.length });
      } catch (error) {
        if (error.retryable && chunk[0] !== chunk[1]) {
          logger.warn(`Timeout/retryable error on ${spec.name} ${JSON.stringify(params)}, splitting chunk`);
          queue.unshift(...splitChunk(chunk));
          continue;
        }
        failed = true;
        lastError = error.message;
        chunkReports.push({ params, status: "failed", error: error.message });
      }
    }

    const deduped = dedupeRows(allRows, spec.name);
    const stats = this.store.upsertRows(spec.name, this.settings.workspaceId, deduped, start, end);
    const files = this.store.exportSnapshot(
      runDir,
      spec.name,
      mergedPayload,
      deduped,
      this.settings.exportFormat,
    );
    return {
      status: failed && !deduped.length ? "failed" : failed ? "partial" : "ok",
      row_count: deduped.length,
      duplicates_in_response: allRows.length - deduped.length,
      upsert: stats,
      chunk_count: chunkReports.length,
      chunks: chunkReports,
      files,
      schema_keys: schemaKeys(deduped),
      error: lastError,
    };
  }
}

function schemaKeys(rows) {
  const keys = new Set();
  for (const row of rows.slice(0, 50)) {
    for (const key of Object.keys(row)) keys.add(String(key));
  }
  return [...keys].sort();
}

function dedupeRows(rows, entity) {
  const seen = new Map();
  const order = [];
  for (const row of rows) {
    const key = storageKey(row, entity, row._period_from, row._period_to);
    if (!seen.has(key)) order.push(key);
    seen.set(key, row);
  }
  return order.map((key) => seen.get(key));
}
