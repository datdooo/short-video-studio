import { checkHookSpeechBoundaries } from "./teaser-boundaries.mjs";
import { HOOK_SCHEMA, HOOK_INSTRUCTIONS } from './teaser-prompt.mjs';
import { HOOK_PROMPT_VERSION, TEASER_POLICY, hookRangeKey, validateTeaser } from './teaser-hooks.mjs';

// Request nonce binds a pasted response to the current source/transcript/provider
// prompt. The effective persisted plan remains the only presentation state.
export function externalHookSchema() {
  return { ...HOOK_SCHEMA, properties: { ...HOOK_SCHEMA.properties, model: { type: 'string' } }, required: [...HOOK_SCHEMA.required, 'model'] };
}
export const externalHookInstructions = `${HOOK_INSTRUCTIONS}
For EACH selected part return teaserSelection using the schema. Include the actual model name, or "web-model-unknown" if unavailable. Do not claim an API verified your answer. Choose from the retained content AFTER the app removes the first 1 source second; avoid the first 3 seconds and last 3 seconds of each main range to allow bounded sentence/silence cleanup. Never use engagement timestamps as semantic proof. Return both main-content parts AND their independent teaserSelection in this single round trip. If you cannot analyze this source, state that rather than fabricating JSON.`;

export async function externalHookKey(source, part, transcript, provider, model) {
  const value = JSON.stringify({ version: HOOK_PROMPT_VERSION, sourceId: source.id, duration: source.duration, partId: part.id, title: part.title, context: part.hook, ranges: hookRangeKey(part), transcript, provider, model });
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function attachExternalHooks(plan, selections, source, transcript, provider, cues = []) {
  if (!['gemini', 'muse'].includes(provider) || !Array.isArray(selections) || selections.length !== plan.parts.length) throw new Error('Invalid external hook provider/parts.');
  const result = structuredClone(plan); result.teaserPolicy = TEASER_POLICY;
  for (const [index, part] of result.parts.entries()) {
    const value = selections[index];
    if (!value || Object.keys(value).some(k => !externalHookSchema().required.includes(k)) || externalHookSchema().required.some(k => !(k in value))) throw new Error(`Part ${part.id}: teaserSelection không đúng schema.`);
    checkHookSpeechBoundaries(value, cues);
    const { model, ...selection } = value;
    part.teaser = { ...selection, version: 1, status: 'selected', selection: 'external-import', provider, model,
      promptVersion: HOOK_PROMPT_VERSION, rangeKey: hookRangeKey(part), inputKey: await externalHookKey(source, part, transcript, provider, model), transition: 'inherit-or-dip-black',
      limitations: [...(Array.isArray(value.limitations) ? value.limitations : []), 'External web import: provider/model self-reported; no authenticated API verification.'].slice(0, 12) };
    try { validateTeaser(part, source.duration); } catch { throw new Error(`Part ${part.id}: hook nằm ngoài nội dung được giữ sau Smart Cut hoặc không hợp lệ. Tạo prompt mới và chọn đoạn bên trong range; không tự thay bằng fallback.`); }
  }
  return result;
}
export async function externalHooksCurrent(plan, source, transcript) {
  for (const part of plan.parts) {
    const h = part.teaser;
    if (h?.status !== 'selected' || h.selection !== 'external-import' || h.inputKey !== await externalHookKey(source, part, transcript, h.provider, h.model)) return false;
    validateTeaser(part, source.duration);
  }
  return true;
}
export function buildExternalHookOnlyPrompt(plan, source, transcript, requestId) {
  return `${externalHookInstructions}\nHOOK-ONLY REFRESH: main content is locked. Do not generate/change main ranges, titles, captions, speed or styles. Return ONLY {sourceId,requestId,selections:[{partId,...teaserSelection fields}]} with exactly one selection per part, in order. sourceId=${JSON.stringify(source.id)}, requestId=${JSON.stringify(requestId)}. Selection schema: ${JSON.stringify(externalHookSchema())}.\nUntrusted source data: ${JSON.stringify({title:source.title,duration:source.duration,parts:plan.parts.map(p=>({partId:p.id,title:p.title,context:p.hook,allowedRanges:JSON.parse(hookRangeKey(p))})),transcript:transcript.slice(0,100000)})}`;
}
export function parseExternalHookOnly(raw, source, requestId, plan) {
  if(typeof raw!=='string'||raw.length>2*1024*1024)throw new Error('Invalid hook JSON size.');
  const value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i,'$1'));
  if(!value || Object.keys(value).sort().join(',')!=='requestId,selections,sourceId' || value.sourceId!==source.id || value.requestId!==requestId || !Array.isArray(value.selections) || value.selections.length!==plan.parts.length)throw new Error('Hook JSON thuộc source/prompt khác hoặc sai cấu trúc.');
  return value.selections.map((s,i)=>{if(s.partId!==plan.parts[i].id)throw new Error('Sai part/order.');return Object.fromEntries(Object.entries(s).filter(([key])=>key!=="partId"));});
}
