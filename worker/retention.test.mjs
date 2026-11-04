import test from "node:test";
import assert from "node:assert/strict";
import { createRetention, retentionDays } from "./retention.mjs";

const DAY = 86_400_000, NOW = Date.parse("2026-11-10T00:00:00Z");
const iso = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
function library({ originals = [], parts = [], trash = [], failMove = new Set() } = {}) {
  const calls = { moved: [], purged: [] };
  return {
    calls,
    async list() { return { originals, parts, trash }; },
    async move(id) { if (failMove.has(id)) throw new Error("busy"); calls.moved.push(id); return { trashId: `t:${id}` }; },
    async purge(ids) { calls.purged.push(...ids); return { deleted: ids, freedBytes: 10 * ids.length }; },
  };
}

test("only items older than the retention window are deleted", async () => {
  const lib = library({
    originals: [{ id: "old-src", createdAt: iso(4) }, { id: "new-src", createdAt: iso(1) }],
    parts: [{ id: "old-part", createdAt: iso(3.5) }, { id: "new-part", createdAt: iso(2.9) }],
    trash: [{ id: "old-trash", deletedAt: iso(5) }, { id: "new-trash", deletedAt: iso(1) }],
  });
  const result = await createRetention({ mediaLibrary: lib, days: 3, now: () => NOW }).sweep();
  assert.deepEqual(lib.calls.moved, ["old-src", "old-part"]);
  assert.deepEqual(lib.calls.purged.sort(), ["old-trash", "t:old-part", "t:old-src"]);
  assert.equal(result.deleted, 3);
  assert.equal(result.freedBytes, 30);
});

test("busy, editor-open or unmovable items are kept, never forced", async () => {
  const lib = library({
    originals: [
      { id: "busy", createdAt: iso(9), busy: true },
      { id: "open", createdAt: iso(9), inUseByEditor: true },
      { id: "locked", createdAt: iso(9) },
    ],
    failMove: new Set(["locked"]),
  });
  const result = await createRetention({ mediaLibrary: lib, days: 3, now: () => NOW }).sweep();
  assert.deepEqual(lib.calls.moved, []);
  assert.deepEqual(lib.calls.purged, []);
  assert.equal(result.kept, 3);
});

test("zero days disables the policy; env parsing falls back to 3", async () => {
  const lib = library({ originals: [{ id: "x", createdAt: iso(30) }] });
  assert.deepEqual(await createRetention({ mediaLibrary: lib, days: 0, now: () => NOW }).sweep(), { skipped: true });
  assert.equal(lib.calls.moved.length, 0);
  assert.equal(retentionDays({}), 3);
  assert.equal(retentionDays({ SHORTCUT_RETENTION_DAYS: "0" }), 0);
  assert.equal(retentionDays({ SHORTCUT_RETENTION_DAYS: "7" }), 7);
  assert.equal(retentionDays({ SHORTCUT_RETENTION_DAYS: "abc" }), 3);
});
