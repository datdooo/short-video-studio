import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import {createMediaResources} from "./media-resources.mjs";
import {createSharedOperations} from "./shared-operation.mjs";
import {requireDiskSpace} from "./analysis-cache.mjs";
import { parseCaptions, sourceCaptionTrack } from "../lib/subtitles.mjs";

const MODEL_SHA = '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b';
const MODEL_NAME = 'ggml-small.bin';
const MODEL_BYTES = 487601967;
const ASR_ID = `whisper.cpp:small:multilingual:transcribe:${MODEL_SHA}:cues-v1`;
const CAPTION_FILE = 'speech-captions-small-v1.json';

export function createSpeechService({ dataRoot, sourcesRoot, ffmpeg, whisper, run, resources=createMediaResources() }) {
  const model = path.join(dataRoot, "models", MODEL_NAME);
  const busy = new Map(),shared=createSharedOperations(); let installation; let modelVerified = false; let downloadedBytes = 0;
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
      await requireDiskSpace(path.dirname(model),MODEL_BYTES+256*1024*1024);
      const temporary = `${model}.${randomUUID()}.partial`;
      try {
        downloadedBytes = 0;
        const response = await fetch(`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}`, { signal: AbortSignal.timeout(1_800_000) });
        if (!response.ok) throw new Error(`Không tải được model Whisper (${response.status}).`);
        const hash = createHash("sha256");
        const meter = new Transform({ transform(chunk, encoding, callback) { hash.update(chunk); downloadedBytes += chunk.length; if(downloadedBytes>MODEL_BYTES)return callback(new Error("Model Whisper vượt kích thước dự kiến; không sử dụng file này.")); callback(null, chunk); } });
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
    const cached = path.join(directory, CAPTION_FILE);
    const readCurrent=async()=>{
      try{
        const saved=JSON.parse(await readFile(cached,'utf8'));
        if(saved.asrIdentity!==ASR_ID)return null;
        return sourceCaptionTrack(saved,source);
      }catch{return null;}
    };
    if(!regenerate){const saved=await readCurrent();if(saved)return saved;}
    if (!source.hasAudio) return sourceCaptionTrack({ sourceId: source.id, cues: [], origin: "no-audio" }, source);
    return shared(`${source.id}:${ASR_ID}:${resources.ownsLease?.()?'leased':'queued'}`,active=>{
      const id=`${source.id}:${ASR_ID}`;
      const task=resources.use('analysis',async resourceSignal=>{
        const bounded=AbortSignal.any([active,...(resourceSignal?[resourceSignal]:[]),AbortSignal.timeout(1_800_000)]);
        bounded.throwIfAborted();
        if(!regenerate){const saved=await readCurrent();if(saved)return saved;}
        if (!whisper || !await verifyModel()) throw new Error("Cần tải model Whisper small đa ngôn ngữ (465 MiB, một lần) trong Auto Subtitle. Không tự dùng model base cũ. Video không gửi lên dịch vụ ngoài.");
        await mkdir(directory,{recursive:true});
        await requireDiskSpace(directory,256*1024*1024+Math.ceil(source.duration*32000));
        const stem=path.join(directory,`speech-small-${randomUUID()}`),wav=stem+'.wav',temporaryCache=`${cached}.${randomUUID()}.partial`;
        try{
          await run(ffmpeg,["-y","-i",source.mediaPath,"-vn","-ar","16000","-ac","1","-c:a","pcm_s16le",wav],{signal:bounded});
          // Multilingual transcription (-l auto), no --translate/-tr. Two CPU
          // threads/one processor; whole ASR holds the shared heavy-task lease.
          await run(whisper,["-t","2","-p","1","-m",model,"-f",wav,"-l","auto","-osrt","-of",stem,"-ml","24","-sow","-sns"],{signal:bounded});
          const result=sourceCaptionTrack({sourceId:source.id,cues:parseCaptions(await readFile(stem+'.srt','utf8')),origin:'whisper-local-small'},source);
          if(!result.cues.length)throw Error('Whisper small không trả phụ đề. Không tự dùng kết quả/model cũ; kiểm tra audio hoặc tạo lại.');
          bounded.throwIfAborted();
          await writeFile(temporaryCache,JSON.stringify({...result,asrIdentity:ASR_ID}),{mode:0o600});
          await rename(temporaryCache,cached);return result;
        }finally{await unlink(wav).catch(()=>{});await unlink(stem+'.srt').catch(()=>{});await unlink(temporaryCache).catch(()=>{});}
      },active);
      const tracked=task.finally(()=>{if(busy.get(id)===tracked)busy.delete(id);});
      busy.set(id,tracked);return tracked;
    },signal);
  }
  // Read-only compatibility for already saved context/old plans; never label a
  // base/unknown cache as small, never run ASR just to inspect existing evidence.
  async function cachedCaptions(source){
    for(const name of [CAPTION_FILE,'speech-captions.json'])try{
      const value=JSON.parse(await readFile(path.join(sourcesRoot,source.id,name),'utf8'));
      if(name===CAPTION_FILE&&value.asrIdentity!==ASR_ID)continue;
      return sourceCaptionTrack({...value,sourceId:value.sourceId??source.id},source);
    }catch{/* Try legacy evidence only; no model/provider work. */}
    return null;
  }

  async function boundaries(source,signal) {
    return once(source, "boundaries", async () => {
      const cache = path.join(sourcesRoot, source.id, "speech-boundaries.json");
      const raw = source.captions?.length ? { sourceId: source.id, cues: source.captions, origin: "youtube" } : await cachedCaptions(source) || { cues: [] };
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
  return { captions, cachedCaptions, boundaries, installModel, isBusy: (id) => [...busy.keys()].some((key) => key.startsWith(`${id}:`)), status: async () => ({ binaryReady: Boolean(whisper), modelReady: await verifyModel(), installing: Boolean(installation), backend:"whisper.cpp / whisper-cli",modelId:MODEL_NAME,cacheIdentity:ASR_ID,model: "Whisper small multilingual · 465 MiB", downloadedBytes, totalBytes: MODEL_BYTES }) };
}
