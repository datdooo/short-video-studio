/** One worker-owned domain; shared services are read at operation entry. */
export function createBatchService(read) {
  function cancelBatch(batch) {
    const { batchControllers, cancelRender, jobs } = read();

    batchControllers.get(batch.id)?.abort();
    for (const item of batch.items) {
      if (item.jobId) cancelRender(jobs.get(item.jobId));
      if (!["done", "error"].includes(item.state)) {
        item.state = "cancelled";
        item.error = null;
      }
    }
  }

  async function prepareBatch(batch, body, items) {
    const { batchControllers, processBatch } = read();

    return processBatch(batch, body, items, batchControllers.get(batch.id).signal);
  }

  function batchSnapshot(batch) {
    const { jobs, renderSnapshot } = read();

    const items = batch.items
      .filter((item) => !item.deleted)
      .map((item) => {
        const storedJob = item.jobId ? jobs.get(item.jobId) : null;
        const job = storedJob ? renderSnapshot(storedJob) : null;
        return { ...item, state: job?.state || item.state, error: job?.error || item.error, job };
      });
    return {
      id: batch.id,
      items,
      finished: items.every((item) =>
        ["done", "error", "cancelled", "paused", "awaiting-import", "review-required"].includes(item.state),
      ),
    };
  }
  return { batchSnapshot, cancelBatch, prepareBatch };
}
