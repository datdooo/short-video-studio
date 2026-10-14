import test from "node:test";
import assert from "node:assert/strict";
import { createBatchSubmissionQueue } from "./batch-queue.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function setup(prepare) {
  const batches = new Map();
  const controllers = new Map();
  let nextId = 0;
  let writes = 0;
  const queue = createBatchSubmissionQueue({ batches, controllers, prepare, createId: () => `id-${++nextId}`, onChange: () => { writes++; } });
  return { queue, batches, controllers, writes: () => writes };
}
function submission(urls, batchId, promptTemplate = "original rules") {
  return { urls, batchId, promptTemplate, schema: { version: promptTemplate } };
}

test("appending returns immediately during preparation, preserves FIFO and per-submission rules, never prepares an item twice", async () => {
  const started = deferred();
  const release = deferred();
  const calls = [];
  const state = setup(async (batch, body, items) => {
    calls.push({ urls: items.map((item) => item.url), prompt: body.promptTemplate });
    if (calls.length === 1) { started.resolve(); await release.promise; }
    for (const item of items) { item.jobId = `job-${item.id}`; item.state = "queued"; }
  });
  const batch = state.queue.submit(submission(["A", "B"]));
  await started.promise;
  const firstItem = batch.items[0];
  firstItem.title = "Already prepared title";
  const appended = state.queue.submit(submission(["C", "D"], batch.id, "new rules"));
  const again = state.queue.submit(submission(["E"], batch.id, "third rules"));
  assert.strictEqual(appended, batch);
  assert.strictEqual(again, batch);
  assert.strictEqual(batch.items[0], firstItem);
  assert.equal(batch.items[0].title, "Already prepared title");
  assert.deepEqual(batch.items.map((item) => item.url), ["A", "B", "C", "D", "E"]);
  assert.equal(new Set(batch.items.map((item) => item.id)).size, 5);
  assert.equal(calls.length, 1, "Appending must not start duplicate preparation concurrently");
  assert.equal(state.batches.size, 1);
  assert.ok(state.writes() >= 3, "Every append must be persisted without waiting for preparation");
  release.resolve();
  await state.queue.idle();
  assert.deepEqual(calls, [
    { urls: ["A", "B"], prompt: "original rules" },
    { urls: ["C", "D"], prompt: "new rules" },
    { urls: ["E"], prompt: "third rules" },
  ]);
});

test("new submissions prepare while original jobs are still queued/rendering; existing outputs remain intact", async () => {
  const calls = [];
  const { queue } = setup(async (_batch, _body, items) => {
    calls.push(...items.map((item) => item.url));
    for (const item of items) item.jobId = `job-${item.id}`;
  });
  const batch = queue.submit(submission(["A"]));
  await queue.idle();
  batch.items[0].state = "rendering";
  batch.items[0].outputs = [{ url: "old-part-1.mp4" }];
  const snapshot = structuredClone(batch.items[0]);
  queue.submit(submission(["B"], batch.id));
  await queue.idle();
  assert.deepEqual(calls, ["A", "B"]);
  assert.deepEqual(batch.items[0], snapshot);
});

test("cancel aborts the original and all appended work; a stopped or missing batch rejects appends, a new run works", async () => {
  const started = deferred();
  const release = deferred();
  const processed = [];
  const state = setup(async (batch, _body, items) => {
    if (items[0].url === "A") { started.resolve(); await release.promise; }
    const signal = state.controllers.get(batch.id).signal;
    for (const item of items) {
      if (signal.aborted) { item.state = "cancelled"; continue; }
      processed.push(item.url); item.state = "queued";
    }
  });
  const batch = state.queue.submit(submission(["A"]));
  await started.promise;
  state.queue.submit(submission(["B"], batch.id));
  state.controllers.get(batch.id).abort();
  assert.throws(() => state.queue.submit(submission(["C"], batch.id)), { status: 409 });
  assert.throws(() => state.queue.submit(submission(["C"], "missing")), { status: 404 });
  assert.equal(batch.items.length, 2, "Rejected appends must not insert any item");
  release.resolve();
  await state.queue.idle();
  assert.deepEqual(processed, []);
  assert.ok(batch.items.every((item) => item.state === "cancelled"));
  const fresh = state.queue.submit(submission(["D"]));
  await state.queue.idle();
  assert.notEqual(fresh.id, batch.id);
  assert.deepEqual(processed, ["D"]);
});

test("preparation errors do not poison subsequent submissions or change accepted jobs", async () => {
  const { queue } = setup(async (_batch, _body, items) => {
    if (items[0].url === "A") {
      items[0].jobId = "accepted-job";
      throw new Error("failed before next item");
    }
    for (const item of items) item.state = "queued";
  });
  const batch = queue.submit(submission(["A", "B"]));
  queue.submit(submission(["C"], batch.id));
  await queue.idle();
  assert.equal(batch.items[0].jobId, "accepted-job");
  assert.equal(batch.items[1].state, "error");
  assert.equal(batch.items[1].error, "failed before next item");
  assert.equal(batch.items[2].state, "queued");
});

test("multiple accepted 20-link submissions extend one queue beyond 20 items", async () => {
  const urls = Array.from({ length: 40 }, (_, index) => `https://youtu.be/${index}`);
  const processed = [];
  const { queue } = setup(async (_batch, _body, items) => { processed.push(...items.map((item) => item.url)); });
  const batch = queue.submit(submission(urls.slice(0, 20)));
  queue.submit(submission(urls.slice(20), batch.id));
  await queue.idle();
  assert.equal(batch.items.length, 40);
  assert.deepEqual(processed, urls);
});
