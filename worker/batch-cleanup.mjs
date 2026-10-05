import path from "node:path";
import { mkdir, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const terminalStates = new Set(["done", "error", "cancelled"]);
const validId = /^[a-f0-9-]{16,64}$/i;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

// Move only this job's output folder, never the source or the user's Downloads.
// Tombstones preserve prepareBatch's iteration while other videos keep processing.
export async function removeBatchItem({ batch, itemId, jobs, renderControllers, dataRoot }) {
  const item = batch.items.find((candidate) => candidate.id === itemId);
  if (!item) fail("Video không tồn tại trong hàng đợi.", 404);
  if (item.deleted) return { removed: true, recoveryPath: null };
  const job = item.jobId ? jobs.get(item.jobId) : null;
  if (!terminalStates.has(job?.state || item.state) || (item.jobId && renderControllers.has(item.jobId))) {
    fail("Video vẫn đang xử lý. Dừng render và chờ tác vụ dừng hẳn trước khi xoá.", 409);
  }
  if (item.deleting) fail("Video đang được xoá.", 409);
  item.deleting = true;
  let recoveryPath = null;
  try {
    if (job) {
      if (!validId.test(job.sourceId) || !validId.test(job.id)) fail("Đường dẫn render không hợp lệ.", 400);
      const outputDirectory = path.join(dataRoot, "sources", job.sourceId, "outputs", job.id);
      const trashRoot = path.join(dataRoot, "trash", "renders");
      await mkdir(trashRoot, { recursive: true });
      const destination = path.join(trashRoot, `${job.sourceId}--${job.id}--${randomUUID()}`);
      try {
        await rename(outputDirectory, destination);
        recoveryPath = destination;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      jobs.delete(job.id);
    }
    item.deleted = true;
    return { removed: true, recoveryPath };
  } finally { delete item.deleting; }
}
