import { chmodSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export function atomicWrite(filePath, payload, mode = 0o600) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = path.join(path.dirname(filePath), `.tmp-${randomBytes(8).toString("hex")}`);
  try {
    writeFileSync(tmp, payload, { encoding: "utf8", mode });
    chmodSync(tmp, mode);
    renameSync(tmp, filePath);
    chmodSync(filePath, mode);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}

export function upsertEnvValue(text, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.endsWith("\n") || !text ? text : `${text}\n`}${line}\n`;
}
