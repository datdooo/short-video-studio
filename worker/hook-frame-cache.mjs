import {createHash, randomUUID} from 'node:crypto';
import {mkdir, lstat, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {timelineDuration} from '../lib/render-config.mjs';
import {createAnalysisCache} from './analysis-cache.mjs';
import {createSharedOperations} from './shared-operation.mjs';
import {aiEvent, measureAiStage} from './ai-operation.mjs';

// Timestamp identity is exact (not a rounded frame bucket). These are the same
// sparse stills as before, not action/video evidence. Cache only generated JPEGs.
const FRAME_VERSION = 'hook-frame-512x288-q5-accurate-seek-v1';
const MAX_FRAME_BYTES = 300_000;
const MEMORY_BYTES = 8 * 1024 * 1024;
const DISK_BYTES = 12 * 1024 * 1024;

function validImage(value) {
  if (typeof value?.data !== 'string' || value.data.length > Math.ceil(MAX_FRAME_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.data)) return false;
  const bytes = Buffer.from(value.data, 'base64');
  return bytes.length >= 4 && bytes.length <= MAX_FRAME_BYTES && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}

export function createHookFrameSampler({root, ffmpeg, run, fingerprint}) {
  const disk = createAnalysisCache(path.join(root, 'images-v1'), {maxBytes: DISK_BYTES});
  const shared = createSharedOperations(), memory = new Map();
  let memoryBytes = 0;
  function remember(key, value) {
    if (memory.has(key)) { memoryBytes -= memory.get(key).data.length; memory.delete(key); }
    memory.set(key, value); memoryBytes += value.data.length;
    while (memoryBytes > MEMORY_BYTES || memory.size > 512) {
      const oldest = memory.keys().next().value;
      memoryBytes -= memory.get(oldest).data.length; memory.delete(oldest);
    }
  }

  async function image(key, source, time, signal) {
    const cached = memory.get(key);
    if (cached) { remember(key, cached); return {data: cached.data, reused: true}; }
    return shared(key, active => disk.using(key, async () => {
      active.throwIfAborted();
      const saved = await disk.get(key);
      active.throwIfAborted();
      if (validImage(saved)) { remember(key, saved); return {data: saved.data, reused: true}; }
      await mkdir(root, {recursive: true, mode: 0o700});
      if (!(await lstat(root)).isDirectory()) throw new Error('Unsafe frame cache directory');
      const file = path.join(root, `${randomUUID()}.jpg`);
      try {
        // Keep accurate individual seeks: a select pass spanning distant moments
        // would decode the excluded gaps. Shared/cache hits never open a decoder.
        await run(ffmpeg, ['-y', '-v', 'error', '-ss', String(time), '-i', source.mediaPath, '-frames:v', '1', '-vf', 'scale=512:288:force_original_aspect_ratio=decrease', '-q:v', '5', file], {signal: AbortSignal.any([active, AbortSignal.timeout(45_000)])});
        active.throwIfAborted();
        const bytes = await readFile(file);
        const value = {data: bytes.toString('base64')};
        if (!validImage(value)) throw new Error('Hook frame exceeds budget or is not a complete JPEG');
        remember(key, value);
        await disk.put(key, value);
        active.throwIfAborted();
        return {data: value.data, reused: false};
      } finally { await rm(file, {force: true}); }
    }), signal);
  }

  return async function hookFrames(part, source, signal, candidateTimes) {
    return measureAiStage('frames', async () => {
      const ranges = part.segments.filter(s => !s.isPadding).slice(0, 200);
      const total = timelineDuration(ranges), frames = [];
      const times = candidateTimes?.slice(0, 48);
      const bounded = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(45_000)]);
      let reused = 0, extracted = 0;
      let sourceHash;
      try { sourceHash = await fingerprint(source, bounded); }
      catch { signal?.throwIfAborted(); return frames; }
      for (let i = 0; i < (times?.length || 6); i++) {
        signal?.throwIfAborted(); if (bounded.aborted) break;
        let offset = (i + 0.5) / 6 * total, range = ranges[0];
        if (!range) break;
        for (const current of ranges) { range = current; if (offset < current.end - current.start) break; offset -= current.end - current.start; }
        const time = times?.[i]?.time ?? Math.min(range.end - 0.001, range.start + offset);
        if (!Number.isFinite(time) || !ranges.some(r => time >= r.start && time <= r.end)) continue;
        const key = createHash('sha256').update(JSON.stringify([FRAME_VERSION, source.id, sourceHash, time])).digest('hex');
        try {
          const value = await image(key, source, time, bounded);
          signal?.throwIfAborted();
          if (bounded.aborted) break;
          if (value.reused) reused++; else extracted++;
          frames.push({time, ...(times?.[i]?.candidateId ? {candidateId: times[i].candidateId} : {}), data: value.data});
        } catch { signal?.throwIfAborted(); if (bounded.aborted) break; }
      }
      // Misses count requested fresh samples; simultaneous subscribers may share
      // one underlying extraction, so this is not a process/decoder counter.
      aiEvent('cache', {cache: 'frames', partId: part.id, requested: times?.length || 6, reused, cacheMisses: extracted});
      return frames;
    }, {partId: part.id});
  };
}
