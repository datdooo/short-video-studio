// Owner policy: finished data older than RETENTION_DAYS (default 3) is deleted automatically.
// Only the media library's own move/purge are used, so every guard still applies: anything open in
// the Editor, downloading, analysed or rendering is skipped and retried on the next sweep.
export const DEFAULT_RETENTION_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;

export function retentionDays(env = process.env) {
  const raw = env.SHORTCUT_RETENTION_DAYS;
  if (raw === undefined || raw === "") return DEFAULT_RETENTION_DAYS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_RETENTION_DAYS;
}

export function createRetention({ mediaLibrary, days = DEFAULT_RETENTION_DAYS, now = Date.now, log = () => {} }) {
  let running = false;
  async function sweep() {
    if (!(days > 0) || running) return { skipped: true };
    running = true;
    const cutoff = now() - days * DAY;
    const result = { moved: 0, deleted: 0, freedBytes: 0, kept: 0 };
    try {
      const library = await mediaLibrary.list();
      const expired = [...library.originals, ...library.parts].filter((item) => Date.parse(item.createdAt) < cutoff);
      const trashIds = new Set(library.trash.filter((item) => Date.parse(item.deletedAt) < cutoff).map((item) => item.id));
      for (const item of expired) {
        if (item.busy || item.inUseByEditor) {
          result.kept += 1;
          continue;
        }
        try {
          const moved = await mediaLibrary.move(item.id);
          if (moved.trashId) trashIds.add(moved.trashId);
          result.moved += 1;
        } catch {
          result.kept += 1;
        }
      }
      for (const id of trashIds) {
        try {
          const purged = await mediaLibrary.purge([id]);
          result.deleted += purged.deleted.length;
          result.freedBytes += purged.freedBytes;
        } catch {
          result.kept += 1;
        }
      }
      if (result.moved || result.deleted) log(result);
      return result;
    } finally {
      running = false;
    }
  }
  function start({ firstDelayMs = 60_000, everyMs = 6 * 60 * 60 * 1000 } = {}) {
    if (!(days > 0)) return () => {};
    const run = () => void sweep().catch(() => {});
    const first = setTimeout(run, firstDelayMs), repeat = setInterval(run, everyMs);
    first.unref?.();
    repeat.unref?.();
    return () => {
      clearTimeout(first);
      clearInterval(repeat);
    };
  }
  return { sweep, start };
}
