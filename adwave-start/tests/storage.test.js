import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Store, extractRows, storageKey } from "../src/storage.js";

test("extractRows for leads and metrics", () => {
  const leads = extractRows("leads", { leads: [{ _id: "l1", phone: "700" }], insights: [] });
  assert.equal(leads[0]._id, "l1");
  const metrics = extractRows("metrics", {
    insights: [
      { _id: "p1", spend: 10 },
      { _id: "total", spend: 10 },
    ],
  });
  assert.deepEqual(metrics.map((row) => row._id), ["p1"]);
});

test("upsert deduplicates and updates", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "adwave-"));
  const store = new Store(dir);
  try {
    const first = store.upsertRows("leads", "ws1", [
      { _id: "l1", name: "A" },
      { _id: "l1", name: "A" },
    ]);
    assert.equal(first.inserted, 1);
    const second = store.upsertRows("leads", "ws1", [{ _id: "l1", name: "B" }]);
    assert.equal(second.updated, 1);
    const third = store.upsertRows("leads", "ws1", [{ _id: "l1", name: "B" }]);
    assert.equal(third.unchanged, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("metric keys include period", () => {
  const row = { _id: "p1", spend: 1 };
  assert.notEqual(
    storageKey(row, "metrics", "2026-08-01", "2026-08-03"),
    storageKey(row, "metrics", "2026-08-04", "2026-08-06"),
  );
  assert.equal(
    storageKey(row, "leads", "2026-08-01", "2026-08-03"),
    storageKey(row, "leads", "2026-08-04", "2026-08-06"),
  );
});
