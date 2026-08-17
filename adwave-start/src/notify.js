import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { logger, redactObj } from "./logging.js";

export class FailureTracker {
  constructor(outputDir) {
    this.path = path.join(outputDir, "failure_state.json");
    mkdirSync(outputDir, { recursive: true });
  }

  load() {
    if (!existsSync(this.path)) return { consecutive_failures: 0, notified_at: null };
    try {
      return JSON.parse(readFileSync(this.path, "utf8"));
    } catch {
      return { consecutive_failures: 0, notified_at: null };
    }
  }

  save(state) {
    writeFileSync(this.path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return state;
  }

  recordSuccess() {
    return this.save({ consecutive_failures: 0, notified_at: null, updated_at: new Date().toISOString() });
  }

  recordFailure(error) {
    const state = this.load();
    state.consecutive_failures = Number(state.consecutive_failures || 0) + 1;
    state.last_error = error;
    state.updated_at = new Date().toISOString();
    return this.save(state);
  }

  markNotified(state) {
    state.notified_at = new Date().toISOString();
    return this.save(state);
  }
}

export async function maybeNotify(webhook, threshold, tracker, payload) {
  if (!webhook || threshold <= 0) return false;
  const state = tracker.load();
  const failures = Number(state.consecutive_failures || 0);
  if (failures < threshold || state.notified_at) return false;
  const body = redactObj({
    title: "Adwave parser repeated failure",
    consecutive_failures: failures,
    payload,
  });
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    tracker.markNotified(state);
    logger.info(`Failure notification sent after ${failures} consecutive errors`);
    return true;
  } catch {
    logger.warn("Failed to send notification webhook");
    return false;
  }
}
