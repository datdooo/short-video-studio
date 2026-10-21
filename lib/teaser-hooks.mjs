import {checkHookSpeechBoundaries} from "./teaser-boundaries.mjs";
import {buildHookCandidates} from "./teaser-candidates.mjs";
import { PLAYBACK_RATE, timelineDuration } from "./render-config.mjs";
import { normalizeCutTransition, resolveCutTransitions } from "./visual-style/cut-transitions.mjs";

export const TEASER_POLICY = "per-part-v1";
export const LEGACY_HOOK_PROMPT_VERSION = "same-part-hook-v1";
export const HOOK_PROMPT_VERSION = "same-part-hook-v7-complete-speech";
export const HOOK_PREFERRED_MIN_SECONDS = 5;
export const HOOK_MAX_SECONDS = 9;
export function hookDurationLimits(playbackRate = PLAYBACK_RATE) {
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) throw new Error("Invalid hook playback speed.");
  return { playbackRate, preferredMinRenderedSeconds: HOOK_PREFERRED_MIN_SECONDS, maxRenderedSeconds: HOOK_MAX_SECONDS,
    preferredMinSourceSeconds: HOOK_PREFERRED_MIN_SECONDS * playbackRate, maxSourceSeconds: HOOK_MAX_SECONDS * playbackRate };
}
export const mainRanges = (part) => part.segments.filter((s) => !s.isPadding);
export const hookRangeKey = (part) => JSON.stringify(mainRanges(part).map(({ start, end }) => [start, end]));
const text = (s, max = 1200) => typeof s === "string" && s.length <= max;
const inside = (time, part) => mainRanges(part).some((s) => time >= s.start && time <= s.end);

export const LEGACY_HOOK_SELECTION_POLICY = "later-main-v1";
export const HOOK_SELECTION_POLICY = "adaptive-editorial-v3";
export const isLaterHookPolicy = policy => [LEGACY_HOOK_SELECTION_POLICY, HOOK_SELECTION_POLICY].includes(policy);
export const HOOK_MAIN_EXCLUSION_SECONDS=10;
export function permittedHookRanges(part, playbackRate = PLAYBACK_RATE){hookDurationLimits(playbackRate);let elapsed=0;const out=[];for(const s of mainRanges(part)){const length=(s.end-s.start)/playbackRate;const skip=Math.max(0,HOOK_MAIN_EXCLUSION_SECONDS-elapsed)*playbackRate;if(skip<s.end-s.start)out.push({start:s.start+skip,end:s.end});elapsed+=length;}return out;}
// The opening exclusion guides automated selection. Explicit manual timestamps
// may repeat the opening, but must still fit wholly within one retained main range.
export function hookNeedsReselection(part){const h=part.teaser;if(part.teaserEnabled===false)return false;const ranges=h?.selection==='manual'?mainRanges(part):permittedHookRanges(part);return h?.status==='selected'&&!ranges.some(r=>h.start>=r.start-1e-7&&h.end<=r.end+1e-7);}
export function unavailableHook(part,reason){return{version:1,status:'unavailable',reason:String(reason).slice(0,1200),rangeKey:hookRangeKey(part),selectionPolicy:HOOK_SELECTION_POLICY};}
export function validateTeaser(part, sourceDuration = Infinity) {
  if(part.teaserEnabled!==undefined&&typeof part.teaserEnabled!=='boolean')throw new Error(`Invalid teaser enabled flag for Part ${part.id}.`);
  // Disabled excerpts remain saved for editing; they are not rendered or used as
  // evidence. Re-enabling runs the ordinary validity gates before export.
  if(part.teaserEnabled===false)return;
  const h = part.teaser;
  if (h === undefined) return;
  const fail = () => { throw new Error(`Invalid teaser for Part ${part.id}.`); };
  if (!h || typeof h !== "object" || Array.isArray(h) || h.version !== 1) fail();
  const keys = ["alternatives", "candidateId", "kind", "partUnderstanding", "contentTypes", "observed", "startContext", "standalone", "complete", "endingBasis", "cueIds", "replayUse", "heatmapEvidence", "ending", "selectionPolicy", "version", "status", "start", "end", "selection", "reason", "relation", "evidenceTimes", "limitations", "provider", "model", "promptVersion", "inputKey", "rangeKey", "transition"];
  if (Object.keys(h).some((key) => !keys.includes(key)) || !text(h.reason) || !h.reason.trim() || h.rangeKey !== hookRangeKey(part)) fail();
  if(h.selectionPolicy!==undefined&&!isLaterHookPolicy(h.selectionPolicy))fail();
  if (h.status === "unavailable") {
    if (Object.keys(h).some((k) => !["version", "status", "reason", "rangeKey", "selectionPolicy"].includes(k))) fail();
    return;
  }
  if (h.status !== "selected" || !["ai", "fallback", "external-import", "manual"].includes(h.selection) || h.transition !== "inherit-or-dip-black") fail();
  if (![h.start, h.end].every(Number.isFinite) || h.start < 0 || h.end <= h.start || h.end > sourceDuration) fail();
  if (!mainRanges(part).some((s) => h.start >= s.start && h.end <= s.end)) fail();
  if(isLaterHookPolicy(h.selectionPolicy)&&hookNeedsReselection(part))fail();
  const duration = (h.end - h.start) / PLAYBACK_RATE;
  if ((part.segments[0].end - part.segments[0].start) / PLAYBACK_RATE * 30 < 2) fail();
  const longest = Math.max(...mainRanges(part).map((s) => (s.end - s.start) / PLAYBACK_RATE));
  const adaptive = h.selectionPolicy === HOOK_SELECTION_POLICY;
  if (duration < 0.5 || (adaptive ? h.end - h.start > hookDurationLimits().maxSourceSeconds : duration > 6.001 || (longest >= 4 && duration < 4 - 0.001))) fail();
  if (adaptive && (!text(h.ending) || !h.ending.trim())) fail();
  if (!text(h.relation) || !h.relation.trim() || !Array.isArray(h.evidenceTimes) || h.evidenceTimes.length > 12 || !h.evidenceTimes.every((t) => Number.isFinite(t) && inside(t, part) && (!adaptive || (t >= h.start && t <= h.end)))) fail();
  if (!Array.isArray(h.limitations) || h.limitations.length > 12 || !h.limitations.every((s) => text(s, 400))) fail();
  if (!text(h.provider, 100) || !text(h.model, 200) || !(adaptive ? [HOOK_PROMPT_VERSION,"same-part-hook-v6-impact-evidence","same-part-hook-v5-vietnamese","same-part-hook-v4-part-arc","same-part-hook-v3-editorial"].includes(h.promptVersion) : h.promptVersion===LEGACY_HOOK_PROMPT_VERSION) || !text(h.inputKey, 64) || !/^[a-f0-9]{64}$/.test(h.inputKey)) fail();
  if (["ai", "external-import"].includes(h.selection) && (!h.provider || !h.model || !h.evidenceTimes.length)) fail();
  if (h.selection === "external-import" && !["gemini", "muse"].includes(h.provider)) fail();
  if(adaptive&&['ai','external-import'].includes(h.selection)){
    if(!['speech','action','mixed'].includes(h.kind)||!['speech','visible-state','continuous-video'].includes(h.endingBasis)||!['not-used','supports-context'].includes(h.replayUse)||!['candidateId','kind','partUnderstanding','contentTypes','observed','startContext','endingBasis','replayUse'].every(k=>text(h[k])&&h[k].trim())||h.standalone!==true||h.complete!==true||!Array.isArray(h.cueIds)||h.cueIds.length>32||!h.cueIds.every(v=>text(v,100)))fail();
  }
  if(h.heatmapEvidence!==undefined){const e=h.heatmapEvidence;if(!e||Object.keys(e).some(k=>!['available','supportsSelection','peakTimes','reason'].includes(k))||typeof e.available!=='boolean'||typeof e.supportsSelection!=='boolean'||!text(e.reason)||!Array.isArray(e.peakTimes)||e.peakTimes.length>6||!e.peakTimes.every(t=>Number.isFinite(t)&&t>=h.start&&t<=h.end)||(!e.available&&e.supportsSelection))fail();}
  if(h.alternatives!==undefined){if(!Array.isArray(h.alternatives)||h.alternatives.length>2)fail();for(const choice of h.alternatives){if(!choice||typeof choice!=='object'||Array.isArray(choice)||Object.keys(choice).some(k=>!['start','end','reason','relation','ending','evidenceTimes','limitations','candidateId','kind','partUnderstanding','contentTypes','observed','startContext','standalone','complete','endingBasis','cueIds','replayUse'].includes(k)))fail();validateTeaser({...part,teaser:{...h,...choice,heatmapEvidence:undefined,alternatives:undefined}},sourceDuration);}}

}

export function hookCandidates(part,cues=[],playbackRate=PLAYBACK_RATE,signals={}) {
  return buildHookCandidates(permittedHookRanges(part,playbackRate),cues,playbackRate,hookDurationLimits(playbackRate).maxSourceSeconds,signals);
}
export function fallbackTeaser(part, reason = "AI selection unavailable; semantic appeal is unverified.", cues = [], inputKey = "0".repeat(64)) {
  const eligible=hookCandidates(part,cues).filter(c=>c.kind==='speech');
  // Without semantic analysis, do not let earliest/longest or keyword scores
  // masquerade as a winner among many meaningful alternatives.
  const candidate=eligible.length===1?eligible[0]:undefined;
  if(!candidate)return unavailableHook(part,`${reason}: no coherent evidence-backed later excerpt within 9 rendered seconds beyond the first 10 rendered seconds of retained main content; main retained without teaser.`);
  const {start,end}=candidate;
  const h = { version: 1, selectionPolicy:HOOK_SELECTION_POLICY, status: "selected", start, end, selection: "fallback",
    reason: `${reason}. Transcript proposal ${start}–${end}s: “${candidate.text.slice(0,300)}”. Punctuation-delimited thought; strongest available moment is NOT editorially verified.`.slice(0,1200),
    relation: "Excerpt retained in this part's main content; standalone meaning and semantic relevance require review.", ending:candidate.boundaryEvidence,
    evidenceTimes: [start, end], limitations: ["Deterministic fallback, not AI-assisted selection; editorial quality unverified.","Cue alignment/punctuation cannot establish semantic completeness or an action ending."],
    provider: "none", model: "none", promptVersion: HOOK_PROMPT_VERSION, inputKey, rangeKey: hookRangeKey(part), transition: "inherit-or-dip-black" };
  validateTeaser({ ...part, teaser: h }); return h;
}

// A stale selection is never replayed outside its newly locked main ranges.
// It is refreshed by the selection endpoint/render boundary, not by visual edits.
export function presentationSegments(part) {
  if(part.teaserEnabled===false)return part.segments;
  if (part.teaser?.rangeKey !== hookRangeKey(part) || part.teaser?.status !== "selected") return part.segments;
  // Loading/re-enabling an old invalid excerpt must leave the editor usable.
  // Readiness reports the error and blocks export while that teaser is enabled.
  try{validateTeaser(part);}catch{return part.segments;}
  return [{ start: part.teaser.start, end: part.teaser.end, label: "Teaser", reason: part.teaser.reason }, ...part.segments];
}
export const presentationDuration = (part) => timelineDuration(presentationSegments(part));
export function hookTransitionId(part, ordinary, override) {
  if(override!==undefined&&!['rainbow-light-leak','vr-light-leak-v2','dip-black','flash-white','none'].includes(override))throw Error("Invalid hook transition.");
  if(part.teaserEnabled===false||presentationSegments(part)===part.segments)return "none";
  if(override!==undefined)return part.teaser?.status === "selected" && part.teaser.rangeKey===hookRangeKey(part)?override:"none";
  const id = normalizeCutTransition(ordinary);
  return part.teaser?.status === "selected" && part.teaser.rangeKey === hookRangeKey(part) ? (id === "none" ? "dip-black" : id) : "none";
}
export function partTransitionWindows(part, ordinary, override) {
  const segments = presentationSegments(part), hook = hookTransitionId(part, ordinary, override);
  if (hook === "none") return resolveCutTransitions(ordinary, segments).filter(w=>override===undefined||segments===part.segments||w.boundary!==1);
  return [
    ...resolveCutTransitions(hook, segments).filter((w) => w.boundary === 1).map((w) => ({ ...w, presetId: hook })),
    ...resolveCutTransitions(ordinary, segments).filter((w) => w.boundary !== 1),
  ];
}

const choiceKeys=['start','end','reason','relation','ending','evidenceTimes','limitations','candidateId','kind','partUnderstanding','contentTypes','observed','startContext','standalone','complete','endingBasis','cueIds','replayUse'];
export function chooseTeaserAlternative(part,index){
 const h=part.teaser,choice=h?.status==='selected'&&h.alternatives?.[index];if(!choice)throw Error('No cached alternative.');
 const current=Object.fromEntries(choiceKeys.filter(k=>h[k]!==undefined).map(k=>[k,h[k]]));
 const next={...part,teaser:structuredClone({...h,...choice,heatmapEvidence:{available:h.heatmapEvidence?.available||false,supportsSelection:false,peakTimes:[],reason:'Cached alternative selected; replay support must be reviewed from its reason.'},alternatives:[current,...h.alternatives.filter((_,i)=>i!==index)].slice(0,2)})};validateTeaser(next);return next;
}
export function adjustTeaserRange(part,start,end,cues=[]){
 checkHookSpeechBoundaries({start,end},cues);
 const h={version:1,status:'selected',selection:'manual',selectionPolicy:HOOK_SELECTION_POLICY,start,end,reason:'Mốc nguồn do người dùng chọn; cần tự kiểm tra sức hấp dẫn và trọn nghĩa.',relation:'Nằm trong main của đúng part; lần xuất hiện gốc vẫn được giữ.',ending:'Biên do người dùng chỉnh; AI chưa xác minh câu nói hoặc hành động đã kết thúc trọn vẹn.',evidenceTimes:[start,end],limitations:['Chọn mốc thủ công, không phải kết quả AI.'],provider:'user',model:'manual',promptVersion:HOOK_PROMPT_VERSION,inputKey:'0'.repeat(64),rangeKey:hookRangeKey(part),transition:'inherit-or-dip-black'};
 const next={...part,teaser:h};validateTeaser({...next,teaserEnabled:true});return next;
}

// Export readiness is stricter than legacy plan loading. Enabled parts require a
// valid hook; an explicit per-part opt-out preserves the saved excerpt unchanged.
export function teaserReadiness(plan,sourceDuration=Infinity,cues=[]){
 if(!Array.isArray(plan?.parts)||plan.parts.length!==2)return[{partId:0,reason:'Cần đúng hai Part; Part bật teaser phải có teaser hợp lệ.'}];
 const issues=[];
 for(const [index,part]of plan.parts.entries()){
  const partId=part.id||index+1,h=part.teaser;
  if(part.teaserEnabled===false)continue;
  let reason='';
  if(part.teaserEnabled!==undefined&&typeof part.teaserEnabled!=='boolean')reason='Trạng thái bật/tắt teaser không hợp lệ.';
  else if(!h||h.status!=='selected')reason='Thiếu teaser. Chọn lại bằng AI, nhập mốc nguồn hoặc chủ động tắt teaser trong Timeline.';
  else if(part.teaserNeedsReselection)reason='Main đã đổi; cần chọn/sửa teaser trước khi xuất.';
  else if(hookNeedsReselection(part))reason=h.selection==='manual'?'Teaser nằm ngoài một range main được giữ.':'Teaser AI chạm 10 giây rendered đầu main hoặc nằm ngoài một range main được giữ.';
  else try{
   validateTeaser(part,sourceDuration);
   if(h.end-h.start>hookDurationLimits().maxSourceSeconds)throw Error('Duration');
   checkHookSpeechBoundaries(h,cues);
  }catch{reason='Teaser không hợp lệ: kiểm tra mốc nguồn, main/gap, biên lời nói và tối đa 9 giây rendered.';}
  if(reason)issues.push({partId,reason});
 }
 return issues;
}
export function requireBothTeasers(plan,sourceDuration=Infinity,cues=[]){
 const issues=teaserReadiness(plan,sourceDuration,cues);
 if(issues.length)throw Object.assign(new Error(issues.map(i=>`Part ${i.partId}: ${i.reason}`).join(' ')),{code:'TEASER_REQUIRED',status:409});
}
