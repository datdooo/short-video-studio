import {explainInVietnamese} from './explanation-language.mjs';
import {checkHookSpeechBoundaries} from "./teaser-boundaries.mjs";
import {buildHookCandidates} from "./teaser-candidates.mjs";
import { PLAYBACK_RATE, timelineDuration } from "./render-config.mjs";
import { normalizeCutTransition, resolveCutTransitions } from "./visual-style/cut-transitions.mjs";
import {MAX_SOURCE_RANGES,validSourceRange} from './source-ranges.mjs';

export const TEASER_POLICY = "per-part-v1";
export const LEGACY_HOOK_PROMPT_VERSION = "same-part-hook-v1";
export const HOOK_PROMPT_VERSION = "same-part-hook-v12-text-reselection";
export const HOOK_PREFERRED_MIN_SECONDS = 5;
export const HOOK_MAX_SECONDS = 9;
export function hookDurationLimits(playbackRate = PLAYBACK_RATE) {
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) throw new Error("Invalid hook playback speed.");
  return { playbackRate, minRenderedSeconds:0.5, minSourceSeconds:0.5*playbackRate, preferredMinRenderedSeconds: HOOK_PREFERRED_MIN_SECONDS, maxRenderedSeconds: HOOK_MAX_SECONDS,
    preferredMinSourceSeconds: HOOK_PREFERRED_MIN_SECONDS * playbackRate, maxSourceSeconds: HOOK_MAX_SECONDS * playbackRate };
}
// Source endpoints stay untouched. Apply export speed exactly once; neither
// preview 1x nor an overlapping transition adds duration to this excerpt.
export function hookDurationCheck(start,end,playbackRate=PLAYBACK_RATE){
 const limits=hookDurationLimits(playbackRate),finite=Number.isFinite(start)&&Number.isFinite(end);
 const sourceSeconds=finite?end-start:null,renderedSeconds=finite?sourceSeconds/playbackRate:null;
 const violation=!finite||end<=start?'invalid-range':sourceSeconds<limits.minSourceSeconds?'minimum':sourceSeconds>limits.maxSourceSeconds?'maximum':null;
 return{valid:violation===null,violation,clock:'source',timeUnit:'seconds',start:finite?start:null,end:finite?end:null,sourceSeconds,renderedSeconds,playbackRate,minSourceSeconds:limits.minSourceSeconds,maxSourceSeconds:limits.maxSourceSeconds,minRenderedSeconds:limits.minRenderedSeconds,maxRenderedSeconds:limits.maxRenderedSeconds};
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
function retainedManualMainContext(part,sourceDuration=Infinity){
 const h=part.teaser,context=h?.binding?.manualMainContext;
 if(!context||context.version!==1||Object.keys(context).some(k=>!['version','originalRanges','rangeKey'].includes(k))
   ||!['ai','external-import'].includes(h.selection)||(part.mainEdited!==true&&part.manualLocked!==true)
   ||part.startTrimApplied!==true||part.smartCutApplied!==true||context.rangeKey!==hookRangeKey(part)
   ||!Array.isArray(context.originalRanges)||!context.originalRanges.length||context.originalRanges.length>MAX_SOURCE_RANGES)return false;
 let previousEnd=0;
 for(const range of context.originalRanges){
   if(!Array.isArray(range)||range.length!==2||!validSourceRange({start:range[0],end:range[1]},sourceDuration)||range[0]<previousEnd)return false;
   previousEnd=range[1];
 }
 return context.originalRanges.some(([start,end])=>h.start>=start&&h.end<=end);
}
// Re-running MAIN preserves a previously validated selection, not a claim that
// the model selected it against the new MAIN. Original evidence stays bound.
function retainedAutoMainContext(part,sourceDuration=Infinity){
 const h=part.teaser,context=h?.binding?.retainedMainContext;
 if(!context||context.version!==1||Object.keys(context).some(k=>!['version','originalRanges','rangeKey','requestKey','partTitle','partContext'].includes(k))
   ||!['ai','external-import'].includes(h.selection)||part.startTrimApplied!==true||part.smartCutApplied!==true
   ||context.rangeKey!==hookRangeKey(part)||!text(context.partTitle,2000)||!text(context.partContext,2000)
   ||!text(context.requestKey,64)||!/^[a-f0-9]{64}$/.test(context.requestKey)
   ||!Array.isArray(context.originalRanges)||!context.originalRanges.length||context.originalRanges.length>MAX_SOURCE_RANGES)return false;
 let previousEnd=0;
 for(const range of context.originalRanges){
   if(!Array.isArray(range)||range.length!==2||!validSourceRange({start:range[0],end:range[1]},sourceDuration)||range[0]<previousEnd)return false;
   previousEnd=range[1];
 }
 return context.originalRanges.some(([start,end])=>h.start>=start&&h.end<=end);
}
// MAIN containment/opening exclusions belong to automated selections only.
// Manual excerpts use the same source clock, independently of retained MAIN.
export function hookNeedsReselection(part){const h=part.teaser;if(part.teaserEnabled===false||h?.selection==='manual')return false;const ranges=retainedManualMainContext(part)||retainedAutoMainContext(part)?mainRanges(part):permittedHookRanges(part);return h?.status==='selected'&&!ranges.some(r=>h.start>=r.start-1e-7&&h.end<=r.end+1e-7);}
export function unavailableHook(part,reason){return{version:1,status:'unavailable',reason:String(reason).slice(0,1200),rangeKey:hookRangeKey(part),selectionPolicy:HOOK_SELECTION_POLICY};}
export function validateTeaser(part, sourceDuration = Infinity, sourceId) {
  if(part.teaserEnabled!==undefined&&typeof part.teaserEnabled!=='boolean')throw new Error(`Invalid teaser enabled flag for Part ${part.id}.`);
  // Disabled excerpts remain saved for editing; they are not rendered or used as
  // evidence. Re-enabling runs the ordinary validity gates before export.
  if(part.teaserEnabled===false)return;
  const h = part.teaser;
  if (h === undefined) return;
  const fail = () => { throw new Error(`Invalid teaser for Part ${part.id}.`); };
  if (!h || typeof h !== "object" || Array.isArray(h) || h.version !== 1) fail();
  const manual=h.status==='selected'&&h.selection==='manual';
  const keys = ["manualSourceId", "editedFrom", "binding", "alternatives", "candidateId", "kind", "partUnderstanding", "contentTypes", "observed", "startContext", "standalone", "complete", "endingBasis", "cueIds", "replayUse", "heatmapEvidence", "ending", "selectionPolicy", "version", "status", "start", "end", "selection", "reason", "relation", "evidenceTimes", "limitations", "provider", "model", "promptVersion", "inputKey", "rangeKey", "transition"];
  if (Object.keys(h).some((key) => !keys.includes(key)) || !text(h.reason) || !h.reason.trim() || typeof h.rangeKey!=='string' || (!manual&&h.rangeKey !== hookRangeKey(part))) fail();
  // Legacy manual plans inherit their owning session/job source. New manual
  // choices also carry an explicit source ID through restore and job snapshots.
  if(h.manualSourceId!==undefined&&(!manual||!text(h.manualSourceId,100)||!h.manualSourceId.trim()))fail();
  if(manual&&sourceId&&h.manualSourceId!==undefined&&h.manualSourceId!==sourceId)throw Error(`Part ${part.id}: teaser thủ công thuộc video nguồn khác.`);
  if(h.selectionPolicy!==undefined&&!isLaterHookPolicy(h.selectionPolicy))fail();
  if (h.status === "unavailable") {
    if (Object.keys(h).some((k) => !["version", "status", "reason", "rangeKey", "selectionPolicy"].includes(k))) fail();
    return;
  }
  if (h.status !== "selected" || !["ai", "fallback", "external-import", "manual"].includes(h.selection) || h.transition !== "inherit-or-dip-black") fail();
  if (![h.start, h.end].every(Number.isFinite) || h.start < 0 || h.end <= h.start || h.end > sourceDuration) fail();
  if (!manual&&!mainRanges(part).some((s) => h.start >= s.start && h.end <= s.end)) fail();
  if(isLaterHookPolicy(h.selectionPolicy)&&hookNeedsReselection(part))fail();
  const duration = (h.end - h.start) / PLAYBACK_RATE;
  if (!manual&&(part.segments[0].end - part.segments[0].start) / PLAYBACK_RATE * 30 < 2) fail();
  const longest = Math.max(...mainRanges(part).map((s) => (s.end - s.start) / PLAYBACK_RATE));
  const adaptive = h.selectionPolicy === HOOK_SELECTION_POLICY;
  if (!manual&&(adaptive ? !hookDurationCheck(h.start,h.end).valid : duration < hookDurationLimits().minRenderedSeconds || duration > 6.001 || (longest >= 4 && duration < 4 - 0.001))) fail();
  if (adaptive && (!text(h.ending) || !h.ending.trim())) fail();
  if (!text(h.relation) || !h.relation.trim() || !Array.isArray(h.evidenceTimes) || h.evidenceTimes.length > 12 || !h.evidenceTimes.every((t) => Number.isFinite(t) && (manual?t>=h.start&&t<=h.end:inside(t, part) && (!adaptive || (t >= h.start && t <= h.end))))) fail();
  if (!Array.isArray(h.limitations) || h.limitations.length > 12 || !h.limitations.every((s) => text(s, 400))) fail();
  if (!text(h.provider, 100) || !text(h.model, 200) || !(adaptive ? [HOOK_PROMPT_VERSION,"same-part-hook-v10-evidence-discovery","same-part-hook-v9-ranked-selection","same-part-hook-v8-timing-provenance","same-part-hook-v7-complete-speech","same-part-hook-v6-impact-evidence","same-part-hook-v5-vietnamese","same-part-hook-v4-part-arc","same-part-hook-v3-editorial"].includes(h.promptVersion) : h.promptVersion===LEGACY_HOOK_PROMPT_VERSION) || !text(h.inputKey, 64) || !/^[a-f0-9]{64}$/.test(h.inputKey)) fail();
  if (["ai", "external-import"].includes(h.selection) && (!h.provider || !h.model || !h.evidenceTimes.length)) fail();
  if (h.selection === "external-import" && !["gemini", "muse", "chatgpt-web"].includes(h.provider)) fail();
  if(adaptive&&['ai','external-import'].includes(h.selection)){
    if(!['speech','action','mixed'].includes(h.kind)||!['speech','visible-state','continuous-video'].includes(h.endingBasis)||!['not-used','supports-context'].includes(h.replayUse)||!['candidateId','kind','partUnderstanding','contentTypes','observed','startContext','endingBasis','replayUse'].every(k=>text(h[k])&&h[k].trim())||h.standalone!==true||h.complete!==true||!Array.isArray(h.cueIds)||h.cueIds.length>32||!h.cueIds.every(v=>text(v,100)))fail();
  }
  if(h.editedFrom!==undefined){const e=h.editedFrom;if(h.selection!=='manual'||!e||Object.keys(e).some(k=>!['selection','provider','model','promptVersion','inputKey','start','end'].includes(k))||!['ai','external-import','fallback'].includes(e.selection)||!['provider','model','promptVersion','inputKey'].every(k=>text(e[k],200))||![e.start,e.end].every(Number.isFinite)||e.end<=e.start)fail();}
  if(h.binding!==undefined){const b=h.binding;if(!b||b.version!==1||(b.contextVersion!==undefined&&b.contextVersion!==2)||Object.keys(b).some(k=>!['version','contextVersion','sourceId','sourceFingerprint','transcriptKey','contextKey','evidenceKey','requestKey','manualMainContext','retainedMainContext'].includes(k))||typeof b.sourceId!=='string'||!['transcriptKey','contextKey','evidenceKey','requestKey'].every(k=>typeof b[k]==='string'&&/^[a-f0-9]{64}$/.test(b[k]))||(b.sourceFingerprint!==undefined&&!/^[a-f0-9]{64}$/.test(b.sourceFingerprint))||(b.manualMainContext!==undefined&&!retainedManualMainContext(part,sourceDuration))||(b.retainedMainContext!==undefined&&!retainedAutoMainContext(part,sourceDuration)))fail();}
  if(h.heatmapEvidence!==undefined){const e=h.heatmapEvidence;if(!e||Object.keys(e).some(k=>!['available','supportsSelection','peakTimes','reason'].includes(k))||typeof e.available!=='boolean'||typeof e.supportsSelection!=='boolean'||!text(e.reason)||!Array.isArray(e.peakTimes)||e.peakTimes.length>6||!e.peakTimes.every(t=>Number.isFinite(t)&&t>=h.start&&t<=h.end)||(!e.available&&e.supportsSelection))fail();}
  if(h.alternatives!==undefined){if(!Array.isArray(h.alternatives)||h.alternatives.length>2)fail();for(const choice of h.alternatives){if(!choice||typeof choice!=='object'||Array.isArray(choice)||Object.keys(choice).some(k=>!['start','end','reason','relation','ending','evidenceTimes','limitations','candidateId','kind','partUnderstanding','contentTypes','observed','startContext','standalone','complete','endingBasis','cueIds','replayUse'].includes(k)))fail();validateTeaser({...part,teaser:{...h,...choice,heatmapEvidence:undefined,alternatives:undefined}},sourceDuration,sourceId);}}

}

export function hookCandidates(part,cues=[],playbackRate=PLAYBACK_RATE,signals={}) {
  return buildHookCandidates(permittedHookRanges(part,playbackRate),cues,playbackRate,hookDurationLimits(playbackRate).maxSourceSeconds,{...signals,minSourceSeconds:hookDurationLimits(playbackRate).minSourceSeconds});
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

// Manual source excerpts remain independent of MAIN. Automated selections must
// still match their current MAIN/citation context before presentation/export.
export function presentationSegments(part) {
  if(part.teaserEnabled===false)return part.segments;
  if (part.teaser?.status !== "selected" || (part.teaser.selection!=='manual'&&part.teaser.rangeKey !== hookRangeKey(part))) return part.segments;
  // Loading/re-enabling an old invalid excerpt must leave the editor usable.
  // Readiness reports the error and blocks export while that teaser is enabled.
  try{validateTeaser(part);}catch{return part.segments;}
  return [{ start: part.teaser.start, end: part.teaser.end, label: "Teaser", reason: part.teaser.reason }, ...part.segments];
}
export const presentationDuration = (part) => timelineDuration(presentationSegments(part));
export function hookTransitionId(part, ordinary, override) {
  if(override!==undefined&&!['rainbow-light-leak','vr-light-leak-v2','dip-black','flash-white','none'].includes(override))throw Error("Invalid hook transition.");
  if(part.teaserEnabled===false||presentationSegments(part)===part.segments)return "none";
  if(override!==undefined)return override;
  const id = normalizeCutTransition(ordinary);
  return id === "none" ? "dip-black" : id;
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
 const next={...part,teaser:structuredClone({...h,...choice,heatmapEvidence:{available:h.heatmapEvidence?.available||false,supportsSelection:false,peakTimes:[],reason:'Đã chọn phương án AI dự phòng đã lưu; xem lý do của phương án để đánh giá ảnh hưởng replay, chưa tính lại bằng chứng replay.'},alternatives:[current,...h.alternatives.filter((_,i)=>i!==index)].slice(0,2)})};validateTeaser(next);return next;
}
export function adjustTeaserRange(part,start,end,cues=[],source){
 if(source&&(!source.id||!Number.isFinite(source.duration)||source.duration<=0))throw Error('Chuẩn bị đúng video nguồn trước khi áp dụng teaser.');
 checkHookSpeechBoundaries({start,end,selection:'manual'},cues);
 const h={version:1,status:'selected',selection:'manual',...(source?{manualSourceId:source.id}:{}),selectionPolicy:HOOK_SELECTION_POLICY,start,end,reason:'Mốc nguồn do người dùng chọn; cần tự kiểm tra sức hấp dẫn và trọn nghĩa.',relation:'Đoạn nguồn do người dùng chọn riêng cho teaser; không thay đổi nội dung chính.',ending:'Biên do người dùng chỉnh; AI chưa xác minh câu nói hoặc hành động đã kết thúc trọn vẹn.',evidenceTimes:[start,end],limitations:['Chọn mốc thủ công, không phải kết quả AI.'],provider:'user',model:'manual',promptVersion:HOOK_PROMPT_VERSION,inputKey:'0'.repeat(64),rangeKey:hookRangeKey(part),transition:'inherit-or-dip-black'};
 const old=part.teaser;
 if(old?.status==='selected'){
  const previous=old.selection==='manual'?old.editedFrom:old;
  const origin=previous&&Object.fromEntries(['selection','provider','model','promptVersion','inputKey','start','end'].map(k=>[k,previous[k]]));
  // Optional history must not carry malformed AI metadata into a manual choice.
  if(origin&&['ai','external-import','fallback'].includes(origin.selection)&&['provider','model','promptVersion','inputKey'].every(k=>text(origin[k],200))&&[origin.start,origin.end].every(Number.isFinite)&&origin.end>origin.start)h.editedFrom=structuredClone(origin);
 }
 const next={...part,teaser:h,teaserNeedsReselection:false};validateTeaser({...next,teaserEnabled:true},source?.duration,source?.id);return next;
}

// Export readiness is stricter than legacy plan loading. Enabled parts require a
// valid hook; an explicit per-part opt-out preserves the saved excerpt unchanged.
export function teaserReadiness(plan,sourceDuration=Infinity,cues=[],sourceId){
 if(!Array.isArray(plan?.parts)||plan.parts.length!==2)return[{partId:0,reason:'Cần đúng hai Part; Part bật teaser phải có teaser hợp lệ.'}];
 const issues=[];
 for(const [index,part]of plan.parts.entries()){
  const partId=part.id||index+1,h=part.teaser;
  if(part.teaserEnabled===false)continue;
  let reason='';
  if(part.teaserEnabled!==undefined&&typeof part.teaserEnabled!=='boolean')reason='Trạng thái bật/tắt teaser không hợp lệ.';
  else if(!h||h.status!=='selected')reason=h?.status==='unavailable'?explainInVietnamese(h.reason,'Provider chưa trả teaser hợp lệ; chọn lại bằng AI hoặc nhập mốc nguồn.'): 'Thiếu teaser. Chọn lại bằng AI, nhập mốc nguồn hoặc chủ động tắt teaser trong Timeline.';
  else if(['ai','external-import'].includes(h.selection)&&!h.binding)reason='Teaser AI cũ chưa có binding dữ liệu hiện hành; chọn lại bằng AI hoặc nhập mốc thủ công.';
  else if(part.teaserNeedsReselection&&h.selection!=='manual')reason='Main đã đổi; cần chọn/sửa teaser trước khi xuất.';
  else if(hookNeedsReselection(part))reason='Teaser AI chạm 10 giây rendered đầu main hoặc nằm ngoài một range main được giữ.';
  else if(h.selection==='manual'&&h.manualSourceId!==undefined&&sourceId&&h.manualSourceId!==sourceId)reason='Teaser thủ công thuộc video nguồn khác; nhập lại mốc cho video hiện tại.';
  else try{
   validateTeaser(part,sourceDuration,sourceId);
   if(h.selection!=='manual'&&h.end-h.start>hookDurationLimits().maxSourceSeconds)throw Error('Duration');
   checkHookSpeechBoundaries(h,cues);
  }catch{reason=h.selection==='manual'?'Mốc teaser chưa hợp lệ; cần 0 ≤ bắt đầu < kết thúc ≤ thời lượng video nguồn.':'Teaser không hợp lệ: kiểm tra mốc nguồn, main/gap, biên lời nói và tối đa 9 giây rendered.';}
  if(reason)issues.push({partId,reason});
 }
 return issues;
}
export function requireBothTeasers(plan,sourceDuration=Infinity,cues=[],sourceId){
 const issues=teaserReadiness(plan,sourceDuration,cues,sourceId);
 if(issues.length)throw Object.assign(new Error(issues.map(i=>`Part ${i.partId}: ${i.reason}`).join(' ')),{code:'TEASER_REQUIRED',status:409});
}
