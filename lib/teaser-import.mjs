import {partContextWindows} from "./teaser-candidates.mjs";
import { checkHookSpeechBoundaries,speechEndingOptions } from "./teaser-boundaries.mjs";
import { HOOK_SCHEMA, HOOK_INSTRUCTIONS, validateHookResponse, validateEditorialEvidence, replayEvidence } from './teaser-prompt.mjs';
import { hookCandidates,hookDurationLimits,LEGACY_HOOK_PROMPT_VERSION,isLaterHookPolicy,permittedHookRanges,unavailableHook,HOOK_SELECTION_POLICY,HOOK_PROMPT_VERSION, TEASER_POLICY, hookRangeKey, validateTeaser } from './teaser-hooks.mjs';

// Request nonce binds a pasted response to the current source/transcript/provider
// prompt. The effective persisted plan remains the only presentation state.
export function externalHookSchema() {
  return { ...HOOK_SCHEMA, properties: { ...HOOK_SCHEMA.properties, model: { type: 'string' } }, required: [...HOOK_SCHEMA.required, 'model'] };
}
export const externalHookInstructions = `${HOOK_INSTRUCTIONS}
For EACH selected part return teaserSelection using the schema. Include the actual model name, or "web-model-unknown" if unavailable. Do not claim an API verified your answer. Choose from the retained content AFTER the app removes the first 1 source second; exclude the first 10 RENDERED seconds of retained main content, accounting for cuts and the supplied playback speed, then choose wholly inside permittedHookRanges. Preserve complete sentence/action boundaries. Return null start/end with reason if no coherent later hook is possible. Never use engagement timestamps as semantic proof. Return both main-content parts AND their independent teaserSelection in this single round trip. If you cannot analyze this source, state that rather than fabricating JSON.`;

export async function externalHookKey(source, part, transcript, provider, model, selectionPolicy) {
  const value = JSON.stringify({ version: selectionPolicy===HOOK_SELECTION_POLICY?HOOK_PROMPT_VERSION:LEGACY_HOOK_PROMPT_VERSION,...(selectionPolicy?{selectionPolicy}:{}), sourceId: source.id, duration: source.duration, partId: part.id, title: part.title, context: part.hook, ranges: hookRangeKey(part), transcript, provider, model });
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function attachExternalHooks(plan, selections, source, transcript, provider, cues = []) {
  if (!['gemini', 'muse'].includes(provider) || !Array.isArray(selections) || selections.length !== plan.parts.length) throw new Error('Invalid external hook provider/parts.');
  const result = structuredClone(plan); if(plan.teaserPolicy===undefined&&!plan.parts.some(p=>p.teaser)&&plan.hookTransition===undefined)result.hookTransition="vr-light-leak-v2"; result.teaserPolicy = TEASER_POLICY;
  for (const [index, part] of result.parts.entries()) {
    if(part.customTeaser){validateTeaser(part,source.duration);continue;}
    part.teaserNeedsReselection=false;
    const value = selections[index];
    if (!value || Object.keys(value).some(k => !externalHookSchema().required.includes(k)) || externalHookSchema().required.some(k => !(k in value))) throw new Error(`Part ${part.id}: teaserSelection không đúng schema.`);
    const {model: responseModel, ...responseSelection}=value;
    if(typeof responseModel!=='string'||!responseModel.trim()||responseModel.length>200)throw new Error('Invalid external model.');
    validateHookResponse(responseSelection);
    if(value.start===null&&value.end===null&&typeof value.reason==='string'&&value.reason.trim()){part.teaser=unavailableHook(part,value.reason);continue;}
    const context=source.sourceContext||{},candidates=hookCandidates(part,cues,undefined,{...context.metadata,chapters:context.chapters,heatmap:context.heatmap,sourceDurationMs:Math.round(source.duration*1000)});
    validateEditorialEvidence(value,{candidates,cues,externalVideo:true});
    for(const choice of value.alternatives){validateEditorialEvidence(choice,{candidates,cues,externalVideo:true});checkHookSpeechBoundaries(choice,cues);}
    checkHookSpeechBoundaries(value, cues);
    const { model, ...selection } = value;
    part.teaser = { ...selection, version: 1, selectionPolicy:HOOK_SELECTION_POLICY, status: 'selected', selection: 'external-import', provider, model,
      heatmapEvidence:replayEvidence(value,candidates,context.heatmap),promptVersion: HOOK_PROMPT_VERSION, rangeKey: hookRangeKey(part), inputKey: await externalHookKey(source, part, transcript, provider, model,HOOK_SELECTION_POLICY), transition: 'inherit-or-dip-black',
      limitations: [...(Array.isArray(value.limitations) ? value.limitations : []), 'External web import: provider/model self-reported; no authenticated API verification.'].slice(0, 12) };
    try { validateTeaser(part, source.duration); } catch { throw new Error(`Part ${part.id}: hook nằm ngoài nội dung được giữ sau Smart Cut hoặc không hợp lệ. Tạo prompt mới và chọn đoạn bên trong range; không tự thay bằng fallback.`); }
  }
  return result;
}
export async function externalHooksCurrent(plan, source, transcript) {
  for (const part of plan.parts) {
    const h = part.teaser;
    if(part.customTeaser){validateTeaser(part,source.duration);continue;}
    if(h?.status==='unavailable'&&isLaterHookPolicy(h.selectionPolicy)&&h.rangeKey===hookRangeKey(part))continue;
    if (h?.status !== 'selected' || h.selection !== 'external-import' || h.inputKey !== await externalHookKey(source, part, transcript, h.provider, h.model,h.selectionPolicy)) return false;
    validateTeaser(part, source.duration);
  }
  return true;
}
export function buildExternalHookOnlyPrompt(plan, source, transcript, requestId, cues = []) {
  return `${externalHookInstructions}\nHOOK-ONLY REFRESH: main content is locked. Do not generate/change main ranges, titles, captions, speed or styles. Return ONLY {sourceId,requestId,selections:[{partId,...teaserSelection fields}]} with exactly one selection per part, in order. sourceId=${JSON.stringify(source.id)}, requestId=${JSON.stringify(requestId)}. Selection schema: ${JSON.stringify(externalHookSchema())}.\nUntrusted source data: ${JSON.stringify({title:source.title,duration:source.duration,durationLimits:hookDurationLimits(),parts:plan.parts.map(p=>({partId:p.id,title:p.title,context:p.hook,mainContentRanges:JSON.parse(hookRangeKey(p)),permittedHookRanges:permittedHookRanges(p),contextWindows:partContextWindows(JSON.parse(hookRangeKey(p)),cues),transcriptCandidates:hookCandidates(p,cues,undefined,{...source.sourceContext?.metadata,chapters:source.sourceContext?.chapters,heatmap:source.sourceContext?.heatmap,sourceDurationMs:Math.round(source.duration*1000)}),speechEndingOptions:speechEndingOptions(cues,permittedHookRanges(p),source.sourceContext?.audioSignals?.silences||[]),excludedMainPresentationSeconds:10})),transcript:transcript.slice(0,100000)})}`;
}
export function parseExternalHookOnly(raw, source, requestId, plan) {
  if(typeof raw!=='string'||raw.length>2*1024*1024)throw new Error('Invalid hook JSON size.');
  const value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i,'$1'));
  if(!value || Object.keys(value).sort().join(',')!=='requestId,selections,sourceId' || value.sourceId!==source.id || value.requestId!==requestId || !Array.isArray(value.selections) || value.selections.length!==plan.parts.length)throw new Error('Hook JSON thuộc source/prompt khác hoặc sai cấu trúc.');
  return value.selections.map((s,i)=>{if(s.partId!==plan.parts[i].id)throw new Error('Sai part/order.');return Object.fromEntries(Object.entries(s).filter(([key])=>key!=="partId"));});
}
