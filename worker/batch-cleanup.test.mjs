import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { removeBatchItem } from "./batch-cleanup.mjs";

const sourceId = "11111111-1111-1111-1111-111111111111";
const jobId = "22222222-2222-2222-2222-222222222222";
function fixture(state = "done") {
  const item = { id: "33333333-3333-3333-3333-333333333333", jobId, state: "queued" };
  const job = { id: jobId, sourceId, state, outputs: [] };
  return { batch: { items: [item, { id: "other", state: "rendering" }] }, itemId: item.id, jobs: new Map([[jobId, job]]), renderControllers: new Map(), item, job };
}

test("deletion moves only completed job outputs to recovery, keeps source and other items", async () => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "shortcut-delete-test-"));
  const sourceDirectory = path.join(dataRoot, "sources", sourceId);
  const outputDirectory = path.join(sourceDirectory, "outputs", jobId);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(sourceDirectory, "source.mp4"), "source");
  await writeFile(path.join(outputDirectory, "kr1.mp4"), "render");
  const values = fixture();
  const result = await removeBatchItem({ ...values, dataRoot });
  assert.equal(result.removed, true);
  assert.equal(await readFile(path.join(result.recoveryPath, "kr1.mp4"), "utf8"), "render");
  assert.equal(await readFile(path.join(sourceDirectory, "source.mp4"), "utf8"), "source");
  await assert.rejects(stat(outputDirectory), { code: "ENOENT" });
  assert.equal(values.jobs.has(jobId), false);
  assert.equal(values.item.deleted, true);
  assert.equal(values.batch.items[1].deleted, undefined);
  assert.equal((await removeBatchItem({ ...values, dataRoot })).removed, true);
});

test("queued/rendering and still-stopping jobs cannot be deleted", async () => {
  for (const state of ["queued", "rendering", "cancelled"]) {
    const values = fixture(state);
    if (state === "cancelled") values.renderControllers.set(jobId, new AbortController());
    await assert.rejects(removeBatchItem({ ...values, dataRoot: "/private/tmp" }), (error) => error.status === 409);
    assert.equal(values.item.deleted, undefined);
    assert.equal(values.jobs.has(jobId), true);
  }
});

test("invalid output paths rejected; failed items without a render can be removed", async () => {
  const values = fixture("error");
  values.job.sourceId = "../../source";
  await assert.rejects(removeBatchItem({ ...values, dataRoot: "/private/tmp" }), (error) => error.status === 400);
  assert.equal(values.item.deleted, undefined);
  delete values.item.jobId;
  values.item.state = "error";
  assert.deepEqual(await removeBatchItem({ ...values, dataRoot: "/private/tmp" }), { removed: true, recoveryPath: null });
});
