import { PLAYBACK_RATE, timelineDuration } from "./render-config.mjs";
import { normalizeCutTransition, resolveCutTransitions } from "./visual-style/cut-transitions.mjs";

export const TEASER_POLICY = "per-part-v1";
export const HOOK_PROMPT_VERSION = "same-part-hook-v1";
export const HOOK_TARGET_SECONDS = 5; // Rendered seconds, including the existing 1.25x speed.
export const mainRanges = (part) => part.segments.filter((s) => !s.isPadding);
export const hookRangeKey = (part) => JSON.stringify(mainRanges(part).map(({ start, end }) => [start, end]));
const text = (s, max = 1200) => typeof s === "string" && s.length <= max;
const inside = (time, part) => mainRanges(part).some((s) => time >= s.start && time <= s.end);

export const HOOK_SELECTION_POLICY="later-main-v1";
export const HOOK_MAIN_EXCLUSION_SECONDS=10;
export function permittedHookRanges(part){let elapsed=0;const out=[];for(const s of mainRanges(part)){const length=(s.end-s.start)/PLAYBACK_RATE;const skip=Math.max(0,HOOK_MAIN_EXCLUSION_SECONDS-elapsed)*PLAYBACK_RATE;if(skip<s.end-s.start)out.push({start:s.start+skip,end:s.end});elapsed+=length;}return out;}
export function hookNeedsReselection(part){const h=part.teaser;return h?.status==='selected'&&!permittedHookRanges(part).some(r=>h.start>=r.start-1e-7&&h.end<=r.end+1e-7);}
export function unavailableHook(part,reason){return{version:1,status:'unavailable',reason:String(reason).slice(0,1200),rangeKey:hookRangeKey(part),selectionPolicy:HOOK_SELECTION_POLICY};}
export function validateTeaser(part, sourceDuration = Infinity) {
  const h = part.teaser;
  if (h === undefined) return;
  const fail = () => { throw new Error(`Invalid teaser for Part ${part.id}.`); };
  if (!h || typeof h !== "object" || Array.isArray(h) || h.version !== 1) fail();
  const keys = ["selectionPolicy", "version", "status", "start", "end", "selection", "reason", "relation", "evidenceTimes", "limitations", "provider", "model", "promptVersion", "inputKey", "rangeKey", "transition"];
  if (Object.keys(h).some((key) => !keys.includes(key)) || !text(h.reason) || !h.reason.trim() || h.rangeKey !== hookRangeKey(part)) fail();
  if(h.selectionPolicy!==undefined&&h.selectionPolicy!==HOOK_SELECTION_POLICY)fail();
  if (h.status === "unavailable") {
    if (Object.keys(h).some((k) => !["version", "status", "reason", "rangeKey", "selectionPolicy"].includes(k))) fail();
    return;
  }
  if (h.status !== "selected" || !["ai", "fallback", "external-import"].includes(h.selection) || h.transition !== "inherit-or-dip-black") fail();
  if (![h.start, h.end].every(Number.isFinite) || h.start < 0 || h.end <= h.start || h.end > sourceDuration) fail();
  if (!mainRanges(part).some((s) => h.start >= s.start && h.end <= s.end)) fail();
  if(h.selectionPolicy===HOOK_SELECTION_POLICY&&hookNeedsReselection(part))fail();
  const duration = (h.end - h.start) / PLAYBACK_RATE;
  if ((part.segments[0].end - part.segments[0].start) / PLAYBACK_RATE * 30 < 2) fail();
  const longest = Math.max(...mainRanges(part).map((s) => (s.end - s.start) / PLAYBACK_RATE));
  if (duration < 0.5 || duration > 6.001 || (longest >= 4 && duration < 4 - 0.001)) fail();
  if (!text(h.relation) || !h.relation.trim() || !Array.isArray(h.evidenceTimes) || h.evidenceTimes.length > 12 || !h.evidenceTimes.every((t) => Number.isFinite(t) && inside(t, part))) fail();
  if (!Array.isArray(h.limitations) || h.limitations.length > 12 || !h.limitations.every((s) => text(s, 400))) fail();
  if (!text(h.provider, 100) || !text(h.model, 200) || h.promptVersion !== HOOK_PROMPT_VERSION || !text(h.inputKey, 64) || !/^[a-f0-9]{64}$/.test(h.inputKey)) fail();
  if (["ai", "external-import"].includes(h.selection) && (!h.provider || !h.model || !h.evidenceTimes.length)) fail();
  if (h.selection === "external-import" && !["gemini", "muse"].includes(h.provider)) fail();
}

export function fallbackTeaser(part, reason = "AI selection unavailable; semantic appeal is unverified.", cues = [], inputKey = "0".repeat(64)) {
  const ranges=permittedHookRanges(part);
  const cue=cues.find(c=>ranges.some(r=>c.start>=r.start&&c.end<=r.end)&&/[.!?。！？]$/.test(c.text?.trim()||'')&&(c.end-c.start)/PLAYBACK_RATE>=4&&(c.end-c.start)/PLAYBACK_RATE<=6);
  if(!cue)return unavailableHook(part,`${reason}: no coherent complete later cue fits beyond the first 10 rendered seconds of retained main content; main retained without teaser.`);
  const start=cue.start,end=cue.end;
  const h = { version: 1, selectionPolicy:HOOK_SELECTION_POLICY, status: "selected", start, end, selection: "fallback", reason,
    relation: "Excerpt retained in this part's main content; semantic relevance has not been verified by AI.",
    evidenceTimes: [start, end], limitations: ["Deterministic fallback, not AI-assisted selection.", ...(!cue ? ["Sentence/action boundary may be incomplete."] : []), ...((end - start) / PLAYBACK_RATE < 4 ? ["Short contiguous source range."] : [])],
    provider: "none", model: "none", promptVersion: HOOK_PROMPT_VERSION, inputKey, rangeKey: hookRangeKey(part), transition: "inherit-or-dip-black" };
  validateTeaser({ ...part, teaser: h }); return h;
}

// A stale selection is never replayed outside its newly locked main ranges.
// It is refreshed by the selection endpoint/render boundary, not by visual edits.
export function presentationSegments(part) {
  if (part.teaser?.rangeKey !== hookRangeKey(part) || part.teaser?.status !== "selected") return part.segments;
  validateTeaser(part);
  return [{ start: part.teaser.start, end: part.teaser.end, label: "Teaser", reason: part.teaser.reason }, ...part.segments];
}
export const presentationDuration = (part) => timelineDuration(presentationSegments(part));
export function hookTransitionId(part, ordinary, override) {
  if(override!==undefined&&!['rainbow-light-leak','dip-black','flash-white','none'].includes(override))throw Error("Invalid hook transition.");
  if(override!==undefined)return part.teaser?.status === "selected" && part.teaser.rangeKey===hookRangeKey(part)?override:"none";
  const id = normalizeCutTransition(ordinary);
  return part.teaser?.status === "selected" && part.teaser.rangeKey === hookRangeKey(part) ? (id === "none" ? "dip-black" : id) : "none";
}
export function partTransitionWindows(part, ordinary, override) {
  const segments = presentationSegments(part), hook = hookTransitionId(part, ordinary, override);
  if (hook === "none") return resolveCutTransitions(ordinary, segments).filter(w=>override===undefined||w.boundary!==1);
  return [
    ...resolveCutTransitions(hook, segments).filter((w) => w.boundary === 1).map((w) => ({ ...w, presetId: hook })),
    ...resolveCutTransitions(ordinary, segments).filter((w) => w.boundary !== 1),
  ];
}
