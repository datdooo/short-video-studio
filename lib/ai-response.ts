import { CANVAS_WIDTH, CANVAS_HEIGHT, BACKGROUND_BLUR, BACKGROUND_OPACITY, PLAYBACK_RATE } from "./render-config.mjs";
import type {EditPlan,EditPart,Segment} from './edit-plan';
import type {CaptionTrack} from './subtitles.mjs';
import type {Teaser} from './teaser-hooks.mjs';
export function record(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);
function segment(value:unknown):value is Segment{return record(value)&&finite(value.start)&&finite(value.end)&&typeof value.label==='string'&&typeof value.reason==='string';}
function teaser(value:unknown):value is Teaser{
 if(!record(value)||value.version!==1||typeof value.reason!=='string'||typeof value.rangeKey!=='string')return false;
 if(value.status==='unavailable')return true;
 return value.status==='selected'&&['ai','external-import','fallback','manual'].some(v=>v===value.selection)&&finite(value.start)&&finite(value.end)&&typeof value.relation==='string'&&Array.isArray(value.evidenceTimes)&&value.evidenceTimes.every(finite)&&Array.isArray(value.limitations)&&value.limitations.every(v=>typeof v==='string')&&['provider','model','promptVersion','inputKey'].every(key=>typeof value[key]==='string')&&value.transition==='inherit-or-dip-black';
}
function part(value:unknown):value is EditPart{
 return record(value)&&typeof value.id==='number'&&typeof value.title==='string'&&typeof value.hook==='string'&&Array.isArray(value.hashtags)&&value.hashtags.every(v=>typeof v==='string')&&Array.isArray(value.segments)&&value.segments.length>0&&value.segments.every(segment)&&(value.teaser===undefined||teaser(value.teaser));
}
function captions(value:unknown):value is CaptionTrack{
 return record(value)&&typeof value.sourceId==='string'&&typeof value.origin==='string'&&(value.sourceDuration===undefined||finite(value.sourceDuration))&&(value.timeline===undefined||typeof value.timeline==='string')&&['language','task','trackId','warning'].every(key=>value[key]===undefined||typeof value[key]==='string')&&(value.timing===undefined||['word','cue','estimated'].some(v=>v===value.timing))&&Array.isArray(value.cues)&&value.cues.every(c=>record(c)&&finite(c.start)&&finite(c.end)&&typeof c.text==='string'&&(c.timing===undefined||['word','cue','estimated'].some(v=>v===c.timing)));
}
export function planResult(value:Record<string,unknown>):{plan?:EditPlan}{
 if(value.plan===undefined)return{};
 const p=value.plan;
 if(!record(p)||typeof p.originalTitle!=='string'||typeof p.language!=='string'||!['mock','chatgpt','chatgpt-web','gemini','muse','openai','qwen','manual','deterministic'].some(v=>v===p.providerUsed)||!Array.isArray(p.parts)||p.parts.length!==2||!p.parts.every(part)||!record(p.render))throw Error('Kết quả phân tích thiếu cấu trúc plan hợp lệ.');
 const r=p.render;if(r.width!==CANVAS_WIDTH||r.height!==CANVAS_HEIGHT||r.speed!==PLAYBACK_RATE||r.preservePitch!==true||r.backgroundBlur!==BACKGROUND_BLUR||r.backgroundOpacity!==BACKGROUND_OPACITY)throw Error('Kết quả phân tích sai cấu hình render.');
 if(p.captionCues!==undefined&&!captions(p.captionCues))throw Error('Kết quả phân tích sai dữ liệu phụ đề.');
 if(p.analysis!==undefined&&(!record(p.analysis)||typeof p.analysis.method!=='string'||p.analysis.fallbackReason!==undefined&&typeof p.analysis.fallbackReason!=='string'))throw Error('Kết quả phân tích sai metadata.');
 // Decode shape only. A preserved stale teaser must remain editable; semantic,
 // source/range and readiness validators still run at their existing boundaries.
 // Do not normalize, strip fields or change source timestamps here.
 if(!isPlan(p))throw Error('Kết quả phân tích sai plan.');
 return {plan:p};
}
function isPlan(p:unknown):p is EditPlan{
 return record(p)&&typeof p.originalTitle==='string'&&typeof p.language==='string'&&typeof p.providerUsed==='string'&&Array.isArray(p.parts)&&p.parts.every(part)&&record(p.render)&&p.render.width===CANVAS_WIDTH&&p.render.height===CANVAS_HEIGHT&&p.render.speed===PLAYBACK_RATE&&p.render.preservePitch===true&&p.render.backgroundBlur===BACKGROUND_BLUR&&p.render.backgroundOpacity===BACKGROUND_OPACITY;
}
export type WebOperationContext=Record<string,unknown>&{analysisKey:string;captionTrack?:CaptionTrack;attachments?:{sourceVideo:{id:string;filename:string;bytes:number|null;duration:number;sourceKey?:string;variantKey?:string}}};
export function contextResult(value:Record<string,unknown>):{context?:WebOperationContext}{
 if(value.context===undefined)return{};
 if(!isContext(value.context))throw Error('Kết quả chuẩn bị prompt sai cấu trúc.');
 return {context:value.context};
}
function isContext(c:unknown):c is WebOperationContext{
 if(!record(c)||typeof c.analysisKey!=='string'||c.captionTrack!==undefined&&!captions(c.captionTrack))return false;
 if(c.attachments!==undefined){
  if(!record(c.attachments)||!record(c.attachments.sourceVideo))return false;
  const m=c.attachments.sourceVideo;
  if(typeof m.id!=='string'||typeof m.filename!=='string'||!(m.bytes===null||finite(m.bytes))||!finite(m.duration)||m.sourceKey!==undefined&&typeof m.sourceKey!=='string'||m.variantKey!==undefined&&typeof m.variantKey!=='string')return false;
 }
 return true;
}
