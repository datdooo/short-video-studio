// Subscriber-aware cancellation: only the last departing consumer aborts the operation.
export function createSharedOperations() {
  const pending = new Map();
  return function shared(key, operation, signal) {
    signal?.throwIfAborted();
    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, consumers: 0 };
      entry.promise = Promise.resolve().then(() => operation(controller.signal)).finally(() => { if (pending.get(key) === entry) pending.delete(key); });
      pending.set(key, entry);
    }
    entry.consumers++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (callback, value) => {
        if (finished) return; finished = true; signal?.removeEventListener('abort', abort);
        if (--entry.consumers === 0) { entry.controller.abort(); if (pending.get(key) === entry) pending.delete(key); }
        callback(value);
      };
      const abort = () => finish(reject, signal.reason || new Error('Đã huỷ tải video.'));
      signal?.addEventListener('abort', abort, { once: true });
      entry.promise.then((value) => finish(resolve, value), (error) => finish(reject, error));
    });
  }
;
}
