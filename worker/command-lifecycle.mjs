// Own only children spawned by this worker. Detached render groups must also
// receive shutdown signals; terminating just the worker's group cannot reach them.
export function createCommandLifecycle({ platform = process.platform, kill = process.kill, graceMs = 2000 } = {}) {
  const active = new Set();
  let stopping = false, shutdown;
  function signal(record, name) {
    if (!Number.isInteger(record.child.pid) || record.child.pid <= 0) return;
    try {
      if (record.detached && platform !== "win32") kill(-record.child.pid, name);
      else record.child.kill(name);
    } catch { /* Already gone; never search for or signal unrelated processes. */ }
  }
  return {
    assertRunning() {
      if (stopping) throw new DOMException("Media worker is shutting down", "AbortError");
    },
    track(child, detached) {
      let closed;
      const record = { child, detached, done: new Promise(resolve => { closed = resolve; }) };
      const finish = () => { active.delete(record); closed(); };
      active.add(record);
      child.once("close", finish);
      child.once("error", finish);
      if (stopping) signal(record, "SIGTERM");
    },
    stop({ onStart = () => {}, onStopped = () => {} } = {}) {
      if (shutdown) return shutdown;
      stopping = true;
      shutdown = (async () => {
        // Abort requests/render controllers before closing their command pipes.
        onStart();
        for (const record of active) signal(record, "SIGTERM");
        const force = setTimeout(() => {
          for (const record of active) signal(record, "SIGKILL");
        }, graceMs);
        let deadline;
        try {
          await Promise.race([
            Promise.all([...active].map(record => record.done)),
            new Promise(resolve => { deadline = setTimeout(resolve, graceMs + 500); }),
          ]);
        } finally { clearTimeout(force); clearTimeout(deadline); }
        // History is best effort and bounded below bootstrap's shutdown deadline.
        let flushDeadline;
        try {
          await Promise.race([
            Promise.resolve().then(onStopped),
            new Promise(resolve => { flushDeadline = setTimeout(resolve, 500); }),
          ]);
        } finally { clearTimeout(flushDeadline); }
      })();
      return shutdown;
    },
  };
}
