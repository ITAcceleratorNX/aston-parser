import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { redactObj } from "./logging.js";

export class Journal {
  constructor(outputDir) {
    this.path = path.join(outputDir, "journal.jsonl");
    mkdirSync(outputDir, { recursive: true });
  }

  append(event) {
    const record = { ts: new Date().toISOString(), ...redactObj(event) };
    appendFileSync(this.path, `${JSON.stringify(record)}\n`, "utf8");
    return record;
  }

  recent(limit = 20) {
    if (!existsSync(this.path)) return [];
    return readFileSync(this.path, "utf8")
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  }
}
