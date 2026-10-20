// Browser-only draft data. No worker payload, credential, File, blob URL or media.
import type {EditPlan} from './edit-plan';
import {RENDER_PRESET,isChronological} from './edit-plan';
import {snapshotPlanVisualStyle} from './visual-style/normalize.mjs';
import {normalizeMusic,validateSpeechActivity} from './music/settings.mjs';
import {sourceCaptionTrack,type CaptionTrack} from './subtitles.mjs';
import {validateTeaser} from './teaser-hooks.mjs';
import {validateMainRangeMetadata} from './main-ranges.mjs';
import {validateMainAnalysis} from './auto-cut/analysis.mjs';
export const SESSION_KEY='shortcut-dev-editor-session-v1';
export const SESSION_LIMIT=4*1024*1024; // UTF-16 upper bound, one atomic localStorage value.
export type Controls=Record<string,unknown>;
export type EditorSession={
 sourceMode:'youtube'|'local';sourceUrl:string;sourceId:string;localFileName:string;sourceTitle:string;transcript:string;
 editMode:'ai'|'manual';provider:import('./edit-plan').AiProvider;instruction:string;supplementalPrompt:string;
 plan?:EditPlan;hasEditPlan:boolean;sourceCaptions?:CaptionTrack|null;activePartIndex:number;workspace:'editor'|'batch'|'storage';previewTime:number;
 batchId:string;renderJobId:string;batchEditing?:{batchId:string;itemId:string;sourceId:string}|null;selectedBatchPreviewKey:string;batchUrls:string;
 manualPart1Title:string;manualPart2Title:string;manualPart1Ranges:string;manualPart2Ranges:string;
 webAiPrompt:string;webAiResult:string;webAiContext?:{sourceId:string;transcript:string;instruction:string;provider:import('./edit-plan').AiProvider;requestId:string;analysisKey?:string;supplementalPrompt?:string;lockedPlan?:EditPlan;hookPlan?:EditPlan;mainSignature?:string}|null;
 controls:Controls;interrupted:string[];
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=200000)=>typeof v==='string'?v.slice(0,max):'';
export const managedId=(v:unknown)=>typeof v==='string'&&/^[a-f0-9-]{16,64}$/i.test(v)?v:'';
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
function pick(v:Record<string,unknown>,keys:string[]){return Object.fromEntries(keys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]]));}
// This parser is deliberately for editing, not export: incomplete/invalid hooks
// remain visible for repair. It never normalizes timestamps or requires inference.
function readPlan(raw:unknown):EditPlan|undefined{
 if(!object(raw)||!Array.isArray(raw.parts)||raw.parts.length!==2||!object(raw.render))return;
 const parts=[];
 for(const [i,p]of raw.parts.entries()){
  if(!object(p)||p.id!==i+1||typeof p.title!=='string'||typeof p.hook!=='string'||!Array.isArray(p.hashtags)||p.hashtags.some(v=>typeof v!=='string')||!Array.isArray(p.segments)||!p.segments.length||p.segments.length>500)return;
  if(p.segments.some(s=>!object(s)||!finite(s.start)||!finite(s.end)||Number(s.end)<=Number(s.start)||typeof s.label!=='string'||typeof s.reason!=='string'))return;
  const part={...pick(p,['id','title','hook','hashtags','aiMainRanges','mainEdited','manualLocked','startTrimApplied','smartCutApplied','teaserNeedsReselection']),segments:p.segments.map(s=>pick(s,['start','end','label','reason','type','holdDuration','text','focus','isPadding']))} as EditPlan['parts'][number];
  if(!isChronological(part))return;
  if(object(p.teaser)&&['selected','unavailable'].includes(String(p.teaser.status))&&typeof p.teaser.reason==='string'){
   if(p.teaser.status==='unavailable'||(finite(p.teaser.start)&&finite(p.teaser.end)&&Array.isArray(p.teaser.limitations)&&p.teaser.limitations.every(v=>typeof v==='string')&&Array.isArray(p.teaser.evidenceTimes)&&p.teaser.evidenceTimes.every(finite))){
    part.teaser=pick(p.teaser,['version','rangeKey','reason','status','start','end','selection','candidateId','kind','partUnderstanding','contentTypes','observed','startContext','standalone','complete','endingBasis','cueIds','replayUse','heatmapEvidence','alternatives','ending','relation','evidenceTimes','limitations','provider','model','promptVersion','inputKey','transition','selectionPolicy']) as unknown as NonNullable<typeof part.teaser>;
    try{validateTeaser(part);}catch{part.teaserNeedsReselection=true;if(part.teaser.status==='selected')delete part.teaser.alternatives;}
   }
  }
  if(object(p.customTeaser)&&['timestamp','description'].includes(String(p.customTeaser.mode))&&typeof p.customTeaser.input==='string')part.customTeaser=pick(p.customTeaser,['version','mode','input']) as unknown as NonNullable<typeof part.customTeaser>;
  try{validateMainRangeMetadata(part,Infinity);}catch{delete part.aiMainRanges;}
  parts.push(part);
 }
 let plan={originalTitle:text(raw.originalTitle),language:['en','de','fr','ja','ko'].includes(String(raw.language))?raw.language:'en',providerUsed:raw.providerUsed,parts,render:{...RENDER_PRESET},...pick(raw,['teaserPolicy','hookTransition'])} as EditPlan;
 if(!['mock','chatgpt','gemini','muse','openai','qwen','manual','deterministic'].includes(plan.providerUsed))plan.providerUsed='manual';
 if(!['none','vr-light-leak-v2','rainbow-light-leak','dip-black','flash-white',undefined].includes(plan.hookTransition))delete plan.hookTransition;
 try{plan=snapshotPlanVisualStyle({...plan,visualStyle:raw.visualStyle,subtitles:raw.subtitles} as EditPlan);}catch{/* Keep other valid editing data. */}
 try{plan.music=normalizeMusic(raw.music);}catch{/* Invalid optional music does not lose the plan. */}
 // These contracts are validated by their ordinary consumers on explicit use.
 if(object(raw.analysis)){try{validateMainAnalysis(raw.analysis,{id:String(raw.analysis.sourceId),duration:Infinity});plan.analysis=raw.analysis as unknown as EditPlan['analysis'];}catch{}}
 if(object(raw.musicSpeech)){try{plan.musicSpeech=validateSpeechActivity(raw.musicSpeech,{id:managedId(raw.musicSpeech.sourceId),duration:Infinity});}catch{}}
 plan.captionCues=readCaptions(raw.captionCues);
 return plan;
}
function readCaptions(raw:unknown):CaptionTrack|undefined{
 if(!object(raw)||!managedId(raw.sourceId)||!Array.isArray(raw.cues))return;
 try{return sourceCaptionTrack(raw as unknown as CaptionTrack,{id:String(raw.sourceId),duration:finite(raw.sourceDuration)?Number(raw.sourceDuration):Infinity});}catch{return;}
}
export function readEditorSession():{draft?:Partial<EditorSession>;notice?:string;blocked?:boolean}{
 try{
  const saved=localStorage.getItem(SESSION_KEY);if(!saved)return{};
  if(saved.length*2>SESSION_LIMIT)return{blocked:true,notice:'Bản nháp vượt giới hạn; chưa ghi đè. Chọn Phiên mới nếu muốn bỏ bản nháp.'};
  const envelope=JSON.parse(saved);
  if(!object(envelope)||envelope.version!==1||!object(envelope.data))throw Error('schema');
  const r=envelope.data,d:Partial<EditorSession>={};
  for(const key of ['sourceUrl','localFileName','sourceTitle','transcript','instruction','supplementalPrompt','batchUrls','manualPart1Title','manualPart2Title','manualPart1Ranges','manualPart2Ranges','webAiPrompt','webAiResult'] as const)if(typeof r[key]==='string')d[key]=r[key] as string;
  d.sourceId=managedId(r.sourceId);d.batchId=managedId(r.batchId);d.renderJobId=managedId(r.renderJobId);
  d.selectedBatchPreviewKey=text(r.selectedBatchPreviewKey,500);
  d.sourceMode=r.sourceMode==='local'?'local':'youtube';d.editMode=r.editMode==='manual'?'manual':'ai';
  if(['mock','chatgpt','gemini','muse','openai','qwen'].includes(String(r.provider)))d.provider=r.provider as EditorSession['provider'];
  d.workspace=r.workspace==='batch'||r.workspace==='storage'?r.workspace:'editor';d.activePartIndex=r.activePartIndex===1?1:0;d.previewTime=finite(r.previewTime)?Number(r.previewTime):0;
  d.plan=readPlan(r.plan);d.hasEditPlan=!!d.plan&&r.hasEditPlan===true;
  d.sourceCaptions=readCaptions(r.sourceCaptions);
  if(object(r.batchEditing)&&managedId(r.batchEditing.batchId)&&managedId(r.batchEditing.itemId)&&r.batchEditing.sourceId===d.sourceId)d.batchEditing=r.batchEditing as EditorSession['batchEditing'];
  if(object(r.webAiContext)&&r.webAiContext.sourceId===d.sourceId&&managedId(r.webAiContext.requestId)){
   d.webAiContext={...pick(r.webAiContext,['sourceId','transcript','instruction','provider','requestId','analysisKey','supplementalPrompt','mainSignature']),lockedPlan:readPlan(r.webAiContext.lockedPlan),hookPlan:readPlan(r.webAiContext.hookPlan)} as EditorSession['webAiContext'];
  }
  d.controls=object(r.controls)?Object.fromEntries(Object.entries(r.controls).filter(([key])=>/:(?:main-[12]|teaser-(?:times|input|candidate)-[12]|music-(?:catalog|search|mood))$/.test(key)).slice(0,32)):{};d.interrupted=Array.isArray(r.interrupted)?[...new Set(r.interrupted.filter((s):s is string=>typeof s==='string').map(s=>s.slice(0,200)))].slice(0,12):[];
  return{draft:d,notice:d.plan||!r.hasEditPlan?'Đã khôi phục phiên chỉnh sửa':'Đã khôi phục phần hợp lệ; plan hỏng chưa được áp dụng. Bản nháp gốc được giữ đến khi bạn chỉnh tiếp.',blocked:!!r.hasEditPlan&&!d.plan};
 }catch{return{blocked:true,notice:'Không đọc được bản nháp; app vẫn sử dụng được. Bản nháp chưa bị xóa/ghi đè. Chọn Phiên mới để bỏ.'};}
}
export function writeEditorSession(data:EditorSession):string{
 try{
  const safe={...data,sourceUrl:/^(?:data|blob):/i.test(data.sourceUrl)?'':data.sourceUrl,interrupted:[...new Set(data.interrupted)].slice(0,12)};
  const json=JSON.stringify({version:1,savedAt:new Date().toISOString(),data:safe});
  if(json.length*2>SESSION_LIMIT)return'Bản nháp vượt 4 MiB; bản lưu trước vẫn được giữ. Rút gọn transcript/JSON nhập để lưu tiếp.';
  localStorage.setItem(SESSION_KEY,json);return'';
 }catch{return'Chưa lưu được bản nháp (bộ nhớ local không khả dụng hoặc đầy); bản lưu trước không bị xóa.';}
}
