import { createHash } from "node:crypto";
import { mkdir, readdir, rm, stat, utimes } from "node:fs/promises";
import path from "node:path";
import { FRAME_COVERAGE_VERSION } from "../lib/frame-rules.mjs";
import { createSharedOperations } from "./shared-operation.mjs";

const MAX_COUNT = 24;
const MIN_COUNT = 8;
const KEEP_SOURCES = 16;
const WIDTH = 448;
const POOL = 3;

/** Number of stills: about one per 40 s, bounded; SHORTCUT_CODEX_FRAMES overrides (0 disables). */
export function coverageCount(duration, env = process.env) {
  const override = env.SHORTCUT_CODEX_FRAMES;
  if (override !== undefined && override !== "") {
    const value = Number(override);
    if (!Number.isInteger(value) || value < 0 || value > MAX_COUNT) return 0;
    return value;
  }
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(duration / 40)));
}

export function coverageTimes(duration, count) {
  return Array.from({ length: count }, (_, index) => Number((((index + 0.5) * duration) / count).toFixed(3)));
}

/** Evenly spaced stills across the whole source, cached on disk by source identity. */
export function createCoverageFrames({ root, ffmpeg, run, env = process.env }) {
  const shared = createSharedOperations();

  async function identity(source) {
    const info = await stat(source.mediaPath);
    const count = coverageCount(source.duration, env);
    if (!count) return null;
    const key = createHash("sha256")
      .update(`${FRAME_COVERAGE_VERSION}|${source.id}|${info.size}|${Math.round(info.mtimeMs)}|${source.duration}|${count}|${WIDTH}`)
      .digest("hex");
    return { key, count, times: coverageTimes(source.duration, count) };
  }

  /** Deterministic fingerprint without decoding anything (used for cache keys). */
  async function digest(source) {
    const id = await identity(source).catch(() => null);
    return id ? id.key : null;
  }

  async function prune(keep) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    const dirs = await Promise.all(
      entries.filter((entry) => entry.isDirectory()).map(async (entry) => ({
        name: entry.name,
        at: (await stat(path.join(root, entry.name)).catch(() => ({ mtimeMs: 0 }))).mtimeMs,
      })),
    );
    for (const dir of dirs.sort((a, b) => b.at - a.at).slice(KEEP_SOURCES))
      if (dir.name !== keep) await rm(path.join(root, dir.name), { recursive: true, force: true }).catch(() => {});
  }

  async function frames(source, { signal } = {}) {
    const id = await identity(source);
    if (!id) return null;
    return shared(`frames:${id.key}`, async (active) => {
      const directory = path.join(root, id.key.slice(0, 32));
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const images = id.times.map((time, index) => ({
        index: index + 1,
        time,
        file: path.join(directory, `still-${String(index + 1).padStart(2, "0")}.jpg`),
      }));
      const missing = [];
      for (const image of images) {
        const info = await stat(image.file).catch(() => null);
        if (!info?.size) missing.push(image);
      }
      let cursor = 0;
      const worker = async () => {
        while (cursor < missing.length) {
          const image = missing[cursor++];
          active.throwIfAborted();
          await run(
            ffmpeg,
            ["-y", "-v", "error", "-ss", String(image.time), "-i", source.mediaPath, "-frames:v", "1", "-an", "-sn",
              "-vf", `scale=${WIDTH}:${WIDTH}:force_original_aspect_ratio=decrease`, "-q:v", "5", image.file],
            { signal: active },
          );
          const info = await stat(image.file).catch(() => null);
          if (!info?.size) throw new Error("Coverage still was not produced.");
        }
      };
      try {
        await Promise.all(Array.from({ length: Math.min(POOL, missing.length) }, worker));
      } catch (error) {
        for (const image of missing) await rm(image.file, { force: true }).catch(() => {});
        throw error;
      }
      const now = new Date();
      await utimes(directory, now, now).catch(() => {});
      void prune(path.basename(directory));
      return {
        images,
        digest: id.key,
        manifest: {
          version: FRAME_COVERAGE_VERSION,
          count: id.count,
          intervalSeconds: source.duration / id.count,
          times: id.times,
        },
      };
    }, signal);
  }

  return { digest, frames };
}
