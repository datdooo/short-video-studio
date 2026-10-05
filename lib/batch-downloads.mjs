// Browser downloads are requests, not confirmed saves: keep manual links available.
export function collectBatchDownloads(batch) {
  return batch.items.flatMap((item) => (item.job?.outputs || []).map((output) => ({
    key: `${batch.id}:${item.job.id}:${output.part}:${output.url}`,
    filename: output.filename,
    url: output.url,
  })));
}

export function createBatchDownloadQueue({ hasRequested, markRequested, requestDownload, onRequested, onError, interval = 1200 }) {
  const pending = [];
  const seen = new Set();
  let timer;
  let disposed = false;
  function schedule() {
    if (disposed || timer !== undefined || !pending.length) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed) return;
      const output = pending.shift();
      try {
        requestDownload(output);
        markRequested(output.key);
        onRequested?.(output);
      } catch (error) {
        seen.delete(output.key);
        onError?.(error);
      }
      schedule();
    }, interval);
  }
  return {
    enqueue(outputs) {
      if (disposed) return;
      for (const output of outputs) {
        if (seen.has(output.key) || hasRequested(output.key)) continue;
        seen.add(output.key);
        pending.push(output);
      }
      schedule();
    },
    remove(keys) {
      const removed = new Set(keys);
      for (let index = pending.length - 1; index >= 0; index--) {
        if (removed.has(pending[index].key)) pending.splice(index, 1);
      }
      // Keep removed keys seen so an already-in-flight poll cannot requeue them.
      removed.forEach((key) => seen.add(key));
    },
    dispose() { disposed = true; clearTimeout(timer); pending.length = 0; },
  };
}
