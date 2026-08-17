import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER_RE = /(bearer\s+)[A-Za-z0-9._\-+=/]+/gi;
const PHONE_RE = /(?:\+?\d[\d\-\s()]{9,}\d)/g;
const SECRET_KEYS = new Set([
  "authorization",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "token",
  "jwt",
  "phone",
  "phonenumber",
  "password",
  "code",
  "otp",
]);

let logFile = null;

export function redactText(value) {
  if (!value) return value;
  return String(value)
    .replace(JWT_RE, "[REDACTED_JWT]")
    .replace(BEARER_RE, "$1[REDACTED]")
    .replace(PHONE_RE, "[REDACTED_PHONE]");
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[-_]/g, "");
}

export function redactObj(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactObj);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEYS.has(key.toLowerCase()) || SECRET_KEYS.has(normalizeKey(key))) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactObj(item);
      }
    }
    return out;
  }
  return value;
}

export function setupLogging(filePath) {
  logFile = filePath || null;
  if (logFile) mkdirSync(path.dirname(logFile), { recursive: true });
}

function write(level, args) {
  const line = redactText(`${new Date().toISOString()} ${level} ${args.map(String).join(" ")}`);
  console.error(line);
  if (logFile) appendFileSync(logFile, `${line}\n`, "utf8");
}

export const logger = {
  info: (...args) => write("INFO", args),
  warn: (...args) => write("WARN", args),
  error: (...args) => write("ERROR", args),
};
