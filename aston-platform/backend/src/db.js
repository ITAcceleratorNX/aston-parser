import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "..");

const bundledDb = path.join(BACKEND_ROOT, "data/adwave.sqlite");
const bundledNames = path.join(BACKEND_ROOT, "data/names.json");

const DB_PATH = path.resolve(
  BACKEND_ROOT,
  process.env.ADWAVE_DB_PATH || (existsSync(bundledDb) ? "data/adwave.sqlite" : "../../adwave-start/data/adwave.sqlite"),
);

const RUNS_DIR = path.resolve(
  BACKEND_ROOT,
  process.env.ADWAVE_RUNS_DIR || "../../adwave-start/data/runs",
);

const db = new DatabaseSync(DB_PATH);

export function parsePayload(row) {
  return typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
}

export function getProjects() {
  const rows = db.prepare("SELECT payload_json FROM records WHERE entity = 'projects'").all();
  return rows.map(parsePayload);
}

export function getMetricInsights(entity = "metrics") {
  const rows = db
    .prepare(
      `SELECT payload_json, period_from, period_to
       FROM records
       WHERE entity = ?`,
    )
    .all(entity);

  return rows.map((row) => {
    const payload = parsePayload(row);
    return {
      ...payload,
      _period_from: payload._period_from || row.period_from,
      _period_to: payload._period_to || row.period_to,
    };
  });
}

export function entityForLevel(level) {
  if (level === "campaigns") return "campaigns";
  if (level === "adsets") return "adsets";
  if (level === "ads") return "ads";
  return "metrics";
}

/** Load entity name dictionaries from the newest dashboard JSON runs. */
export function loadNameMaps() {
  const maps = {
    projects: {},
    accounts: {},
    campaigns: {},
    adSets: {},
    ads: {},
  };

  for (const project of getProjects()) {
    if (project?._id) maps.projects[project._id] = project.name || project._id;
  }

  if (existsSync(bundledNames)) {
    try {
      const saved = JSON.parse(readFileSync(bundledNames, "utf8"));
      for (const key of Object.keys(maps)) {
        Object.assign(maps[key], saved[key] || {});
      }
    } catch {
      // ignore broken names file
    }
  }

  if (!existsSync(RUNS_DIR)) return maps;

  const runs = readdirSync(RUNS_DIR)
    .filter((name) => existsSync(path.join(RUNS_DIR, name)))
    .sort()
    .reverse();

  const files = ["metrics.json", "campaigns.json", "adsets.json", "ads.json"];

  for (const runId of runs) {
    for (const file of files) {
      const full = path.join(RUNS_DIR, runId, file);
      if (!existsSync(full)) continue;
      try {
        const raw = JSON.parse(readFileSync(full, "utf8"));
        const chunks = raw?.payload?.chunks || [];
        const payloads = chunks.length ? chunks.map((chunk) => chunk?.payload || {}) : [raw?.payload || {}];
        for (const payload of payloads) {
          mergeIdMap(maps.projects, payload.projects, (item) => item.name);
          mergeIdMap(maps.accounts, payload.accounts, (item) => item.name, (item) => item.id || item._id);
          mergeIdMap(maps.campaigns, payload.campaigns, (item) => item.name, (item) => item.id || item._id);
          mergeIdMap(maps.adSets, payload.adSets, (item) => item.name, (item) => item.id || item._id);
          mergeIdMap(maps.ads, payload.ads, (item) => item.name, (item) => item.id || item._id);
        }
      } catch {
        // ignore broken run files
      }
    }
  }

  return maps;
}

function mergeIdMap(target, source, nameFn, idFn = (item) => item._id || item.id) {
  if (!source || typeof source !== "object") return;
  for (const item of Object.values(source)) {
    if (!item || typeof item !== "object") continue;
    const id = idFn(item);
    if (!id) continue;
    target[id] = nameFn(item) || String(id);
  }
}

export function getDbInfo() {
  return { dbPath: DB_PATH, runsDir: RUNS_DIR };
}

export default db;
