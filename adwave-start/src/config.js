import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

function digitsOnly(value = "") {
  return String(value).replace(/\D/g, "");
}

function asPath(name, fallback) {
  const raw = process.env[name] || fallback;
  return path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
}

function asInt(name, fallback) {
  const raw = process.env[name];
  return raw ? Number.parseInt(raw, 10) : fallback;
}

export function loadSettings() {
  const envFile = path.join(ROOT, ".env");
  if (existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }

  const baseUrl = `${(process.env.ADWAVE_BASE_URL || "https://dash.adwave.guru/api/").replace(/\/+$/, "")}/`;

  return {
    baseUrl,
    workspaceId: process.env.ADWAVE_WORKSPACE_ID || "69916ea2430b6f31d9cb0d8a",
    phone: digitsOnly(process.env.ADWAVE_PHONE || ""),
    accessToken: (process.env.ADWAVE_ACCESS_TOKEN || "").trim(),
    refreshToken: (process.env.ADWAVE_REFRESH_TOKEN || "").trim(),
    tokenFile: asPath("ADWAVE_TOKEN_FILE", ".secrets/tokens.json"),
    envFile,
    outputDir: asPath("ADWAVE_OUTPUT_DIR", "data"),
    logDir: asPath("ADWAVE_LOG_DIR", "logs"),
    exportFormat: (process.env.ADWAVE_FORMAT || "both").toLowerCase(),
    chunkDays: asInt("ADWAVE_CHUNK_DAYS", 3),
    requestTimeout: Number(process.env.ADWAVE_REQUEST_TIMEOUT || 90) * 1000,
    maxRetries: asInt("ADWAVE_MAX_RETRIES", 4),
    defaultDays: asInt("ADWAVE_DEFAULT_DAYS", 7),
    notifyWebhook: (process.env.ADWAVE_NOTIFY_WEBHOOK || "").trim(),
    notifyAfterFailures: asInt("ADWAVE_NOTIFY_AFTER_FAILURES", 3),
  };
}
