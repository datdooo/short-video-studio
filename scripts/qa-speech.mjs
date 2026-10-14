// Own synthesized speech only. No personal video, OAuth session or AI credits.
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createSpeechService } from "../worker/speech.mjs";
const runtime = process.env.QA_RUNTIME_BIN || path.resolve(import.meta.dirname, "../release/macos-26/ShortCut Studio.app/Contents/Resources/runtime/bin");
const root = process.env.QA_SPEECH_ROOT || await mkdtemp("/private/tmp/shortcut-speech-qa-");
async function run(binary, args, options = {}) {
  if (args.includes("-osrt")) asrRuns++;
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; options.onStderr?.(chunk.toString()); });
    child.on("error", reject); child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr)));
  });
}
let asrRuns = 0;
const ffmpeg = path.join(runtime, "ffmpeg");
const speech = createSpeechService({ dataRoot: process.env.QA_SPEECH_MODEL_ROOT || root, sourcesRoot: root, ffmpeg, whisper: path.join(runtime, "whisper-cli"), run });
const status = await speech.status(); assert.equal(status.binaryReady, true);
console.log("Downloading/checking official multilingual model in own QA directory…");
await speech.installModel(); assert.equal((await speech.status()).modelReady, true);
const id = `own-synthesized-speech-${Date.now()}`;
const directory = path.join(root, id); await mkdir(directory, { recursive: true });
const audio = path.join(directory, "voice.aiff"), mediaPath = path.join(directory, "source.mp4");
await run("/usr/bin/say", ["-v", "Samantha", "-r", "140", "-o", audio, "This is a local subtitle test. We are repairing a car. The subtitles should follow the speech."]);
await run(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=black:s=320x180:r=30", "-i", audio, "-shortest", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", mediaPath]);
const probe = await run(path.join(runtime, "ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "json", mediaPath]);
const source = { id, mediaPath, hasAudio: true, duration: Number(JSON.parse(probe.stdout).format.duration) };
source.captions = [{ start: 0, end: 1, text: 'YouTube fixture must not replace forced ASR' }];
const result = await speech.captions(source, undefined, { provider: 'whisper' });
assert.ok(result.cues.length > 0);
assert.match(result.cues.map((cue) => cue.text).join(" "), /subtitle|subtitles/i);
assert.ok(result.cues.every((cue) => cue.start >= 0 && cue.end > cue.start));
assert.equal(result.sourceId, id); assert.equal(result.timeline, "source");
assert.ok(result.cues.every((cue) => cue.end <= source.duration));
const boundaries = await speech.boundaries(source);
assert.ok(boundaries.silences.length > 0);
assert.deepEqual(await speech.captions(source, undefined, { provider: 'whisper' }), result);
assert.equal(asrRuns, 1, "Normal retrieval reuses the correctly-bound cache");
const regenerated = await speech.captions(source, undefined, { regenerate: true, provider: 'whisper' });
assert.equal(asrRuns, 2, "Explicit regeneration must not just return the old Whisper cache");
assert.equal(regenerated.sourceId, id); assert.equal(regenerated.timeline, "source");
assert.ok(regenerated.cues.every((cue) => cue.end <= source.duration));
assert.ok((await readFile(path.join(directory, "speech-captions.json"), "utf8")).includes("whisper-local"));
console.log(JSON.stringify({ pass: true, root, cues: result.cues, silences: boundaries.silences }));
