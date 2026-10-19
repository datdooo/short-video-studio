import { mkdir, readdir, lstat, readFile, writeFile, rename, rm, statfs } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
export const ANALYSIS_CACHE_BYTES = 24 * 1024 * 1024;
export const ANALYSIS_CACHE_AGE_MS = 14 * 86400000;
export async function requireDiskSpace(directory, bytes) {
  const s = await statfs(directory); if (s.bavail * s.bsize < bytes) throw new Error(`Insufficient free storage; need at least ${Math.ceil(bytes / 1024 / 1024)} MiB before this operation.`);
}
export function createAnalysisCache(root, { maxBytes = ANALYSIS_CACHE_BYTES, maxAgeMs = ANALYSIS_CACHE_AGE_MS, protectedKeys = () => new Set() } = {}) {
  if (!path.isAbsolute(root)) throw new Error('Analysis cache requires an absolute path');
  const active = new Set();
  const file = key => { if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid cache key'); return path.join(root, key + '.json'); };
  async function prune(reserve = 0, keep) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    if (!(await lstat(root)).isDirectory()) throw new Error('Unsafe cache directory');
    const protectedSet = new Set([...active, ...protectedKeys(), keep]);
    const entries = [];
    for (const name of (await readdir(root)).filter(n => /^[a-f0-9]{64}\.json$/.test(n))) {
      const location = path.join(root, name), s = await lstat(location);
      if (!s.isFile()) continue;
      entries.push({ location, key: name.slice(0,-5), size: s.size, at: s.mtimeMs });
    }
    let count = entries.length;
    let size = entries.reduce((n,e) => n + e.size, 0);
    for (const e of entries.sort((a,b) => a.at - b.at || a.key.localeCompare(b.key))) {
      if (protectedSet.has(e.key)) continue;
      if (Date.now() - e.at <= maxAgeMs && size + reserve <= maxBytes && count <= 512) continue;
      await rm(e.location, { force: true }); size -= e.size; count--;
    }
    return size + reserve <= maxBytes;
  }
  return {
    async get(key) {
      try {
        const location = file(key), s = await lstat(location);
        if (!s.isFile() || s.size > 2 * 1024 * 1024 || (!protectedKeys().has(key) && Date.now() - s.mtimeMs > maxAgeMs)) return;
        return JSON.parse(await readFile(location, 'utf8')).value;
      } catch { return; }
    },
    async put(key, value) {
      const serialized = JSON.stringify({ value }), bytes = Buffer.byteLength(serialized);
      if (bytes > 2 * 1024 * 1024) return false;
      try {
        if (!await prune(bytes, key)) return false; // Protected resume data may fill the budget: skip caching, never delete it.
        await requireDiskSpace(root, 256 * 1024 * 1024 + bytes);
        const location = file(key), temporary = `${location}.${randomUUID()}.tmp`;
        try { await writeFile(temporary, serialized, { mode:0o600, flag:'wx' }); await rename(temporary, location); }
        finally { await rm(temporary, { force:true }); }
        return true;
      } catch { return false; }
    },
    async using(key, task) { active.add(key); try { return await task(); } finally { active.delete(key); } },
    prune,
  };
}
