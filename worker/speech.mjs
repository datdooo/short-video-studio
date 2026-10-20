import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { parseCaptions, sourceCaptionTrack } from "../lib/subtitles.mjs";

const MODEL_SHA = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe';
const MODEL_NAME = 'ggml-base.bin';
const MODEL_BYTES = 147951465;

export function createSpeechService({ dataRoot, sourcesRoot, ffmpeg, whisper, run }) {
  const model = path.join(dataRoot, "models", MODEL_NAME);
  const busy = new Map(); let installation; let modelVerified = false; let downloadedBytes = 0;
  async function verifyModel() {
    if (modelVerified) return true;
    if (!existsSync(model)) return false;
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(model)) hash.update(chunk);
    modelVerified = hash.digest("hex") === MODEL_SHA;
    return modelVerified;
  }
  async function installModel() {
    if (await verifyModel()) return;
    if (!whisper) throw new Error("Bản app chưa có Whisper. Cập nhật bản build mới.");
    if (installation) return installation;
    installation = (async () => {
      await mkdir(path.dirname(model), { recursive: true });
      const temporary = `${model}.${randomUUID()}.partial`;
      try {
        downloadedBytes = 0;
        const response = await fetch(`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}`, { signal: AbortSignal.timeout(1_800_000) });
        if (!response.ok) throw new Error(`Không tải được model Whisper (${response.status}).`);
        const hash = createHash("sha256");
        const meter = new Transform({ transform(chunk, encoding, callback) { hash.update(chunk); downloadedBytes += chunk.length; callback(null, chunk); } });
        await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(temporary, { flags: "wx" }));
        if (downloadedBytes !== MODEL_BYTES || hash.digest("hex") !== MODEL_SHA) throw new Error("Checksum model Whisper không khớp; file chưa được sử dụng.");
        await rename(temporary, model); modelVerified = true;
      } finally { await unlink(temporary).catch(() => {}); }
    })().finally(() => { installation = null; });
    return installation;
  }
  async function once(source, key, task) {
    const id = `${source.id}:${key}`;
    if (busy.has(id)) return busy.get(id);
    const promise = task().finally(() => busy.delete(id)); busy.set(id, promise); return promise;
  }
  async function captions(source, signal, { regenerate = false, provider = 'auto' } = {}) {
    if (!['auto', 'youtube', 'whisper'].includes(provider)) throw new Error('Nguồn phụ đề không hợp lệ.');
    if (provider !== 'whisper' && source.captions?.length) return sourceCaptionTrack({ sourceId: source.id, cues: source.captions, origin: "youtube" }, source);
    if (provider === 'youtube') throw new Error('Video này không có phụ đề YouTube. Chọn dùng phụ đề Whisper để nhận diện từ audio.');
    const directory = path.join(sourcesRoot, source.id);
    const cached = path.join(directory, "speech-captions.json");
    if (!regenerate && existsSync(cached)) {
      const track = JSON.parse(await readFile(cached, "utf8"));
      return sourceCaptionTrack({ ...track, sourceId: track.sourceId ?? source.id }, source);
    }
    if (!source.hasAudio) return sourceCaptionTrack({ sourceId: source.id, cues: [], origin: "no-audio" }, source);
    return once(source, "captions", async () => {
      if (!whisper || !await verifyModel()) throw new Error("Tải model Whisper base trong mục Auto Subtitle trước (142 MB, một lần). Video không được gửi lên dịch vụ bên ngoài.");
      const wav = path.join(directory, "speech.wav");
      const output = path.join(directory, "speech");
      const temporaryCache = `${cached}.${randomUUID()}.partial`;
      try {
        await run(ffmpeg, ["-y", "-i", source.mediaPath, "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], { signal });
        // Short, word-split timed cues reduce estimated splitting of long sentences.
        await run(whisper, ["-t","2","-m", model, "-f", wav, "-l", "auto", "-osrt", "-of", output, "-ml", "24", "-sow", "-sns"], { signal });
        const result = sourceCaptionTrack({ sourceId: source.id, cues: parseCaptions(await readFile(`${output}.srt`, "utf8")), origin: "whisper-local" }, source);
        await writeFile(temporaryCache, JSON.stringify(result)); await rename(temporaryCache, cached); return result;
      } finally { await unlink(wav).catch(() => {}); await unlink(`${output}.srt`).catch(() => {}); await unlink(temporaryCache).catch(() => {}); }
    });
  }
  async function boundaries(source,signal) {
    return once(source, "boundaries", async () => {
      const cache = path.join(sourcesRoot, source.id, "speech-boundaries.json");
      const captionCache = path.join(sourcesRoot, source.id, "speech-captions.json");
      const raw = source.captions?.length ? { sourceId: source.id, cues: source.captions, origin: "youtube" } : existsSync(captionCache) ? JSON.parse(await readFile(captionCache, "utf8")) : { cues: [] };
      const cues = sourceCaptionTrack({ ...raw, sourceId: raw.sourceId ?? source.id }, source).cues;
      if (existsSync(cache)) return { ...JSON.parse(await readFile(cache, "utf8")), cues };
      if (!source.hasAudio) return { cues, silences: [] };
      let log = "";
      await run(ffmpeg, ["-hide_banner", "-i", source.mediaPath, "-vn", "-af", "silencedetect=noise=-35dB:d=0.18", "-f", "null", "-"], {signal,onStderr: (chunk) => { log = (log + chunk).slice(-100000); } });
      const silences = []; let start;
      for (const match of log.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
        if (match[1] === "start") start = Number(match[2]);
        else if (start !== undefined) { silences.push({ start, end: Number(match[2]) }); start = undefined; }
      }
      if (start !== undefined) silences.push({ start, end: source.duration });
      const result = { cues, silences }; await writeFile(cache, JSON.stringify(result)); return result;
    });
  }
  return { captions, boundaries, installModel, isBusy: (id) => [...busy.keys()].some((key) => key.startsWith(`${id}:`)), status: async () => ({ binaryReady: Boolean(whisper), modelReady: await verifyModel(), installing: Boolean(installation), model: "Whisper base multilingual · 142 MB", downloadedBytes, totalBytes: MODEL_BYTES }) };
}
