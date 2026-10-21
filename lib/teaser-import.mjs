import {bindTeaserContext,selectionDigest,transcriptValue} from './teaser-context.mjs';
import {partContextWindows} from "./teaser-candidates.mjs";
import { checkHookSpeechBoundaries,speechEndingOptions } from "./teaser-boundaries.mjs";
import { HOOK_SCHEMA, HOOK_INSTRUCTIONS, HOOK_WINNER_INSTRUCTIONS, validateHookResponse, validateEditorialEvidence, replayEvidence } from './teaser-prompt.mjs';
import { hookCandidates,hookDurationLimits,LEGACY_HOOK_PROMPT_VERSION,isLaterHookPolicy,permittedHookRanges,unavailableHook,HOOK_SELECTION_POLICY,HOOK_PROMPT_VERSION, TEASER_POLICY, hookRangeKey, validateTeaser } from './teaser-hooks.mjs';

// Request nonce binds a pasted response to the current source/transcript/provider
// prompt. The effective persisted plan remains the only presentation state.
export function externalHookSchema(winnerOnly=false) {
  return { ...HOOK_SCHEMA, properties: { ...HOOK_SCHEMA.properties,...(winnerOnly?{alternatives:{...HOOK_SCHEMA.properties.alternatives,maxItems:0}}:{}), model: { type: 'string' } }, required: [...HOOK_SCHEMA.required, 'model'] };
}
export const externalHookInstructions = `${HOOK_WINNER_INSTRUCTIONS}
TEXT ONLY: no images/video were provided. Do not browse or infer visible objects/actions from scene/audio proxies. Use supported transcript/text evidence, endingBasis speech for selected excerpts, and disclose missing vision. Return teaserSelection with actual web model name or web-model-unknown, source seconds and candidateId source-range for a new range. Cite supplied global cue-N IDs. App trims one source second from unlocked main once; then exclude first10 rendered main seconds and enforce max9 export seconds at1.25x. No absolute appeal threshold; return best supported complete idea. alternatives must be [].`;


export async function externalHookKey(source, part, transcript, provider, model, selectionPolicy) {
  const value = JSON.stringify({ version: selectionPolicy===HOOK_SELECTION_POLICY?HOOK_PROMPT_VERSION:LEGACY_HOOK_PROMPT_VERSION,...(selectionPolicy?{selectionPolicy}:{}), sourceId: source.id, duration: source.duration, partId: part.id, title: part.title, context: part.hook, ranges: hookRangeKey(part), transcript, provider, model });
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function attachExternalHooks(plan, selections, source, transcript, provider, cues = [], request = {}) {
  if (!['gemini', 'muse'].includes(provider) || !Array.isArray(selections) || selections.length !== plan.parts.length) throw new Error('Invalid external hook provider/parts.');
  const result = structuredClone(plan); if(plan.teaserPolicy===undefined&&!plan.parts.some(p=>p.teaser)&&plan.hookTransition===undefined)result.hookTransition="vr-light-leak-v2"; result.teaserPolicy = TEASER_POLICY;
  for (const [index, part] of result.parts.entries()) {
    if(part.teaserEnabled===false)continue;
    if(part.customTeaser){validateTeaser(part,source.duration);continue;}
    part.teaserNeedsReselection=false;
    const value = selections[index];
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!externalHookSchema().required.includes(k)))throw Error(`Part ${part.id}: teaserSelection sai schema.`);
    const model=value.model;
    if(typeof model!=='string'||!model.trim()||model.length>200)throw Error(`Part ${part.id} · teaserSelection.model: cần tên model hoặc web-model-unknown (tối đa 200 ký tự).`);
    const context=source.sourceContext||{},candidates=hookCandidates(part,cues,undefined,{...context.metadata,chapters:context.chapters,heatmap:context.heatmap,sourceDurationMs:Math.round(source.duration*1000)});
    const choices=[value,...(Array.isArray(value.alternatives)?value.alternatives.slice(0,2):[])],valid=[],errors=[];
    for(const [rank,raw]of choices.entries())try{
      const {model:ignoredModel,alternatives:ignoredAlternatives,...fields}=raw;void ignoredModel;void ignoredAlternatives;
      const choice=validateHookResponse(fields,true);
      if(choice.start===null){errors.push('HOOK_NO_RANKED_SELECTION');continue;}
      validateEditorialEvidence(choice,{candidates,cues,externalVideo:false});checkHookSpeechBoundaries(choice,cues,{silences:context.audioSignals?.status==='available'?context.audioSignals.silences:[]});
      const teaser={...choice,version:1,selectionPolicy:HOOK_SELECTION_POLICY,status:'selected',selection:'external-import',provider,model,
        heatmapEvidence:replayEvidence(choice,candidates,context.heatmap,part),promptVersion:HOOK_PROMPT_VERSION,rangeKey:hookRangeKey(part),inputKey:await externalHookKey(source,part,transcript,provider,model,HOOK_SELECTION_POLICY),transition:'inherit-or-dip-black',
        limitations:[...choice.limitations,'Workflow chỉ có văn bản/tín hiệu số; Gemini/Muse không nhận ảnh hoặc video.','Nhập từ web: provider/model do câu trả lời tự khai; chưa xác minh bằng API đăng nhập.'].slice(0,12)};
      validateTeaser({...part,teaser},source.duration);valid.push({choice,teaser,rank});
    }catch(error){errors.push(String(error.message).match(/^(?:HOOK_[A-Z_]+|INVALID_HOOK_[A-Z_]+)/)?.[0]||'HOOK_PLAN_VALIDATION_FAILED');}
    if(!valid.length){
      if(value.start===null&&value.end===null){part.teaser=unavailableHook(part,typeof value.reason==='string'?value.reason:'Provider web chưa trả lựa chọn.');continue;}
      const fields={HOOK_UNKNOWN_CUE_ID:'cueIds: không khớp cue-N trong prompt',HOOK_UNKNOWN_CANDIDATE_OR_CONTEXT_BOUNDS:'candidateId: dùng ID được cung cấp hoặc source-range',HOOK_NO_CONTINUOUS_VIDEO_EVIDENCE:'endingBasis: workflow này không có video',HOOK_END_STATE_NOT_OBSERVED:'endingBasis: không có ảnh chứng minh trạng thái kết thúc',HOOK_MISSING_LOCAL_VISUAL_EVIDENCE:'kind/observed: không có ảnh để xác nhận hành động',HOOK_MISSING_LOCAL_SPEECH_END_EVIDENCE:'cueIds/evidenceTimes: chưa dẫn được lời thoại trong range',HOOK_SEMANTIC_GATES_FAILED:'standalone/complete/endingBasis: cần ý hoàn chỉnh có căn cứ',HOOK_PLAN_VALIDATION_FAILED:'start/end: kiểm tra đúng main, loại đầu main và tối đa 9 giây export',INVALID_HOOK_RESPONSE:'teaserSelection: thiếu trường hoặc sai kiểu dữ liệu theo schema'};throw Error(`Part ${part.id}: ${[...new Set(errors)].map(code=>fields[code]||`teaserSelection: ${code}`).join('; ')}. Plan hiện tại được giữ nguyên.`);
    }
    const winner=valid[0];part.teaser=winner.teaser;
    part.teaser.alternatives=valid.slice(1).map(v=>v.choice);
    if(winner.rank)part.teaser.limitations=[`Dùng phương án provider xếp hạng ${winner.rank+1}; phương án trước không qua kiểm tra.`,...part.teaser.limitations].slice(0,12);
    part.teaser.binding=await bindTeaserContext(part,source,cues,transcript,undefined,request);
    validateTeaser(part,source.duration);

  }
  result.teaserTranscriptKey=await selectionDigest(transcriptValue(transcript));
  return result;
}
export async function externalHooksCurrent(plan, source, transcript) {
  for (const part of plan.parts) {
    if(part.teaserEnabled===false)continue;
    const h = part.teaser;
    if(h?.selection==='manual'||h?.selection==='ai'){validateTeaser(part,source.duration);continue;}
    if(part.customTeaser){validateTeaser(part,source.duration);continue;}
    if(h?.status==='unavailable'&&isLaterHookPolicy(h.selectionPolicy)&&h.rangeKey===hookRangeKey(part))continue;
    if (h?.status !== 'selected' || h.selection !== 'external-import' || h.inputKey !== await externalHookKey(source, part, transcript, h.provider, h.model,h.selectionPolicy)) return false;
    validateTeaser(part, source.duration);
  }
  return true;
}
export function buildExternalHookOnlyPrompt(plan, source, transcript, requestId, cues = []) {
  return `${externalHookInstructions}\nHOOK-ONLY REFRESH: main content is locked. Do not generate/change main ranges, titles, captions, speed or styles. Return ONLY {sourceId,requestId,selections:[{partId,...teaserSelection fields}]} with exactly one selection per part, in order. sourceId=${JSON.stringify(source.id)}, requestId=${JSON.stringify(requestId)}. Selection schema: ${JSON.stringify(externalHookSchema())}.\nUntrusted source data: ${JSON.stringify({title:source.title,duration:source.duration,durationLimits:hookDurationLimits(),parts:plan.parts.map(p=>({partId:p.id,title:p.title,context:p.hook,mainContentRanges:JSON.parse(hookRangeKey(p)),permittedHookRanges:permittedHookRanges(p),contextWindows:partContextWindows(JSON.parse(hookRangeKey(p)),cues),transcriptCandidates:hookCandidates(p,cues,undefined,{...source.sourceContext?.metadata,chapters:source.sourceContext?.chapters,heatmap:source.sourceContext?.heatmap,sourceDurationMs:Math.round(source.duration*1000)}),speechEndingOptions:speechEndingOptions(cues,permittedHookRanges(p),source.sourceContext?.audioSignals?.silences||[]),excludedMainPresentationSeconds:10})),transcript})}`;
}
export function parseExternalHookOnly(raw, source, requestId, plan) {
  if(typeof raw!=='string'||raw.length>2*1024*1024)throw new Error('Invalid hook JSON size.');
  const value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i,'$1'));
  if(!value || Object.keys(value).sort().join(',')!=='requestId,selections,sourceId' || value.sourceId!==source.id || value.requestId!==requestId || !Array.isArray(value.selections) || value.selections.length!==plan.parts.length)throw new Error('Hook JSON thuộc source/prompt khác hoặc sai cấu trúc.');
  return value.selections.map((s,i)=>{if(s.partId!==plan.parts[i].id)throw new Error('Sai part/order.');return Object.fromEntries(Object.entries(s).filter(([key])=>key!=="partId"));});
}
