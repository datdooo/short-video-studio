/** Exact playback clock; React subscribers receive at most 10 display updates/s. */
export function createPreviewClock({ now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  const timeRef = { current: 0 }, listeners = new Set();
  let snapshot = 0, lastPublish = -Infinity, timer = null;
  const publish = () => {
    timer = null;
    lastPublish = now();
    if (snapshot === timeRef.current) return;
    snapshot = timeRef.current;
    for (const listener of listeners) listener();
  };
  return {
    timeRef,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => 0,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setTime(update) {
      timeRef.current = typeof update === 'function' ? update(timeRef.current) : update;
      if (timer !== null) return;
      const wait = 100 - (now() - lastPublish);
      if (wait <= 0) publish();
      else timer = schedule(publish, wait);
    },
    dispose() { if (timer !== null) cancel(timer); timer = null; },
  };
}
