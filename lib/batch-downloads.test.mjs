import test from "node:test";
import assert from "node:assert/strict";
import { collectBatchDownloads, createBatchDownloadQueue } from "./batch-downloads.mjs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = (part) => ({ part, filename: `kr${part}.mp4`, url: `/files/test/kr${part}.mp4` });
const snapshot = (parts) => ({ id: "batch", items: [{ job: { id: "job", outputs: parts.map(output) } }, {}] });

test("deleted videos are removed from pending downloads and stale polls cannot restore them", async () => {
  const requests = [];
  const queue = createBatchDownloadQueue({ hasRequested: () => false, markRequested: () => {}, requestDownload: (file) => requests.push(file.filename), interval: 1 });
  const downloads = collectBatchDownloads(snapshot([1, 2]));
  queue.enqueue(downloads);
  queue.remove([downloads[0].key]);
  queue.enqueue(downloads);
  await delay(20);
  assert.deepEqual(requests, ["kr2.mp4"]);
  queue.dispose();
});

test("completed parts download once across polls and reloads; new parts download later", async () => {
  const history = new Set();
  const requests = [];
  const options = { hasRequested: (key) => history.has(key), markRequested: (key) => history.add(key), requestDownload: (file) => requests.push(file.filename), interval: 1 };
  const queue = createBatchDownloadQueue(options);
  queue.enqueue(collectBatchDownloads(snapshot([1])));
  queue.enqueue(collectBatchDownloads(snapshot([1])));
  await delay(20);
  queue.enqueue(collectBatchDownloads(snapshot([1, 2])));
  await delay(20);
  assert.deepEqual(requests, ["kr1.mp4", "kr2.mp4"]);
  queue.dispose();
  const reload = createBatchDownloadQueue(options);
  reload.enqueue(collectBatchDownloads(snapshot([1, 2])));
  await delay(20);
  assert.equal(requests.length, 2);
  reload.dispose();
});

test("failed requests do not block later files, and unrequested files survive tab closure", async () => {
  const history = new Set();
  const requests = [];
  const errors = [];
  const options = { hasRequested: (key) => history.has(key), markRequested: (key) => history.add(key), requestDownload: (file) => { if (file.filename === "kr1.mp4") throw new Error("blocked"); requests.push(file.filename); }, onError: (error) => errors.push(error.message), interval: 1 };
  const queue = createBatchDownloadQueue(options);
  queue.enqueue(collectBatchDownloads(snapshot([1, 2])));
  await delay(20);
  assert.deepEqual(requests, ["kr2.mp4"]);
  assert.deepEqual(errors, ["blocked"]);
  assert.equal(history.size, 1);
  queue.dispose();
  const closing = createBatchDownloadQueue({ ...options, interval: 30 });
  closing.enqueue(collectBatchDownloads(snapshot([1])));
  closing.dispose();
  await delay(40);
  assert.equal(history.size, 1);
});
