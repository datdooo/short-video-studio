import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, stat, rename, symlink, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createMediaLibrary, boundedCatalogue } from "./media-library.mjs";

const sourceId = "11111111-1111-1111-1111-111111111111";
const jobId = "22222222-2222-2222-2222-222222222222";
async function fixture(options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "shortcut-library-test-"));
  const source = path.join(root, "sources", sourceId);
  const outputs = path.join(source, "outputs", jobId);
  await mkdir(path.join(outputs, "part-1"), { recursive: true });
  await mkdir(path.join(outputs, "part-2"), { recursive: true });
  await writeFile(path.join(source, "source.json"), JSON.stringify({ id: sourceId, title: "Test source", kind: "youtube" }));
  await writeFile(path.join(source, "source.mp4"), "original");
  await writeFile(path.join(outputs, "part-1", "kr1.mp4"), "first-part");
  await writeFile(path.join(outputs, "part-2", "kr2.mp4"), "second-part");
  const library = createMediaLibrary({ roots: [{ id: "current", label: "Current", root }], ...options });
  return { root, source, outputs, library };
}
const absent = async (file) => assert.rejects(stat(file), { code: "ENOENT" });

test("editor render deletion trashes the entire pair, preserves source/other jobs, and restores both parts", async () => {
  const moved = [], restored = [];
  const { library, source, outputs } = await fixture({ onMoved: (item) => moved.push(item), onRestored: (item) => restored.push(item) });
  const other = path.join(source, "outputs", "44444444-4444-4444-4444-444444444444");
  await mkdir(other); await writeFile(path.join(other, "other.mp4"), "keep-other");
  const result = await library.moveRender({ sourceId, jobId });
  assert.equal(result.removed, true); assert.match(result.trashId, /^current:renders:/);
  await absent(outputs);
  assert.equal(await readFile(path.join(source, "source.mp4"), "utf8"), "original");
  assert.equal(await readFile(path.join(other, "other.mp4"), "utf8"), "keep-other");
  assert.equal(moved[0].kind, "parts"); assert.equal(moved[0].jobId, jobId);
  await library.restore(result.trashId);
  assert.equal(await readFile(path.join(outputs, "part-1", "kr1.mp4"), "utf8"), "first-part");
  assert.equal(await readFile(path.join(outputs, "part-2", "kr2.mp4"), "utf8"), "second-part");
  assert.equal(restored[0].jobId, jobId);
});

test("whole-render deletion rejects active sources, forged paths and nested symlinks", async () => {
  const blocked = await fixture({ isBusy: () => true });
  await assert.rejects(blocked.library.moveRender({ sourceId, jobId }), { status: 409 });
  const { library, outputs, root } = await fixture();
  await assert.rejects(library.moveRender({ sourceId: "../../", jobId }), { status: 400 });
  const outside = path.join(root, "outside.mp4"); await writeFile(outside, "untouched");
  await symlink(outside, path.join(outputs, "linked.mp4"));
  await assert.rejects(library.moveRender({ sourceId, jobId }), { status: 409 });
  assert.equal(await readFile(outside, "utf8"), "untouched");
  assert.deepEqual(await library.moveRender({ sourceId, jobId: "55555555-5555-5555-5555-555555555555" }), { removed: true, trashId: null });
});

test("catalogue lists original and individual parts with sizes, stable identities, source titles and safe media paths", async () => {
  const { library, source } = await fixture();
  const list = await library.list();
  assert.equal(list.originals.length, 1); assert.equal(list.parts.length, 2); assert.equal(list.trash.length, 0);
  assert.equal(list.totals.originals, 8); assert.equal(list.totals.parts, 21);
  assert.ok(list.parts.every((item) => item.title === "Test source" && item.renderUrl.startsWith("/files/")));
  assert.equal(await library.media(list.originals[0].id), path.join(source, "source.mp4"));
  assert.equal("target" in list.originals[0], false);
});

test("trashing the original preserves both outputs and metadata; restoring preserves the original bytes", async () => {
  const { library, source, outputs } = await fixture();
  const original = (await library.list()).originals[0];
  const result = await library.move(original.id);
  await absent(path.join(source, "source.mp4"));
  assert.equal(await readFile(path.join(outputs, "part-1", "kr1.mp4"), "utf8"), "first-part");
  assert.equal(JSON.parse(await readFile(path.join(source, "source.json"))).title, "Test source");
  const list = await library.list();
  assert.equal(list.originals.length, 0); assert.equal(list.parts.length, 2); assert.equal(list.trash.length, 1);
  assert.equal(list.trash[0].kind, "original");
  await library.restore(result.trashId);
  assert.equal(await readFile(path.join(source, "source.mp4"), "utf8"), "original");
  assert.equal((await library.list()).trash.length, 0);
});

test("individual part trash/restore/purge does not delete the other part or original; restore never overwrites", async () => {
  const { library, source, outputs } = await fixture();
  const part = (await library.list()).parts.find((item) => item.part === 1);
  const { trashId } = await library.move(part.id);
  const target = path.join(outputs, "part-1", "kr1.mp4");
  await absent(target);
  await writeFile(target, "newer-file");
  await assert.rejects(library.restore(trashId), { status: 409 });
  assert.equal(await readFile(target, "utf8"), "newer-file");
  assert.equal((await library.list()).trash.length, 1);
  await rm(target);
  await library.restore(trashId);
  assert.equal(await readFile(target, "utf8"), "first-part");
  const moved = await library.move(part.id);
  const result = await library.purge([moved.trashId]);
  assert.ok(result.freedBytes >= 10);
  assert.equal((await library.list()).trash.length, 0);
  assert.equal(await readFile(path.join(source, "source.mp4"), "utf8"), "original");
  assert.equal(await readFile(path.join(outputs, "part-2", "kr2.mp4"), "utf8"), "second-part");
});

test("active/still-stopping sources are protected and mutations lock out a new render", async () => {
  let busy = true;
  let heldLock = false;
  const values = await fixture({ isBusy: () => busy, onMoved: () => { heldLock = values.library.isLocked(sourceId); } });
  const list = await values.library.list();
  assert.ok(list.originals[0].busy && list.parts[0].busy);
  await assert.rejects(values.library.move(list.originals[0].id), { status: 409 });
  await assert.rejects(values.library.move(list.parts[0].id), { status: 409 });
  busy = false;
  const moved = await values.library.move(list.originals[0].id);
  assert.ok(heldLock);
  assert.equal(values.library.isLocked(sourceId), false);
  busy = true;
  await assert.rejects(values.library.restore(moved.trashId), { status: 409 });
  await assert.rejects(values.library.purge([moved.trashId]), { status: 409 });
  assert.equal((await values.library.list()).trash.length, 1);
});

test("existing batch-delete recovery folders are visible, restorable, and permanently deletable", async () => {
  const { library, root, outputs } = await fixture();
  const key = `${sourceId}--${jobId}--33333333-3333-3333-3333-333333333333`;
  const trash = path.join(root, "trash", "renders", key);
  await mkdir(path.dirname(trash), { recursive: true });
  await rename(outputs, trash);
  let list = await library.list();
  assert.equal(list.parts.length, 0); assert.equal(list.trash[0].kind, "parts");
  await library.restore(list.trash[0].id);
  assert.equal((await library.list()).parts.length, 2);
  await rename(outputs, trash);
  list = await library.list();
  await library.purge([list.trash[0].id]);
  await absent(trash);
  assert.equal((await library.list()).originals.length, 1);
});

test("current and legacy storage are independent; legacy operations never touch current sources", async () => {
  const current = await fixture(), legacy = await fixture();
  const library = createMediaLibrary({ roots: [{ id: "current", label: "Current", root: current.root }, { id: "legacy", label: "Old", root: legacy.root }] });
  const list = await library.list();
  assert.equal(list.originals.length, 2); assert.equal(list.parts.length, 4);
  const old = list.originals.find((item) => item.storageId === "legacy");
  const result = await library.move(old.id);
  await library.purge([result.trashId]);
  assert.equal(await readFile(path.join(current.source, "source.mp4"), "utf8"), "original");
  await absent(path.join(legacy.source, "source.mp4"));
});

test("forged IDs, traversal, symlinks and mixed invalid purge requests cannot delete other files", async () => {
  const { library, source } = await fixture();
  const list = await library.list();
  const original = list.originals[0];
  const data = JSON.parse(Buffer.from(original.id, "base64url").toString());
  for (const change of [{ filename: "../../source.mp4" }, { sourceId: "../escape" }, { storageId: "elsewhere" }, { kind: "original", filename: "source.json" }]) {
    const forged = Buffer.from(JSON.stringify({ ...data, ...change })).toString("base64url");
    await assert.rejects(library.move(forged), { status: 400 });
  }
  const moved = await library.move(original.id);
  await assert.rejects(library.purge([moved.trashId, "current:media:../../"]), { status: 400 });
  assert.equal((await library.list()).trash.length, 1, "Validate every purge target before deleting any");
  await library.restore(moved.trashId);
  const outside = path.join(source, "untouched.txt");
  await writeFile(outside, "protected");
  await rm(path.join(source, "source.mp4"));
  await symlink(outside, path.join(source, "source.mp4"));
  await assert.rejects(library.move(original.id), { status: 409 });
  assert.equal(await readFile(outside, "utf8"), "protected");
});

test("an OS-blocked catalogue scan returns a warning instead of indefinitely blocking other storage", async () => {
  const result = await boundedCatalogue(new Promise(() => {}), "Legacy", 5);
  assert.equal(result.originals.length, 0);
  assert.match(result.warnings[0], /Legacy/);
  const ready = { originals: [{ id: "own" }], parts: [], trash: [], warnings: [] };
  assert.strictEqual(await boundedCatalogue(Promise.resolve(ready), "Current", 5), ready);
});

test("old trash titles are recovered from app history when source metadata was already removed", async () => {
  const { library, root, source, outputs } = await fixture();
  await rm(path.join(source, "source.json"));
  await writeFile(path.join(root, "batch-history.json"), JSON.stringify({ batches: [{ items: [{ sourceId, title: "Recovered source title" }] }] }));
  const key = `${sourceId}--${jobId}--33333333-3333-3333-3333-333333333333`;
  const trash = path.join(root, "trash", "renders", key);
  await mkdir(path.dirname(trash), { recursive: true }); await rename(outputs, trash);
  assert.equal((await library.list()).trash[0].title, "Recovered source title");
});
