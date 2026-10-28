import {createHash} from 'node:crypto';
import {createAnalysisCache} from './analysis-cache.mjs';
import {sourceCaptionTrack} from '../lib/subtitles.mjs';
import {WEB_AI_PROMPT_VERSION} from '../lib/muse-plan.mjs';
import {MAIN_INSTRUCTIONS} from '../lib/auto-cut/main-content.mjs';
import {externalHookInstructions} from '../lib/teaser-import.mjs';
import {hookDurationLimits} from '../lib/teaser-hooks.mjs';

const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const hash=value=>createHash('sha256').update(stable(value)).digest('hex');
const fail=(code,message)=>Object.assign(Error(message),{code});
// Only editorial inputs belong here. Renderer focus/appearance, history metadata,
// AI binding diagnostics and object key order cannot invalidate a TXT snapshot.
function mainInput(plan){
 if(!plan)return null;
 return {originalTitle:plan.originalTitle,providerUsed:plan.providerUsed,parts:plan.parts.map(part=>({id:part.id,title:part.title,hook:part.hook,mainEdited:part.mainEdited===true,manualLocked:part.manualLocked===true,
  teaserEnabled:part.teaserEnabled!==false,segments:part.segments.map(({start,end,isPadding,label,reason})=>({start,end,isPadding:isPadding===true,label,reason})),
  manualTeaser:part.teaser?.selection==='manual'?{manualSourceId:part.teaser.manualSourceId,start:part.teaser.start,end:part.teaser.end}:null,
  manualCustom:part.customTeaser?.mode==='timestamp'?part.customTeaser:null}))};
}
function identities(source,body,track,media){
 const currentTrack=track?sourceCaptionTrack(track,source):null;
 return Object.fromEntries(Object.entries({
  source:{id:source.id,duration:source.duration,title:source.title,language:source.language,captionLanguage:source.captionLanguage,sourceKey:media?.sourceKey},
  request:{requestId:body.requestId,provider:body.provider},
  transcript:String(body.transcript??source.transcript??''),
  requirements:{instruction:String(body.instruction||''),supplementalPrompt:String(body.supplementalPrompt||'')},
  main:mainInput(body.currentPlan),captions:currentTrack,
  rules:{version:WEB_AI_PROMPT_VERSION,main:MAIN_INSTRUCTIONS,teaser:externalHookInstructions,limits:hookDurationLimits()},
 }).map(([key,value])=>[key,hash(value)]));
}
const labels={source:'Video nguồn đã thay đổi.',request:'JSON thuộc lượt TXT hoặc AI khác.',transcript:'Transcript đã thay đổi.',requirements:'Yêu cầu biên tập đã thay đổi.',main:'Main hoặc phần bảo vệ chỉnh tay đã thay đổi.',captions:'Nội dung, timing hoặc nguồn phụ đề đã thay đổi.',rules:'Quy tắc hoặc phiên bản prompt đã thay đổi.'};
export function createExternalPromptSnapshots(root){
 // Persist across worker restarts; bounded cache, no credentials/raw AI output.
 // Cache eviction is explicit on import, never permission to rebuild a new
 // evidence set and silently attach an old response to it.
 const cache=createAnalysisCache(root,{maxBytes:64*1024*1024});
 const key=(source,body)=>hash({sourceId:source.id,requestId:body.requestId});
 return {
  async save(source,body,{context,options,input,external}){
   if(!external.attachments?.sourceVideo?.sourceKey)throw fail('WEB_CONTEXT_SOURCE','Thiếu định danh video; chưa xuất TXT.');
   const snapshot={version:1,analysisKey:external.analysisKey,identities:identities(source,body,options.captionTrack,external.attachments.sourceVideo),context,input,captionTrack:options.captionTrack,local:options.local};
   if(!await cache.put(key(source,body),snapshot))throw fail('WEB_CONTEXT_SAVE','Không lưu được snapshot TXT an toàn (dung lượng/quyền ghi/giới hạn cache). Chưa xuất TXT; bản nháp được giữ.');
  },
  async load(source,body,media){
   const saved=await cache.get(key(source,body));
   if(!saved||saved.version!==1||!saved.identities||!saved.context||!saved.input||saved.captionTrack?.sourceId!==source.id)throw fail('WEB_CONTEXT_MISSING','Không còn snapshot của lượt TXT này (TXT cũ hoặc cache đã hết hạn). Tải TXT mới một lần; JSON nháp được giữ.');
   if(saved.analysisKey!==body.analysisKey)throw fail('WEB_CONTEXT_KEY','analysisKey không khớp lượt TXT này. Dùng đúng JSON của TXT đã tải.');
   if(!body.captionCues)throw fail('WEB_CONTEXT_CAPTIONS','Thiếu snapshot phụ đề của lượt TXT; chưa nhập kết quả.');
   const current=identities(source,body,body.captionCues,media);
   const changed=Object.keys(current).filter(key=>current[key]!==saved.identities[key]);
   if(changed.length)throw fail('WEB_CONTEXT_'+changed[0].toUpperCase(),changed.map(key=>labels[key]).join(' ')+' Tải TXT mới; plan hiện tại được giữ.');
   return saved;
  },
 };
}
