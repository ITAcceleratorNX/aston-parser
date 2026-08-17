import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultPeriod, iterChunks, splitChunk } from "../src/chunking.js";

test("iterChunks is inclusive", () => {
  assert.deepEqual(iterChunks("2026-08-01", "2026-08-10", 3), [
    ["2026-08-01", "2026-08-03"],
    ["2026-08-04", "2026-08-06"],
    ["2026-08-07", "2026-08-09"],
    ["2026-08-10", "2026-08-10"],
  ]);
});

test("splitChunk halves the range", () => {
  assert.deepEqual(splitChunk(["2026-08-01", "2026-08-04"]), [
    ["2026-08-01", "2026-08-02"],
    ["2026-08-03", "2026-08-04"],
  ]);
  assert.deepEqual(splitChunk(["2026-08-01", "2026-08-01"]), [["2026-08-01", "2026-08-01"]]);
});

test("defaultPeriod is inclusive of today", () => {
  assert.deepEqual(defaultPeriod(7, "2026-08-12"), ["2026-08-06", "2026-08-12"]);
});
