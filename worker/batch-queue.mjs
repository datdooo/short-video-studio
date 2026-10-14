import { randomUUID } from "node:crypto";

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

// Preparation is FIFO, independently of the render queue. Each submission owns
// an immutable list of items and its own prompt configuration, even when the
// visible batch keeps growing while earlier submissions are still preparing.
export function createBatchSubmissionQueue({ batches, controllers, prepare, onChange = () => {}, createId = randomUUID }) {
  let preparationQueue = Promise.resolve();
  return {
    submit(body) {
      let batch;
      if (body.batchId !== undefined) {
        batch = batches.get(body.batchId);
        if (!batch) fail("Hàng đợi không còn tồn tại. Refresh trang rồi thêm link lại.", 404);
        const controller = controllers.get(batch.id);
        if (!controller || controller.signal.aborted) fail("Hàng đợi đã dừng. Chờ cập nhật trạng thái rồi chạy lượt mới; link chưa được thêm.", 409);
      } else {
        batch = { id: createId(), items: [] };
        batches.set(batch.id, batch);
        controllers.set(batch.id, new AbortController());
      }
      const items = body.urls.map((url) => ({ id: createId(), url, state: "pending", error: null }));
      batch.items.push(...items);
      void onChange();
      preparationQueue = preparationQueue.then(() => prepare(batch, body, items)).catch((error) => {
        const cancelled = controllers.get(batch.id)?.signal.aborted;
        for (const item of items) {
          if (!item.jobId && !["done", "error", "cancelled"].includes(item.state)) {
            item.state = cancelled ? "cancelled" : "error";
            item.error = cancelled ? null : error instanceof Error ? error.message : String(error);
          }
        }
      }).finally(() => onChange());
      return batch;
    },
    idle: () => preparationQueue,
  };
}
