import {mainInstruction,MAIN_EDITING_CRITERIA} from '../lib/main-instructions.mjs';
import {lockedParts} from '../lib/auto-cut/locks.mjs';
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
  captionProvenance:{origin:track?.origin||'unknown',timing:track?.timing||'cue',language:track?.language||'unknown',trackId:track?.trackId||null,warning:track?.warning||null}};
 const request={instruction:mainInstruction(options.instruction).text,supplementalPrompt:options.supplementalPrompt};
 const whole={id:0,title:source.title,hook:'Toàn bộ video nguồn, chưa phải một part đã chọn.',segments:[{start:0,end:source.duration}]};
 const evidence=collectTeaserEvidence(whole,inputSource,cues,{...request,permittedRanges:[],fullOnly:true}).full;
 if(evidence.userRequest.instruction===MAIN_EDITING_CRITERIA)evidence.userRequest.instruction='Use the shared current MAIN editing policy in instructions (exact factory default; no additional user requirement).';
 // The shared full transcript/comments/replay appear once, with no catalog-only
 // substitution or tail truncation in this manual text transport.
 const supporting={...context.metadata,chapters:context.chapters,heatmap:context.heatmap,
  commentClusters:context.comments?.clusters,visualSignals:context.visualSignals,audioSignals:context.audioSignals};
 const protections=lockedParts(options.currentPlan);
 const currentParts=(options.currentPlan?.parts||[]).map((part,index)=>({
  partId:part.id,title:part.title,hook:part.hook,manualLocked:protections[index]===true,mainEdited:part.mainEdited===true,
  teaserEnabled:part.teaserEnabled!==false,
  segments:part.segments.map(({start,end,isPadding,label,reason})=>({start,end,isPadding:isPadding===true,label,reason})),
  excludedGaps:part.segments.filter(s=>!s.isPadding).flatMap((s,i,all)=>i&&s.start>all[i-1].end?[{start:all[i-1].end,end:s.start}]:[]),
  permittedHookRanges:permittedHookRanges(part),
  teaserInput:hookInput(part,inputSource,cues,supporting),
 }));
 const payload={version:EXTERNAL_TEXT_VERSION,sourceId:source.id,requestId:body.requestId,provider:body.provider,
  timeUnit:'source-seconds',sourceLanguage:prepared.sourceLanguage||'unknown',duration:source.duration,
  mainInput:{...modelSelectionInput(prepared),sourceEvidence:undefined,evidenceReference:'videoEvidence',editorialRequestReference:'videoEvidence.userRequest'},videoEvidence:evidence,currentParts,
  captionTrack:track,
  rules:{main:MAIN_INSTRUCTIONS,teaser:HOOK_WINNER_INSTRUCTIONS,durationLimits:hookDurationLimits()},
  transmission:{textOnly:true,imagesProvided:false,videoProvided:false,
   difference:'Cả ChatGPT và Gemini/Muse chỉ nhận text/tín hiệu số trong luồng phân tích hiện tại; không provider nào được coi là đã xem ảnh/video.',
   currentPartsPolicy:'Snapshot main/padding/locks hiện tại; chỉ range manualLocked bắt buộc giữ nguyên. Khi đề xuất main mới, tính lại permitted teaser theo chính main mới, không trim tự động, không dùng candidate ID của range cũ để giả bằng chứng.',
   coverage:'Toàn bộ văn bản/tín hiệu đã thu thập; các trạng thái missing/unavailable/error là giới hạn dữ liệu, không phải điểm âm.'}};
 payload.analysisKey=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 return payload;
}
