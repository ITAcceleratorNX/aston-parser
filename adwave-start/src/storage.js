import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { LEAD_LIKE_ENTITIES, METRIC_ENTITIES } from "./endpoints.js";

export function recordId(row) {
  for (const key of ["_id", "id", "leadId", "dealId", "adId", "adSetId", "campaignId", "projectId"]) {
    if (row[key] != null && row[key] !== "") return String(row[key]);
  }
  return createHash("sha1").update(JSON.stringify(row, Object.keys(row).sort())).digest("hex");
}

export function storageKey(row, entity, dateFrom, dateTo) {
  const rid = recordId(row);
  if (METRIC_ENTITIES.has(entity)) return `${rid}:${dateFrom || ""}:${dateTo || ""}`;
  return rid;
}

function looksLikeIdMap(value) {
  const sample = Object.values(value)[0];
  return Boolean(sample) && typeof sample === "object" && !Array.isArray(sample);
}

export function extractRows(entity, payload) {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload.filter((item) => item && typeof item === "object");
  if (typeof payload !== "object") return [];
  if (entity === "profile" || entity === "workspace") return [payload];

  let candidates = [];
  if (LEAD_LIKE_ENTITIES.has(entity)) {
    candidates = payload.leads || payload.insights || payload.data || [];
  } else if (entity === "projects") {
    candidates = payload.data || payload.projects || payload;
    if (candidates && typeof candidates === "object" && !Array.isArray(candidates)) {
      candidates = looksLikeIdMap(candidates) ? Object.values(candidates) : [];
    }
  } else if (entity === "workspaces") {
    candidates = payload.data || payload.workspaces || payload;
  } else {
    candidates = payload.insights || payload.data || [];
  }

  if (!Array.isArray(candidates)) return [];
  let rows = candidates.filter((item) => item && typeof item === "object");
  if (METRIC_ENTITIES.has(entity)) rows = rows.filter((row) => String(row._id || "") !== "total");
  return rows;
}

export class Store {
  constructor(outputDir) {
    this.outputDir = outputDir;
    mkdirSync(outputDir, { recursive: true });
    this.dbPath = path.join(outputDir, "adwave.sqlite");
    this.db = new DatabaseSync(this.dbPath);
    this.initDb();
  }

  initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        entity TEXT NOT NULL,
        record_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        period_from TEXT,
        period_to TEXT,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (entity, record_id, workspace_id)
      );
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        period_from TEXT,
        period_to TEXT,
        entity TEXT,
        record_count INTEGER,
        status TEXT NOT NULL,
        error TEXT,
        chunk_count INTEGER
      );
    `);
  }

  upsertRows(entity, workspaceId, rows, dateFrom = null, dateTo = null) {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    const now = new Date().toISOString();
    const select = this.db.prepare(
      "SELECT payload_json FROM records WHERE entity=? AND record_id=? AND workspace_id=?",
    );
    const upsert = this.db.prepare(`
      INSERT INTO records(entity, record_id, workspace_id, period_from, period_to, payload_json, updated_at)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(entity, record_id, workspace_id) DO UPDATE SET
        period_from=excluded.period_from,
        period_to=excluded.period_to,
        payload_json=excluded.payload_json,
        updated_at=excluded.updated_at
    `);

    for (const row of rows) {
      const rowFrom = row._period_from || dateFrom || null;
      const rowTo = row._period_to || dateTo || null;
      const key = storageKey(row, entity, rowFrom, rowTo);
      const payload = JSON.stringify(row);
      const existing = select.get(entity, key, workspaceId);
      upsert.run(entity, key, workspaceId, dateFrom, dateTo, payload, now);
      if (!existing) inserted += 1;
      else if (existing.payload_json !== payload) updated += 1;
      else unchanged += 1;
    }
    return { inserted, updated, unchanged };
  }

  countDuplicatesIn(rows, entity, dateFrom, dateTo) {
    const seen = new Set();
    let dupes = 0;
    for (const row of rows) {
      const key = storageKey(row, entity, dateFrom, dateTo);
      if (seen.has(key)) dupes += 1;
      else seen.add(key);
    }
    return dupes;
  }

  exportSnapshot(runDir, entity, payload, rows, exportFormat) {
    mkdirSync(runDir, { recursive: true });
    const written = [];
    if (exportFormat === "json" || exportFormat === "both") {
      const file = path.join(runDir, `${entity}.json`);
      writeFileSync(
        file,
        JSON.stringify({ entity, row_count: rows.length, payload, rows }, null, 2),
        "utf8",
      );
      written.push(file);
    }
    if (exportFormat === "csv" || exportFormat === "both") {
      const file = path.join(runDir, `${entity}.csv`);
      writeCsv(file, rows);
      written.push(file);
    }
    return written;
  }

  close() {
    this.db.close();
  }
}

function csvValue(value) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function writeCsv(file, rows) {
  if (!rows.length) {
    writeFileSync(file, "", "utf8");
    return;
  }
  const fieldnames = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        fieldnames.push(key);
      }
    }
  }
  const escape = (value) => {
    const text = csvValue(value);
    if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };
  const lines = [fieldnames.join(",")];
  for (const row of rows) {
    lines.push(fieldnames.map((key) => escape(row[key])).join(","));
  }
  writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
}
