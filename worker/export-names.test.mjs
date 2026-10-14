import test from "node:test";
import assert from "node:assert/strict";
import { createExportNameAllocator } from "./export-names.mjs";

test("names increment independently per language within the running app", () => {
  const names = createExportNameAllocator();
  assert.deepEqual(names.reserve("de"), ["de1.mp4", "de2.mp4"]);
  assert.deepEqual(names.reserve("de"), ["de11.mp4", "de22.mp4"]);
  assert.deepEqual(names.reserve("kr"), ["kr1.mp4", "kr2.mp4"]);
  assert.deepEqual(names.reserve("de"), ["de111.mp4", "de222.mp4"]);
  assert.deepEqual(names.reserve("kr"), ["kr11.mp4", "kr22.mp4"]);
});
test("a new app session resets all language counters, old reservations stay unchanged", () => {
  const old = createExportNameAllocator();
  const previous = old.reserve("fr"); old.reserve("fr"); old.reserve("jp");
  const fresh = createExportNameAllocator();
  assert.deepEqual(fresh.reserve("fr"), ["fr1.mp4", "fr2.mp4"]);
  assert.deepEqual(fresh.reserve("jp"), ["jp1.mp4", "jp2.mp4"]);
  assert.deepEqual(previous, ["fr1.mp4", "fr2.mp4"]);
  assert.throws(() => fresh.reserve("../../de"));
});
