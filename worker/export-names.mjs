import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
const NAME = /^([a-z]{2})([12])\2*\.mp4$/;
// Highest number already used per language, from the files an earlier run left in the outputs folders.
export function seedExportCounters(sourcesRoot) {
  const counters = {};
  const entries = (directory) => {
    try {
      return readdirSync(directory, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  for (const source of entries(sourcesRoot).filter((entry) => entry.isDirectory()))
    for (const job of entries(path.join(sourcesRoot, source.name, "outputs")).filter((entry) => entry.isDirectory()))
      for (const part of entries(path.join(sourcesRoot, source.name, "outputs", job.name)).filter((entry) => entry.isDirectory()))
        for (const file of entries(path.join(sourcesRoot, source.name, "outputs", job.name, part.name))) {
          const match = NAME.exec(file.name);
          if (!match) continue;
          const used = file.name.length - 4 - match[1].length;
          if (used > (counters[match[1]] || 0)) counters[match[1]] = used;
        }
  return counters;
}
// Export names keep counting across app restarts: the counter is stored next to the data (`file`),
// and seeded from the existing outputs the first time, so a new run never reuses an old file name.
export function createExportNameAllocator({ file, seed } = {}) {
  const counters = new Map();
  if (file) {
    let saved = null;
    try {
      saved = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      saved = seed ? seed() : null;
    }
    for (const [prefix, value] of Object.entries(saved || {}))
      if (/^[a-z]{2}$/.test(prefix) && Number.isInteger(value) && value > 0) counters.set(prefix, Math.min(value, 240));
  }
  function persist() {
    if (!file) return;
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      const temporary = `${file}.tmp`;
      writeFileSync(temporary, JSON.stringify(Object.fromEntries(counters)), { mode: 0o600 });
      renameSync(temporary, file);
    } catch {
      /* A failed save only means the next run may restart this counter; never block a render. */
    }
  }
  return {
    /** Forget every language counter (the render list was emptied): the next export is `xx1`/`xx2` again. */
    reset() {
      counters.clear();
      persist();
    },
    reserve(prefix, partCount = 2) {
      if (!/^[a-z]{2}$/.test(prefix) || partCount !== 2) throw new Error("Mã ngôn ngữ hoặc số part không hợp lệ.");
      // After 240 videos the counter wraps instead of failing, so renders never get stuck.
      const index = (counters.get(prefix) || 0) >= 240 ? 1 : (counters.get(prefix) || 0) + 1;
      counters.set(prefix, index);
      persist();
      return [1, 2].map((part) => `${prefix}${String(part).repeat(index)}.mp4`);
    },
  };
}
