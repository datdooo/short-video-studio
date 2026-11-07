// Offline render benchmark using the app's real filter graph. READ-ONLY on user data; writes only to a temp directory.
//   node scripts/bench-render.mjs <label> <inputThreads> <filterThreads> <complexThreads> <encodeThreads> <nice> [sourceId jobId]
// Pick a done job whose source media still exists. Main is shortened to ~90 source seconds.
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setPriority, tmpdir } from "node:os";
import path from "node:path";
import { createRenderComposition } from "../worker/render/composition.mjs";

const [label, D, F, C, E, nice, argSource, argJob] = process.argv.slice(2);
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA = process.env.SHORTCUT_DATA_ROOT || path.join(process.env.HOME, "Library/Application Support/ShortCut Studio/media");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const SOURCE_ID = argSource, JOB_ID = argJob;
if (!SOURCE_ID || !JOB_ID) throw new Error("usage: bench-render.mjs <label> <in> <filter> <complex> <encode> <nice> <sourceId> <jobId>");

const history = JSON.parse(await readFile(path.join(DATA, "batch-history.json"), "utf8"));
const job = history.jobs.find((j) => j.id === JOB_ID);
const meta = JSON.parse(await readFile(path.join(DATA, "sources", SOURCE_ID, "source.json"), "utf8"));
const source = { ...meta, mediaPath: path.join(DATA, "sources", SOURCE_ID, "source.mp4"), directory: path.join(DATA, "sources", SOURCE_ID) };
const plan = structuredClone(job.plan);
plan.music = { ...(plan.music || {}), enabled: false };
const part = plan.parts[0];
// Keep the real graph but shorten main to ~90 source seconds so a run takes minutes, not tens of minutes.
let budget = 90;
part.segments = part.segments.filter((s) => !s.isPadding).flatMap((s) => {
  if (budget <= 0) return [];
  const length = Math.min(budget, s.end - s.start);
  budget -= length;
  return [{ ...s, end: s.start + length }];
});

let ffmpegWall = 0, argvSample = null;
function run(binary, args, options = {}) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) out.push(args[i]);
  const result = ["-nostdin", "-filter_threads", F, "-filter_complex_threads", C];
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] === "-i") result.push("-threads", D, "-thread_queue_size", "8");
    if (out[i] === "-threads:v") { result.push(out[i], E); i += 1; continue; }
    result.push(out[i]);
  }
  argvSample ||= result.filter((a) => /^-(threads|filter|thread_queue)/.test(a)).join(" ");
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn(binary, result, { stdio: ["ignore", "pipe", "pipe"] });
    try { setPriority(child.pid, Number(nice)); } catch { /* priority is best effort */ }
    let stderr = "";
    child.stdout.on("data", (b) => options.onStdout?.(b.toString()));
    child.stderr.on("data", (b) => { stderr = (stderr + b).slice(-4000); });
    child.on("close", (code) => { ffmpegWall += performance.now() - started; if (code === 0) resolve({ stdout: "", stderr });
      else reject(new Error(stderr)); });
  });
}
const dir = await mkdtemp(path.join(tmpdir(), `bench-${label}-`));
const outputPath = path.join(dir, "out.mp4");
const { renderPart } = createRenderComposition(() => ({
  ffmpeg: FFMPEG, musicLibrary: { resolve: async () => { throw new Error("music off"); } },
  preferredVideoEncoder: "h264_videotoolbox", projectRoot: REPO, renderContrast: 1.04, renderSaturation: 1.06, run,
}));
const t0 = performance.now();
const encoder = await renderPart({ source, plan, part, totalParts: 2, outputPath, onProgress() {}, signal: undefined });
const total = performance.now() - t0;
const size = (await stat(outputPath)).size;
console.log(JSON.stringify({ label, encoder, args: argvSample, totalSeconds: +(total / 1000).toFixed(1), ffmpegSeconds: +(ffmpegWall / 1000).toFixed(1), prepSeconds: +((total - ffmpegWall) / 1000).toFixed(1), bytes: size, out: outputPath }));
