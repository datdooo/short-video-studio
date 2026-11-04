import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createExportNameAllocator, seedExportCounters } from "./export-names.mjs";

test("names increment independently per language", () => {
  const names = createExportNameAllocator();
  assert.deepEqual(names.reserve("de"), ["de1.mp4", "de2.mp4"]);
  assert.deepEqual(names.reserve("de"), ["de11.mp4", "de22.mp4"]);
  assert.deepEqual(names.reserve("kr"), ["kr1.mp4", "kr2.mp4"]);
  assert.deepEqual(names.reserve("de"), ["de111.mp4", "de222.mp4"]);
  assert.deepEqual(names.reserve("kr"), ["kr11.mp4", "kr22.mp4"]);
  assert.throws(() => names.reserve("../../de"));
});
test("numbering continues after the app is restarted", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "export-names-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "counters.json");
  const first = createExportNameAllocator({ file });
  assert.deepEqual(first.reserve("kr"), ["kr1.mp4", "kr2.mp4"]);
  assert.deepEqual(first.reserve("kr"), ["kr11.mp4", "kr22.mp4"]);
  const restarted = createExportNameAllocator({ file });
  assert.deepEqual(restarted.reserve("kr"), ["kr111.mp4", "kr222.mp4"]);
  assert.deepEqual(restarted.reserve("fr"), ["fr1.mp4", "fr2.mp4"]);
});
test("first run is seeded from files already exported", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "export-names-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = path.join(root, "sources", "s1", "outputs", "j1", "part-2");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "kr222.mp4"), "x");
  await writeFile(path.join(dir, "notes.mp4"), "x");
  const names = createExportNameAllocator({ file: path.join(root, "c.json"), seed: () => seedExportCounters(path.join(root, "sources")) });
  assert.deepEqual(names.reserve("kr"), ["kr1111.mp4", "kr2222.mp4"]);
});
test("after 240 videos the counter wraps instead of failing", () => {
  const names = createExportNameAllocator();
  for (let i = 0; i < 240; i += 1) names.reserve("jp");
  assert.deepEqual(names.reserve("jp"), ["jp1.mp4", "jp2.mp4"]);
});
test("reset starts numbering over and the empty state is stored", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "export-names-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "counters.json");
  const names = createExportNameAllocator({ file });
  names.reserve("kr");
  names.reserve("kr");
  names.reset();
  assert.deepEqual(names.reserve("kr"), ["kr1.mp4", "kr2.mp4"]);
  names.reset();
  assert.deepEqual(createExportNameAllocator({ file }).reserve("kr"), ["kr1.mp4", "kr2.mp4"]);
});
