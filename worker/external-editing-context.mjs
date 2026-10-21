import {WEB_AI_PROMPT_VERSION} from '../lib/muse-plan.mjs';
import {createHash} from 'node:crypto';
import {modelSelectionInput,MAIN_INSTRUCTIONS} from '../lib/auto-cut/main-content.mjs';
import {collectTeaserEvidence} from '../lib/teaser-evidence.mjs';
import {hookInput} from '../lib/teaser-input.mjs';
import {HOOK_WINNER_INSTRUCTIONS} from '../lib/teaser-prompt.mjs';
import {permittedHookRanges,hookDurationLimits} from '../lib/teaser-hooks.mjs';

export const EXTERNAL_TEXT_VERSION=WEB_AI_PROMPT_VERSION;
// Uses exactly the native evidence collector, main input, teaser input and rules.
// No frame extraction, provider, download, new model or local media path here.
export function buildExternalEditingContext(source,context,options,prepared,body){
 const cues=options.cues||[],track=options.captionTrack;
 const inputSource={id:source.id,title:source.title,duration:source.duration,kind:source.kind,
  transcript:String(body.transcript??source.transcript??''),sourceContext:context,
  captionProvenance:{origin:track?.origin||'unknown',timing:track?.timing||'cue'}};
 const request={instruction:options.instruction,supplementalPrompt:options.supplementalPrompt};
 const whole={id:0,title:source.title,hook:'Toàn bộ video nguồn, chưa phải một part đã chọn.',segments:[{start:0,end:source.duration}]};
 const evidence=collectTeaserEvidence(whole,inputSource,cues,{...request,permittedRanges:[],fullOnly:true}).full;
 // The shared full transcript/comments/replay appear once, with no catalog-only
 // substitution or tail truncation in this manual text transport.
 const supporting={...context.metadata,chapters:context.chapters,heatmap:context.heatmap,
  commentClusters:context.comments?.clusters,visualSignals:context.visualSignals,audioSignals:context.audioSignals};
 const currentParts=(options.currentPlan?.parts||[]).map(part=>({
  partId:part.id,title:part.title,hook:part.hook,manualLocked:part.manualLocked===true,
  teaserEnabled:part.teaserEnabled!==false,
  segments:part.segments.map(({start,end,isPadding,label,reason})=>({start,end,isPadding:isPadding===true,label,reason})),
  excludedGaps:part.segments.filter(s=>!s.isPadding).flatMap((s,i,all)=>i&&s.start>all[i-1].end?[{start:all[i-1].end,end:s.start}]:[]),
  permittedHookRanges:permittedHookRanges(part),
  teaserInput:hookInput(part,inputSource,cues,supporting),
 }));
 const payload={version:EXTERNAL_TEXT_VERSION,sourceId:source.id,requestId:body.requestId,provider:body.provider,
  timeUnit:'source-seconds',sourceLanguage:source.language||'unknown',duration:source.duration,
  mainInput:modelSelectionInput(prepared),videoEvidence:evidence,currentParts,
  captionTrack:track,
  rules:{main:MAIN_INSTRUCTIONS,teaser:HOOK_WINNER_INSTRUCTIONS,durationLimits:hookDurationLimits()},
  transmission:{textOnly:true,imagesProvided:false,videoProvided:false,
   difference:'ChatGPT có thể nhận ảnh tĩnh thưa. Gemini/Muse ở workflow này KHÔNG nhận ảnh/video; scene/audio/replay chỉ là tín hiệu số, không chứng minh vật thể hoặc hành động đã được nhìn thấy.',
   currentPartsPolicy:'Snapshot main/padding/locks hiện tại; chỉ range manualLocked bắt buộc giữ nguyên. Khi đề xuất main mới, tính lại permitted teaser sau trim theo chính main mới, không dùng candidate ID của range cũ để giả bằng chứng.',
   coverage:'Toàn bộ văn bản/tín hiệu đã thu thập; các trạng thái missing/unavailable/error là giới hạn dữ liệu, không phải điểm âm.'}};
 payload.analysisKey=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 return payload;
}
