import {partContextWindows,candidateFrameTimes} from "../lib/teaser-candidates.mjs";
import { checkHookSpeechBoundaries } from "../lib/teaser-boundaries.mjs";
import { HOOK_SCHEMA, HOOK_INSTRUCTIONS, validateHookResponse, validateEditorialEvidence, replayEvidence } from "../lib/teaser-prompt.mjs";
export { HOOK_SCHEMA, HOOK_INSTRUCTIONS };
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { hookCandidates,hookDurationLimits,HOOK_SELECTION_POLICY,permittedHookRanges,unavailableHook,TEASER_POLICY, HOOK_PROMPT_VERSION, mainRanges, hookRangeKey, fallbackTeaser, validateTeaser } from "../lib/teaser-hooks.mjs";

const clean = (s, max) => String(s || "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, max);
import { validateHeatmap } from "../lib/source-context/heatmap.mjs";

const hash = (s) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
export function hookInput(part, source, cues = [], supporting = {}) {
  const allRanges = mainRanges(part), ranges=allRanges.slice(0,200), permitted=permittedHookRanges(part).slice(0,200);
  const available = cues.slice(0, 20_000).filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && ranges.some((s) => c.start < s.end && c.end > s.start));
  const bounded = available.length > 120 ? Array.from({ length: 120 }, (_, i) => available[Math.floor(i * available.length / 120)]) : available;
  const heatmap = validateHeatmap(supporting.heatmap, { durationMs: Math.round(source.duration * 1000) });
  const relevantBins = heatmap?.status === 'available' ? heatmap.bins.filter(b => ranges.some(r => b.startMs < r.end * 1000 && b.endMs > r.start * 1000)) : [];
  // Bounded evidence summary; actual peak proposals are built by hookCandidates.
  const replayBins = relevantBins.length > 24 ? Array.from({ length: 24 }, (_, i) => relevantBins[Math.floor(i * relevantBins.length / 24)]) : relevantBins;
  return { sourceTitle: clean(source.title, 500), partTitle: clean(part.title, 500), partContext: clean(part.hook, 500), partId: part.id,
    durationLimits:hookDurationLimits(),contextWindows:partContextWindows(ranges,cues),transcriptCandidates:hookCandidates(part,cues,undefined,{...supporting,heatmap,sourceDurationMs:Math.round(source.duration*1000)}),selectionPolicy:HOOK_SELECTION_POLICY,mainContentRanges:allRanges.map(({start,end})=>({start,end})),excludedMainPresentationSeconds:10,permittedHookRanges:permitted,
    allowedRanges: permitted.map(({ start, end }) => ({ start, end })),
    transcript: bounded.map((c) => ({ start: c.start, end: c.end, text: clean(c.text, 180) })),
    untimedTranscript: available.length ? "" : clean(source.transcript, 6000),
    supporting: { ...(replayBins.length ? { heatmap: { timeline: 'source', timeUnit: 'ms', intensitySemantics: 'relative-replay-interest', bins: replayBins } } : {}), chapters: Array.isArray(supporting.chapters) ? supporting.chapters.slice(0, 20).map((c) => ({ startMs: c.startMs, endMs: c.endMs, title: clean(c.title, 100) })) : [],
      description: clean(supporting.description, 1500), commentClusters: Array.isArray(supporting.commentClusters) ? supporting.commentClusters.filter((c) => ranges.some((r) => c.centerMs / 1000 >= r.start && c.centerMs / 1000 <= r.end)).slice(0, 12).map((c) => ({ centerMs: c.centerMs, score: c.score })) : [] },
    missing: [...(!available.length ? ["No timestamped transcript; do not infer speech/audio meaning."] : []), ...(available.length > 120 || allRanges.length > 200 || cues.length > 20_000 ? ["Context was bounded/sampled."] : [])],
  };
}
export function hookFailure(error) {
  const status = error?.status;
  const message = String(error?.message || "");
  if (/AUTH_REQUIRED|AUTH_EXPIRED|PLAN_USAGE_DISABLED/.test(message)) return "provider-auth-unavailable";
  if (status === 429 || /RATE_LIMITED|PLAN_LIMIT_REACHED/.test(message)) return "provider-rate-limited";
  if (status === 404 || /MODEL_UNAVAILABLE/.test(message)) return "provider-model-unavailable";
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "provider-timeout";
  return "provider-response-invalid-or-unavailable"; // Never leak remote errors, credentials or payloads.
}

export function createTeaserSelector({ cacheRoot, resolveProvider, frames = async () => [], fingerprint, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const pending = new Map();
  async function selectPart(part, source, cues, boundaryCues, supporting, provider, sourceHash, signal, providerFailure, maxAttempts = 2, customInstruction) {
    const input = hookInput(part, source, cues, supporting);
    if(customInstruction)input.customTeaserRequest=customInstruction;
    // Edited/rounded transcript text remains authoritative for meaning, while
    // source caption timing still protects known speech from being split.
    input.speechBoundaryCues = boundaryCues.slice(0, 20_000).filter(c =>
      Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start && c.end-c.start <= 10 && String(c.text || '').trim() &&
      input.allowedRanges.some(r => c.start < r.end && c.end > r.start)
    ).slice(0, 240).map(({start,end}) => ({start,end}));
    const key = hash({ version: HOOK_PROMPT_VERSION, sourceHash, sourceId: source.id, transcriptHash: hash(source.transcript || ""), ranges: hookRangeKey(part), input, provider: provider?.id || "none", model: provider?.model || "none", frames: "candidate-local-9x512-v3" });
    const file = path.join(cacheRoot, `${key}.json`);
    try {
      const cached = JSON.parse(await readFile(file, "utf8"));
      validateTeaser({ ...part, teaser: cached.teaser }, source.duration);
      checkHookSpeechBoundaries(cached.teaser, boundaryCues);
      if (cached.teaser.promptVersion === HOOK_PROMPT_VERSION && cached.teaser.selectionPolicy === HOOK_SELECTION_POLICY && cached.teaser.inputKey === key && (cached.teaser.selection === "ai" || Date.now() - cached.at < 60_000)) return cached.teaser;
    } catch { /* Missing/invalid cache is not selection evidence. */ }
    if (pending.has(key)) return structuredClone(await pending.get(key));
    const task = (async () => {
      let result, failure = providerFailure || "provider-not-configured";
      if(!input.allowedRanges.some(r=>(r.end-r.start)/hookDurationLimits().playbackRate>=.5))return unavailableHook(part,"No eligible later hook after the first 10 rendered seconds of retained main content.");
      if (provider) {
        let images = [];
        try { images = await frames(part, source, signal, candidateFrameTimes(input.transcriptCandidates)); } catch { input.missing.push("Representative frames unavailable."); }
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          signal?.throwIfAborted();
          try {
            const response = await provider.analyze({ input: { ...input, ...(attempt ? { retry: "Previous selection was invalid or split known speech; recheck all bounds and choose complete timed cues." } : {}) }, images, instructions: HOOK_INSTRUCTIONS+(customInstruction?"\nUSER CUSTOM REQUEST is a strict footage-search constraint, not a request to create speech/images. Select ONLY an excerpt matching customTeaserRequest in this retained part. If the requested event cannot be established with available speech/visual evidence, return unavailable with a clear reason. Never substitute an unrelated attractive moment. Explain the observed match in reason/relation. Sparse images cannot prove the largest catch or a complete action without evidence.":""), maxTokens:3000, schema: HOOK_SCHEMA, signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(90_000)]) });
            const value = validateHookResponse(response.value);
            if(value.start===null&&value.end===null&&typeof value.reason==='string'&&value.reason.trim())return unavailableHook(part,value.reason);
            validateEditorialEvidence(value,{candidates:input.transcriptCandidates,images,cues});
            for(const choice of value.alternatives){validateEditorialEvidence(choice,{candidates:input.transcriptCandidates,images,cues});checkHookSpeechBoundaries(choice,boundaryCues);}
            checkHookSpeechBoundaries(value,boundaryCues);
            if (!value || Object.keys(value).some((k) => !HOOK_SCHEMA.required.includes(k))) throw new Error("INVALID_RESPONSE");
            result = { ...value, limitations: [...(Array.isArray(value.limitations) ? value.limitations : []), ...input.missing, ...(!images.length ? ["Text only: visual/action evidence was not analyzed."] : ["Sparse still frames only; audio/video input not verified."])].slice(0, 12),
              heatmapEvidence:replayEvidence(value,input.transcriptCandidates,supporting.heatmap),version: 1, selectionPolicy:HOOK_SELECTION_POLICY, status: "selected", selection: "ai", provider: provider.id, model: provider.model, promptVersion: HOOK_PROMPT_VERSION, inputKey: key, rangeKey: hookRangeKey(part), transition: "inherit-or-dip-black" };
            validateTeaser({ ...part, teaser: result }, source.duration);
            break;
          } catch (error) {
            result = undefined;
            if (signal?.aborted) throw signal.reason;
            failure = hookFailure(error);
            if (["provider-auth-unavailable", "provider-model-unavailable"].includes(failure)) break;
            if (error.status === 400 && images.length) { images = []; input.missing.push("Configured model rejected image/structured request; retry used text only."); }
            else if (failure === "provider-rate-limited") {
              const delay = Number(error.retryAfterMs ?? 1000);
              if (!Number.isFinite(delay) || delay > 5000) break;
              await sleep(Math.max(0, delay));
            }
          }
        }
      }
      result ||= customInstruction?unavailableHook(part,"Không tìm được Custom Teaser có bằng chứng phù hợp ("+failure+"). Teaser hiện tại được giữ; không thay bằng fallback."):fallbackTeaser(part, failure, boundaryCues, key);
      try {
        await mkdir(cacheRoot, { recursive: true, mode: 0o700 });
        await writeFile(file, JSON.stringify({ at: Date.now(), teaser: result }), { mode: 0o600 });
        const entries = (await readdir(cacheRoot)).filter((f) => /^[a-f0-9]{64}\.json$/.test(f));
        for (const name of entries.filter((f) => f !== `${key}.json`).slice(0, Math.max(0, entries.length - 256))) await unlink(path.join(cacheRoot, name)).catch(() => {});
      } catch { /* Cache is best effort; do not discard an otherwise valid selection. */ }
      return result;
    })();
    pending.set(key, task);
    try { return structuredClone(await task); } finally { pending.delete(key); }
  }
  return async function select(plan, source, { cues = [], boundaryCues = cues, supporting = {}, signal, targetPartId, maxAttempts = 2, customInstruction } = {}) {
    signal?.throwIfAborted();
    let provider, providerFailure;
    try { provider = await resolveProvider(signal); } catch (e) { providerFailure = hookFailure(e); }
    const sourceHash = await fingerprint(source, signal);
    const result = structuredClone(plan);
    if(plan.teaserPolicy===undefined&&!plan.parts.some(p=>p.teaser)&&plan.hookTransition===undefined)result.hookTransition="vr-light-leak-v2";
    result.teaserPolicy = TEASER_POLICY;
    // Sequential parts bound provider cost/concurrency and never share context.
    for (const part of result.parts) if((targetPartId===undefined||targetPartId===part.id)&&(!part.customTeaser||customInstruction)){part.teaserNeedsReselection=false;part.teaser = await selectPart(part, source, cues, boundaryCues, supporting, provider, sourceHash, signal, providerFailure, Math.min(2,Math.max(1,maxAttempts)),customInstruction);}
    return result;
  };
}
