import {bindTeaserContext,selectionDigest,transcriptValue} from './teaser-context.mjs';
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
    if(typeof model!=='string'||!model.trim()||model.length>200)throw Error('Tên model import không hợp lệ.');
    const context=source.sourceContext||{},candidates=hookCandidates(part,cues,undefined,{...context.metadata,chapters:context.chapters,heatmap:context.heatmap,sourceDurationMs:Math.round(source.duration*1000)});
    const choices=[value,...(Array.isArray(value.alternatives)?value.alternatives.slice(0,2):[])],valid=[],errors=[];
    for(const [rank,raw]of choices.entries())try{
      const {model:ignoredModel,alternatives:ignoredAlternatives,...fields}=raw;void ignoredModel;void ignoredAlternatives;
      const choice=validateHookResponse(fields,true);
      if(choice.start===null){errors.push('HOOK_NO_RANKED_SELECTION');continue;}
      validateEditorialEvidence(choice,{candidates,cues,externalVideo:true});checkHookSpeechBoundaries(choice,cues);
      const teaser={...choice,version:1,selectionPolicy:HOOK_SELECTION_POLICY,status:'selected',selection:'external-import',provider,model,
        heatmapEvidence:replayEvidence(choice,candidates,context.heatmap,part),promptVersion:HOOK_PROMPT_VERSION,rangeKey:hookRangeKey(part),inputKey:await externalHookKey(source,part,transcript,provider,model,HOOK_SELECTION_POLICY),transition:'inherit-or-dip-black',
        limitations:[...choice.limitations,'Nhập từ web: provider/model do câu trả lời tự khai; chưa xác minh bằng API đăng nhập.'].slice(0,12)};
      validateTeaser({...part,teaser},source.duration);valid.push({choice,teaser,rank});
    }catch(error){errors.push(String(error.message).match(/^(?:HOOK_[A-Z_]+|INVALID_HOOK_[A-Z_]+)/)?.[0]||'HOOK_PLAN_VALIDATION_FAILED');}
    if(!valid.length){
      if(value.start===null&&value.end===null){part.teaser=unavailableHook(part,typeof value.reason==='string'?value.reason:'Provider web chưa trả lựa chọn.');continue;}
      throw Error(`Part ${part.id}: import chưa hợp lệ (${[...new Set(errors)].join(', ')}). Sửa riêng hook trong cùng main, không tự đổi sang heuristic.`);
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
  return `${externalHookInstructions}\nHOOK-ONLY REFRESH: main content is locked. Do not generate/change main ranges, titles, captions, speed or styles. Return ONLY {sourceId,requestId,selections:[{partId,...teaserSelection fields}]} with exactly one selection per part, in order. sourceId=${JSON.stringify(source.id)}, requestId=${JSON.stringify(requestId)}. Selection schema: ${JSON.stringify(externalHookSchema())}.\nUntrusted source data: ${JSON.stringify({title:source.title,duration:source.duration,durationLimits:hookDurationLimits(),parts:plan.parts.map(p=>({partId:p.id,title:p.title,context:p.hook,mainContentRanges:JSON.parse(hookRangeKey(p)),permittedHookRanges:permittedHookRanges(p),contextWindows:partContextWindows(JSON.parse(hookRangeKey(p)),cues),transcriptCandidates:hookCandidates(p,cues,undefined,{...source.sourceContext?.metadata,chapters:source.sourceContext?.chapters,heatmap:source.sourceContext?.heatmap,sourceDurationMs:Math.round(source.duration*1000)}),speechEndingOptions:speechEndingOptions(cues,permittedHookRanges(p),source.sourceContext?.audioSignals?.silences||[]),excludedMainPresentationSeconds:10})),transcript:transcript.slice(0,100000)})}`;
}
export function parseExternalHookOnly(raw, source, requestId, plan) {
  if(typeof raw!=='string'||raw.length>2*1024*1024)throw new Error('Invalid hook JSON size.');
  const value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i,'$1'));
  if(!value || Object.keys(value).sort().join(',')!=='requestId,selections,sourceId' || value.sourceId!==source.id || value.requestId!==requestId || !Array.isArray(value.selections) || value.selections.length!==plan.parts.length)throw new Error('Hook JSON thuộc source/prompt khác hoặc sai cấu trúc.');
  return value.selections.map((s,i)=>{if(s.partId!==plan.parts[i].id)throw new Error('Sai part/order.');return Object.fromEntries(Object.entries(s).filter(([key])=>key!=="partId"));});
}
