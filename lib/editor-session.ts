import {normalizeLanguageCode} from './content-language.mjs';
import {PREVIEW_TIMEBASE} from './preview-config.mjs';
import {PLAYBACK_RATE} from './render-config.mjs';
// Browser-only draft data. No worker payload, credential, File, blob URL or media.
import type {EditPlan} from './edit-plan';
import {RENDER_PRESET,isChronological} from './edit-plan';
import {snapshotPlanVisualStyle} from './visual-style/normalize.mjs';
import {normalizeMusic,validateSpeechActivity} from './music/settings.mjs';
import {sourceCaptionTrack,type CaptionTrack} from './subtitles.mjs';
import {validateTeaser} from './teaser-hooks.mjs';
import {validateMainRangeMetadata} from './main-ranges.mjs';
import {validateMainAnalysis} from './auto-cut/analysis.mjs';
export const SESSION_KEY='shortcut-beta-editor-session-v1';
export const SESSION_LIMIT=4*1024*1024; // UTF-16 upper bound, one atomic localStorage value.
const PRESERVED_SESSION_KEY='shortcut-beta-editor-preserved-sessions-v1';
const PRESERVED_SESSION_LIMIT=8*1024*1024;
const PRESERVED_SESSION_COUNT=12;
export type Controls=Record<string,unknown>;
export type EditorSession={
 sourceMode:'youtube'|'local';sourceUrl:string;sourceId:string;localFileName:string;localDraftId?:string;sourceTitle:string;transcript:string;
 sourceAdvancedOpen?:boolean;inspectorTab?:'appearance'|'text'|'music';editMode:'ai'|'manual';provider:import('./edit-plan').AiProvider;instruction:string;supplementalPrompt:string;
 plan?:EditPlan;hasEditPlan:boolean;sourceCaptions?:CaptionTrack|null;activePartIndex:number;workspace:'editor'|'batch'|'storage';previewTime:number;previewTimebase?:typeof PREVIEW_TIMEBASE;
 batchId:string;renderJobId:string;batchEditing?:{batchId:string;itemId:string;sourceId:string}|null;batchDraftItem?:{batchId:string;itemId:string;sourceId:string}|null;selectedBatchPreviewKey:string;batchUrls:string;
 manualPart1Title:string;manualPart2Title:string;manualPart1Ranges:string;manualPart2Ranges:string;
 webAiPrompt:string;webAiResult:string;webAiContext?:{sourceId:string;transcript:string;instruction:string;provider:import('./edit-plan').AiProvider;requestId:string;analysisKey?:string;supplementalPrompt?:string;lockedPlan?:EditPlan;hookPlan?:EditPlan;mainSignature?:string;lastImportMainSignature?:string;promptVersion?:string;captionTrack?:CaptionTrack;media?:{id:string;filename:string;bytes:number|null;duration:number;sourceKey?:string;variantKey?:string}}|null;
 controls:Controls;interrupted:string[];
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=200000)=>typeof v==='string'?v.slice(0,max):'';
export const managedId=(v:unknown)=>typeof v==='string'&&/^[a-f0-9-]{16,64}$/i.test(v)?v:'';
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
function pick(v:Record<string,unknown>,keys:string[]){return Object.fromEntries(keys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]]));}
// This parser is deliberately for editing, not export: incomplete/invalid hooks
// remain visible for repair. It never normalizes timestamps or requires inference.
function readPlan(raw:unknown,sourceId?:string):EditPlan|undefined{
 if(!object(raw)||!Array.isArray(raw.parts)||raw.parts.length!==2||!object(raw.render))return;
 const parts=[];
 for(const [i,p]of raw.parts.entries()){
  if(!object(p)||p.id!==i+1||typeof p.title!=='string'||typeof p.hook!=='string'||!Array.isArray(p.hashtags)||p.hashtags.some(v=>typeof v!=='string')||!Array.isArray(p.segments)||!p.segments.length||p.segments.length>500)return;
  if(p.segments.some(s=>!object(s)||!finite(s.start)||!finite(s.end)||Number(s.end)<=Number(s.start)||typeof s.label!=='string'||typeof s.reason!=='string'))return;
  const part={...pick(p,['id','title','hook','hashtags','aiMainRanges','mainEdited','manualLocked','startTrimApplied','smartCutApplied','teaserNeedsReselection']),segments:p.segments.map(s=>pick(s,['start','end','label','reason','type','holdDuration','text','focus','isPadding']))} as EditPlan['parts'][number];
  if(!isChronological(part))return;
  if(typeof p.teaserEnabled==='boolean')part.teaserEnabled=p.teaserEnabled;
  if(object(p.teaser)&&['selected','unavailable'].includes(String(p.teaser.status))&&typeof p.teaser.reason==='string'){
   if(p.teaser.status==='unavailable'||(finite(p.teaser.start)&&finite(p.teaser.end)&&Array.isArray(p.teaser.limitations)&&p.teaser.limitations.every(v=>typeof v==='string')&&Array.isArray(p.teaser.evidenceTimes)&&p.teaser.evidenceTimes.every(finite))){
    part.teaser=pick(p.teaser,['manualSourceId','editedFrom','binding','version','rangeKey','reason','status','start','end','selection','candidateId','kind','partUnderstanding','contentTypes','observed','startContext','standalone','complete','endingBasis','cueIds','replayUse','heatmapEvidence','alternatives','ending','relation','evidenceTimes','limitations','provider','model','promptVersion','inputKey','transition','selectionPolicy']) as unknown as NonNullable<typeof part.teaser>;
    try{validateTeaser(part,Infinity,sourceId);if(part.teaser.status==='selected'&&part.teaser.selection==='manual')part.teaserNeedsReselection=false;}catch{part.teaserNeedsReselection=true;if(part.teaser.status==='selected')delete part.teaser.alternatives;}
   }
  }
  if(object(p.customTeaser)&&['timestamp','description'].includes(String(p.customTeaser.mode))&&typeof p.customTeaser.input==='string')part.customTeaser=pick(p.customTeaser,['version','mode','input']) as unknown as NonNullable<typeof part.customTeaser>;
  try{validateMainRangeMetadata(part,Infinity);}catch{delete part.aiMainRanges;}
  parts.push(part);
 }
 let plan={originalTitle:text(raw.originalTitle),language:normalizeLanguageCode(raw.language)||'und',providerUsed:raw.providerUsed,parts,render:{...RENDER_PRESET},...pick(raw,['teaserPolicy','hookTransition','teaserTranscriptKey'])} as EditPlan;
 if(!['mock','chatgpt','chatgpt-web','gemini','muse','openai','qwen','manual','deterministic'].includes(plan.providerUsed))plan.providerUsed='manual';
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
export type EditorSessionRead={draft?:Partial<EditorSession>;notice?:string;blocked?:boolean};
export function readEditorSessionRaw(saved:string|null):EditorSessionRead{
 try{
  if(!saved)return{};
  if(saved.length*2>SESSION_LIMIT)return{blocked:true,notice:'Bản nháp vượt giới hạn; bản gốc được giữ đến khi bảo toàn thành công hoặc bạn chọn Phiên mới.'};
  const envelope=JSON.parse(saved);
  if(!object(envelope)||envelope.version!==1||!object(envelope.data))throw Error('schema');
  const r=envelope.data,d:Partial<EditorSession>={};
  for(const key of ['sourceUrl','localFileName','sourceTitle','transcript','instruction','supplementalPrompt','batchUrls','manualPart1Title','manualPart2Title','manualPart1Ranges','manualPart2Ranges','webAiPrompt','webAiResult'] as const)if(typeof r[key]==='string')d[key]=r[key] as string;
  d.sourceId=managedId(r.sourceId);d.localDraftId=managedId(r.localDraftId);d.batchId=managedId(r.batchId);d.renderJobId=managedId(r.renderJobId);
  d.selectedBatchPreviewKey=text(r.selectedBatchPreviewKey,500);
  d.sourceAdvancedOpen=r.sourceAdvancedOpen===true;
  d.inspectorTab=r.inspectorTab==='text'||r.inspectorTab==='music'?r.inspectorTab:'appearance';
  d.sourceMode=r.sourceMode==='local'?'local':'youtube';d.editMode=r.editMode==='manual'?'manual':'ai';
  if(['mock','chatgpt','chatgpt-web','gemini','muse','openai','qwen'].includes(String(r.provider)))d.provider=r.provider as EditorSession['provider'];
  d.workspace=r.workspace==='batch'||r.workspace==='storage'?r.workspace:'editor';d.activePartIndex=r.activePartIndex===1?1:0;d.previewTime=finite(r.previewTime)?Number(r.previewTime):0;
  d.plan=readPlan(r.plan,d.sourceId||undefined);d.hasEditPlan=!!d.plan&&r.hasEditPlan===true;
  // Legacy editor drafts stored the export clock. Migrate only the UI playhead,
  // never source timecodes/plan/job snapshots; future reads see an explicit marker.
  if(r.previewTimebase!==PREVIEW_TIMEBASE&&d.hasEditPlan)d.previewTime=Number(d.previewTime)*PLAYBACK_RATE;
  d.previewTimebase=PREVIEW_TIMEBASE;
  d.sourceCaptions=readCaptions(r.sourceCaptions);
  if(d.sourceId&&object(r.batchEditing)&&managedId(r.batchEditing.batchId)&&managedId(r.batchEditing.itemId)&&r.batchEditing.sourceId===d.sourceId)d.batchEditing=r.batchEditing as EditorSession['batchEditing'];
  if(d.sourceId&&object(r.batchDraftItem)&&managedId(r.batchDraftItem.batchId)&&managedId(r.batchDraftItem.itemId)&&r.batchDraftItem.sourceId===d.sourceId)d.batchDraftItem=r.batchDraftItem as EditorSession['batchDraftItem'];
  if(object(r.webAiContext)&&r.webAiContext.sourceId===d.sourceId&&managedId(r.webAiContext.requestId)){
   d.webAiContext={...pick(r.webAiContext,['sourceId','transcript','instruction','provider','requestId','analysisKey','supplementalPrompt','mainSignature','promptVersion']),...(typeof r.webAiContext.lastImportMainSignature==='string'?{lastImportMainSignature:r.webAiContext.lastImportMainSignature}:{}),captionTrack:readCaptions(r.webAiContext.captionTrack),lockedPlan:readPlan(r.webAiContext.lockedPlan),hookPlan:readPlan(r.webAiContext.hookPlan)} as EditorSession['webAiContext'];
   const media=r.webAiContext.media;
   if(d.webAiContext&&object(media)&&media.id===`source-video-${d.sourceId}`&&typeof media.filename==='string'&&/^source-[a-f0-9-]+\.[a-zA-Z0-9]+$/.test(media.filename)&&typeof media.duration==='number'&&Number.isFinite(media.duration)&&media.duration>0&&(media.bytes===null||typeof media.bytes==='number'&&Number.isFinite(media.bytes)&&media.bytes>=0))d.webAiContext.media={id:media.id as string,filename:media.filename,bytes:media.bytes as number|null,duration:media.duration,...(typeof media.sourceKey==='string'&&/^[a-f0-9]{64}$/.test(media.sourceKey)?{sourceKey:media.sourceKey}:{}),...(typeof media.variantKey==='string'&&/^[a-f0-9]{64}$/.test(media.variantKey)?{variantKey:media.variantKey}:{})};
  }
  const controlEntries=object(r.controls)?Object.entries(r.controls).filter(([key])=>/:(?:main-[12]|teaser-(?:times|input|candidate|review-(?:catalog|focus))-[12]|music-(?:catalog|search|mood)|manual-cut)$/.test(key)):[];
  // A growing set of source-scoped manual drafts is preserved whole. Exceeding
  // the bound blocks replacement instead of silently discarding older entries.
  if(controlEntries.length>256)return{blocked:true,notice:'Bản nháp có quá nhiều nhóm ô nhập; bản gốc được giữ đến khi bảo toàn thành công hoặc bạn chọn Phiên mới.'};
  d.controls=Object.fromEntries(controlEntries);d.interrupted=Array.isArray(r.interrupted)?[...new Set(r.interrupted.filter((s):s is string=>typeof s==='string').map(s=>s.slice(0,200)))].slice(0,12):[];
  return{draft:d,notice:d.plan||!r.hasEditPlan?'Đã khôi phục phiên chỉnh sửa':'Đã khôi phục phần hợp lệ; plan hỏng chưa được áp dụng. Bản gốc được giữ đến khi bảo toàn thành công hoặc bạn chọn Phiên mới.',blocked:!!r.hasEditPlan&&!d.plan};
 }catch{return{blocked:true,notice:'Không đọc được bản nháp; bản gốc được giữ đến khi bảo toàn thành công hoặc bạn chọn Phiên mới.'};}
}
export function readEditorSession():EditorSessionRead{
 try{return readEditorSessionRaw(localStorage.getItem(SESSION_KEY));}
 catch{return{blocked:true,notice:'Chưa đọc được bộ nhớ bản nháp; không ghi đè cho tới khi bảo toàn thành công hoặc bạn chọn Phiên mới.'};}
}
function serializeEditorSession(data:EditorSession):string{
 const safe={...data,previewTimebase:PREVIEW_TIMEBASE,sourceUrl:/^(?:data|blob):/i.test(data.sourceUrl)?'':data.sourceUrl,interrupted:[...new Set(data.interrupted)].slice(0,12)};
 return JSON.stringify({version:1,savedAt:new Date().toISOString(),data:safe});
}
export function writeEditorSession(data:EditorSession):string{
 try{
  const json=serializeEditorSession(data);
  if(json.length*2>SESSION_LIMIT)return'Bản nháp vượt 4 MiB; bản lưu trước vẫn được giữ. Nội dung TXT, transcript và JSON có thể chiếm nhiều bộ nhớ. Giữ hoặc sao chép dữ liệu hiện tại trước khi đóng; app không tự cắt dữ liệu.';
  localStorage.setItem(SESSION_KEY,json);return'';
 }catch{return'Chưa lưu được bản nháp (bộ nhớ local không khả dụng hoặc đầy); bản lưu trước không bị xóa.';}
}

// A batch item owns its editor draft even when another item uses the same source.
// Unmanaged/incomplete input still has an identity and can be preserved without
// inventing a managed source ID or retaining an expired blob/data URL.
export function editorSessionIdentity(data:Partial<EditorSession>):string{
 const sourceId=managedId(data.sourceId),batch=data.batchDraftItem||data.batchEditing;
 if(batch&&managedId(batch.batchId)&&managedId(batch.itemId)&&sourceId&&batch.sourceId===sourceId)return JSON.stringify(['batch',batch.batchId,batch.itemId,sourceId]);
 if(sourceId)return JSON.stringify(['source',sourceId]);
 const mode=data.sourceMode==='local'?'local':'youtube';
 const input=mode==='local'?data.localDraftId||data.localFileName:data.sourceUrl;
 return JSON.stringify(['unmanaged',mode,typeof input==='string'&&!/^(?:data|blob):/i.test(input)?input:'']);
}
type PreservedSession={key:string;label:string;savedAt:string;raw:string;opaque:boolean};
type PreservedSessions={version:1;entries:PreservedSession[]};
function readPreservedSessions():PreservedSessions{
 const raw=localStorage.getItem(PRESERVED_SESSION_KEY);
 if(raw===null)return{version:1,entries:[]};
 if(raw.length*2>PRESERVED_SESSION_LIMIT)throw Error('Kho bản nháp đã vượt giới hạn; chưa thay phiên.');
 let value:unknown;
 try{value=JSON.parse(raw);}catch{throw Error('Không đọc được kho bản nháp; chưa thay phiên hoặc ghi đè.');}
 if(!object(value)||value.version!==1||!Array.isArray(value.entries)||value.entries.length>PRESERVED_SESSION_COUNT||value.entries.some(entry=>!object(entry)||typeof entry.key!=='string'||typeof entry.label!=='string'||typeof entry.savedAt!=='string'||typeof entry.raw!=='string'||typeof entry.opaque!=='boolean')||new Set(value.entries.map(entry=>entry.key)).size!==value.entries.length)throw Error('Kho bản nháp không đúng định dạng; chưa thay phiên hoặc ghi đè.');
 return value as PreservedSessions;
}
export function preserveEditorSession(data:EditorSession,{preserveBlockedRaw=false}:{preserveBlockedRaw?:boolean}={}):{key?:string;error?:string}{
 try{
  const archive=readPreservedSessions(),raw=serializeEditorSession(data),key=editorSessionIdentity(data);
  if(raw.length*2>SESSION_LIMIT)return{error:'Bản nháp hiện tại vượt 4 MiB; chưa thay phiên. Giữ hoặc rút gọn dữ liệu trước khi mở item khác.'};
  const savedAt=new Date().toISOString();
  const baseLabel=(data.sourceTitle||data.localFileName||data.sourceUrl||'Phiên chưa có nguồn').slice(0,160);
  const batch=data.batchDraftItem||data.batchEditing;
  const label=batch&&managedId(batch.batchId)&&managedId(batch.itemId)&&batch.sourceId===managedId(data.sourceId)?`${baseLabel} · item ${batch.itemId.slice(0,8)}`:baseLabel;
  const entries=archive.entries.filter(entry=>entry.key!==key);
  if(preserveBlockedRaw){
   // Opaque means no parse, migration, reserialization or trimming. Only an exact
   // readback of this atomic archive permits the caller to unlock active saving.
   const blockedRaw=localStorage.getItem(SESSION_KEY);
   if(blockedRaw!==null&&!entries.some(entry=>entry.opaque&&entry.raw===blockedRaw)){
    let opaqueKey=`raw:${savedAt}`;
    while(entries.some(entry=>entry.key===opaqueKey))opaqueKey+=':copy';
    entries.push({key:opaqueKey,label:'Bản gốc chưa đọc được',savedAt,raw:blockedRaw,opaque:true});
   }
  }
  entries.push({key,label,savedAt,raw,opaque:false});
  if(entries.length>PRESERVED_SESSION_COUNT)return{error:'Kho đã giữ đủ 12 bản nháp; chưa thay phiên. Không tự xóa bản cũ để lấy chỗ.'};
  const json=JSON.stringify({version:1,entries});
  if(json.length*2>PRESERVED_SESSION_LIMIT)return{error:'Kho bản nháp vượt 8 MiB; chưa thay phiên. Không tự bỏ dữ liệu đã giữ.'};
  localStorage.setItem(PRESERVED_SESSION_KEY,json);
  if(localStorage.getItem(PRESERVED_SESSION_KEY)!==json)return{error:'Chưa xác nhận được bản nháp đã bảo toàn; chưa thay phiên hoặc mở khóa ghi đè.'};
  return{key};
 }catch(error){return{error:error instanceof Error&&/^Kho |^Không đọc được kho /.test(error.message)?error.message:'Không bảo toàn được bản nháp (bộ nhớ local không khả dụng hoặc đầy); chưa thay phiên hoặc ghi đè.'};}
}
export function readPreservedEditorSession(key:string):EditorSessionRead{
 try{
  const entry=readPreservedSessions().entries.find(value=>value.key===key);
  if(!entry)return{};
  return readEditorSessionRaw(entry.raw);
 }catch{return{blocked:true,notice:'Không đọc được bản nháp đã giữ; phiên hiện tại chưa thay đổi.'};}
}
export function listPreservedEditorSessions():{key:string;label:string}[]{
 try{return readPreservedSessions().entries.map(({key,label})=>({key,label}));}
 catch{return[];}
}

// Capture the exact saved copy before asking. A save in another tab while the
// dialog is open must not turn approval for an old copy into deletion of a new one.
export function preparePreservedEditorSessionDeletion(key: string): () => string {
  const snapshot = readPreservedSessions().entries.find((entry) => entry.key === key);
  if (!snapshot) throw Error("Bản nháp không còn trong danh sách.");
  return () => {
    try {
      const archive = readPreservedSessions(),
        current = archive.entries.find((entry) => entry.key === key);
      if (!current) return "";
      if (current.raw !== snapshot.raw || current.savedAt !== snapshot.savedAt || current.opaque !== snapshot.opaque)
        return "Bản nháp đã thay đổi; chưa xóa. Chọn lại bản cần xóa.";
      const json = JSON.stringify({ ...archive, entries: archive.entries.filter((entry) => entry.key !== key) });
      localStorage.setItem(PRESERVED_SESSION_KEY, json);
      if (localStorage.getItem(PRESERVED_SESSION_KEY) !== json)
        return "Chưa xác nhận được việc xóa bản nháp. Kiểm tra lại danh sách.";
      return "";
    } catch {
      return "Không xóa được bản nháp; bộ nhớ local không khả dụng.";
    }
  };
}

// Clear-all uses the same rule as single deletion: capture the exact archive before asking, and refuse
// if anything was added or changed (for example from another tab) while the dialog was open.
export function preparePreservedEditorSessionsClear(): { count: number; clear: () => string } {
  const snapshot = readPreservedSessions().entries.map((entry) => JSON.stringify(entry));
  return {
    count: snapshot.length,
    clear: () => {
      try {
        const archive = readPreservedSessions();
        if (archive.entries.length !== snapshot.length || archive.entries.some((entry, index) => JSON.stringify(entry) !== snapshot[index]))
          return "Kho bản nháp đã thay đổi; chưa xóa. Mở lại danh sách rồi thử lại.";
        const json = JSON.stringify({ ...archive, entries: [] });
        localStorage.setItem(PRESERVED_SESSION_KEY, json);
        if (localStorage.getItem(PRESERVED_SESSION_KEY) !== json)
          return "Chưa xác nhận được việc xóa bản nháp. Kiểm tra lại danh sách.";
        return "";
      } catch {
        return "Không xóa được bản nháp; bộ nhớ local không khả dụng.";
      }
    },
  };
}
