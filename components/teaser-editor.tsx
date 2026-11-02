'use client';
import {useCallback,useContext,useEffect,useMemo,useRef,useState}from'react';
import {createPortal} from 'react-dom';
import {selectionDigest} from '@/lib/teaser-context.mjs';
import {TeaserCandidateReview,choicesOf,validTeaserCatalog,appendTeaserChoices} from './teaser-candidate-review';
import {EditorDraftContext,useEditorDraft,useDraftActivity,draftIdentity} from './editor-draft-context';
import type{ReactNode}from'react';
import type{EditPart}from'@/lib/edit-plan';
import {validateTeaser,hookNeedsReselection,hookRangeKey}from'@/lib/teaser-hooks.mjs';
import {customTimestampPart,parseCustomTeaser}from'@/lib/custom-teaser.mjs';
import {formatSourceTimecode,sourceTimecodeValue}from'@/lib/source-timecode.mjs';
import type{Teaser}from'@/lib/teaser-hooks.mjs';
import type {CaptionTrack} from '@/lib/subtitles.mjs';
import {explainInVietnamese}from'@/lib/explanation-language.mjs';
import {checkHookSpeechBoundaries} from '@/lib/teaser-boundaries.mjs';
type Times={start:string;end:string;exactStart?:number;exactEnd?:number};
const times=(start:number,end:number):Times=>({start:formatSourceTimecode(start),end:formatSourceTimecode(end),exactStart:start,exactEnd:end});
function savedTimes(part:EditPart):Times{
 if(part.teaser?.status==='selected')return times(part.teaser.start,part.teaser.end);
 if(part.customTeaser?.mode==='timestamp'){try{const parsed=parseCustomTeaser(part.customTeaser.input);if(parsed.mode==='timestamp')return times(parsed.start,parsed.end);}catch{/* Invalid legacy input is never installed. */}}
 return{start:'',end:''};
}
function savedInput(part:EditPart){
 const custom=part.customTeaser;if(!custom)return'';
 if(custom.mode==='timestamp'){try{const parsed=parseCustomTeaser(custom.input);if(parsed.mode==='timestamp')return`${formatSourceTimecode(parsed.start)} → ${formatSourceTimecode(parsed.end)}`;}catch{return'';}}
 return custom.input;
}
export function TeaserEditor({statusTarget,issues=[],transition,progress,aiBusy=false,onAuditionControl,reviewTarget,reviewVisible=false,reviewRequest,reviewSourceKey,sourceId,sourceDuration,suspended=false,onDraft,part,cues,sourceUrl,active,onAudition,onChange,onResolve,onToggle}: {statusTarget?:HTMLElement|null;issues?:string[];transition?:ReactNode;progress?:ReactNode;aiBusy?:boolean;onAuditionControl?:(id:number,stop:(()=>void)|null)=>void;reviewTarget?:HTMLElement|null;reviewVisible?:boolean;reviewRequest:string;reviewSourceKey:string;sourceId:string;sourceDuration:number;suspended?:boolean;onDraft?:(id:number,key:string,message:string)=>void;part:EditPart;sourceUrl:string;active:boolean;onAudition:()=>void;cues:{start:number;end:number;text:string}[];onChange:(p:EditPart,captionTrack?:CaptionTrack)=>Promise<void>;onToggle:(enabled:boolean)=>void;onResolve:(input:string,signal:AbortSignal,previousRanges:{start:number;end:number}[])=>Promise<{teaser:Teaser;captionTrack?:CaptionTrack}>}){
 const draftContext=useContext(EditorDraftContext);
 const enabled=part.teaserEnabled!==false;
 // Playback URLs can be blob URLs, or empty while a saved managed source is
 // reopening. Neither is an analysis identity. Keep restored catalogs untouched
 // until source/captions are available, then use its canonical managed media URL.
 const reviewInput=draftIdentity([reviewSourceKey,part.id,part.title,part.hook,part.segments,cues,reviewRequest]);
 const[reviewRevision,setReviewRevision]=useState<{input:string;key:string;legacyKey?:string}|null>(null);
 useEffect(()=>{
  if(!reviewSourceKey)return;let current=true;
  // Preserve old catalogs only when their exact source/content/request hash
  // matches a known URL. An unknown historic blob URL is not guessed.
  const legacyInput=sourceUrl&&sourceUrl!==reviewSourceKey?draftIdentity([sourceUrl,part.id,part.title,part.hook,part.segments,cues,reviewRequest]):null;
  void Promise.all([selectionDigest(reviewInput),legacyInput?selectionDigest(legacyInput):undefined]).then(([key,legacyKey])=>{if(current)setReviewRevision({input:reviewInput,key,legacyKey});});
  return()=>{current=false;};
 },[reviewInput,reviewSourceKey,sourceUrl]);
 const identity=useMemo(()=>draftIdentity([part.segments,part.teaser,part.customTeaser,cues]),[part,cues]);
 const baseline=useMemo(()=>savedTimes(part),[part]);
 const[draft,setDraft]=useEditorDraft<{key:string;times:Times}|null>(`teaser-times-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'key'in v&&typeof v.key==='string'&&'times'in v&&!!v.times&&typeof v.times==='object'&&'start'in v.times&&typeof v.times.start==='string'&&'end'in v.times&&typeof v.times.end==='string'),[inputDraft,setInputDraft]=useEditorDraft<{key:string;text:string}|null>(`teaser-input-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'key'in v&&typeof v.key==='string'&&'text'in v&&typeof v.text==='string');
 const[error,setError]=useState(''),[busy,setBusy]=useState(false),[applying,setApplying]=useState(false),applyPending=useRef(false),request=useRef<AbortController|null>(null);
 const[candidate,setCandidate]=useEditorDraft<{key:string;part:EditPart;captionTrack?:CaptionTrack}|null>(`teaser-candidate-${part.id}`,null,v=>{try{if(v===null)return true;const c=v as {key:string;part:EditPart;captionTrack?:CaptionTrack};if(typeof c.key!=='string'||c.part?.id!==part.id||draftIdentity(c.part.segments)!==draftIdentity(part.segments)||c.part.teaser?.status!=='selected'||!Array.isArray(c.part.teaser.limitations)||!Array.isArray(c.part.teaser.evidenceTimes))return false;validateTeaser(c.part,sourceDuration,sourceId);checkHookSpeechBoundaries(c.part.teaser,c.captionTrack?.cues||cues);return true;}catch{return false;}});
 const [applyAcknowledgement,setApplyAcknowledgement]=useState<{signature:string;revision:number}|null>(null);
 const audition=useRef<{pause:()=>void}|null>(null);
 const bindAudition=useCallback((control:{pause:()=>void}|null)=>{audition.current=control;},[]);
 useDraftActivity(`teaser Part ${part.id}`,enabled&&(busy||applying));
 const proposed=candidate?.key===identity?candidate.part:null,h=proposed?.teaser;
 const values=draft&&draft.key===identity?draft.times:baseline;
 // Raw prompt draft belongs to source/part (context scope), not to changing
 // cues/selected-plan identity. Timing/candidate drafts keep the stricter key.
 const input=inputDraft?inputDraft.text:savedInput(part);
 const inputElement=useRef<HTMLTextAreaElement|null>(null),composing=useRef(false),inputRevision=useRef(0);
 const inputValue=useRef(input);inputValue.current=input;
 useEffect(()=>{
  const node=inputElement.current;
  if(node&&!composing.current&&document.activeElement!==node&&node.value!==input)node.value=input;
 },[input]);
 function writeInput(raw:string){
  if(raw===inputValue.current)return;
  inputValue.current=raw;inputRevision.current++;setApplyAcknowledgement(null);
  request.current?.abort();setBusy(false);setError('');audition.current?.pause();setCandidate(null);
  setInputDraft({key:identity,text:raw});
 }

 const rangeError=useMemo(()=>{
 try{if(draft?.key===identity&&!values.start&&!values.end)throw Error('Nhập đủ mốc bắt đầu/kết thúc teaser.');if(values.start||values.end){const start=sourceTimecodeValue(values.start,values.exactStart),end=sourceTimecodeValue(values.end,values.exactEnd);customTimestampPart(part,`${start}–${end}`,cues,{id:sourceId,duration:sourceDuration});}return '';}
 catch(e){return e instanceof Error?e.message:String(e);}
 },[values,part,cues,draft,identity,sourceId,sourceDuration]);
 useEffect(()=>{let current=true;request.current?.abort();audition.current?.pause();queueMicrotask(()=>{if(current){setBusy(false);setError('');}});return()=>{current=false;request.current?.abort();audition.current?.pause();};},[identity,sourceUrl,sourceId]);
 const draftMessage=!enabled?'':rangeError?`Teaser Part ${part.id}: ${rangeError}`:proposed?`Part ${part.id}: chọn và áp dụng một ứng viên phía trên trước khi xuất.`:busy?`Part ${part.id}: đang chọn teaser, chờ kết quả trước khi xuất.`:'';
 const report=useRef(onDraft);useEffect(()=>{report.current=onDraft;},[onDraft]);
 const rangeKey=hookRangeKey(part);
 useEffect(()=>{report.current?.(part.id,rangeKey,draftMessage);},[part.id,rangeKey,draftMessage]);
 useEffect(()=>{if(!active||suspended||!enabled)audition.current?.pause();if(!enabled)request.current?.abort();},[active,suspended,enabled]);
 useEffect(()=>{onAuditionControl?.(part.id,()=>audition.current?.pause());return()=>onAuditionControl?.(part.id,null);},[part.id,onAuditionControl]);

 function edit(boundary:'start'|'end',value:string){
  inputRevision.current++;setApplyAcknowledgement(null);
  request.current?.abort();audition.current?.pause();setCandidate(null);setBusy(false);setError('');
  const nextTimes={...values,[boundary]:value,[boundary==='start'?'exactStart':'exactEnd']:undefined};setDraft({key:identity,times:nextTimes});
  try{const start=sourceTimecodeValue(nextTimes.start,nextTimes.exactStart),end=sourceTimecodeValue(nextTimes.end,nextTimes.exactEnd),next=customTimestampPart(part,`${start}–${end}`,cues,{id:sourceId,duration:sourceDuration});setCandidate({key:identity,part:next});}
  catch{/* Incomplete/invalid edits stay draft; the saved teaser remains effective. */}
 }
 async function generate(){
  if(!enabled||busy||applyPending.current||aiBusy||composing.current||(request.current&&!request.current.signal.aborted))return;
  if(suspended){setError('Quay lại Editor để chọn teaser.');return;}
  if(!reviewSourceKey||reviewRevision?.input!==reviewInput){setError('Đang chuẩn bị ngữ cảnh teaser. Thử lại sau một chút.');return;}
  request.current?.abort();audition.current?.pause();const controller=new AbortController();request.current=controller;setError('');setBusy(true);
  const revision=inputRevision.current;
  try{
   // Preserve sub-frame legacy values if only pressing the button on an unchanged
   // projected input. Actual edits parse the entered source timecode exactly.
   const raw=inputDraft?(inputElement.current?.value??inputValue.current):(part.customTeaser?.input??inputElement.current?.value??inputValue.current);
   const parsed=parseCustomTeaser(raw);
   if(parsed.mode==='timestamp'){const next=customTimestampPart(part,parsed.input,cues,{id:sourceId,duration:sourceDuration});setCandidate({key:identity,part:next});setDraft({key:identity,times:times(parsed.start,parsed.end)});return;}
   const catalogKey=`${draftContext?.scope}:teaser-review-catalog-${part.id}`;
   const stored=draftContext?.controls[catalogKey];
   const prior=[part,proposed,...(validTeaserCatalog(stored,part)&&(stored.key===reviewRevision.key||stored.key===reviewRevision.legacyKey)?stored.items.map(choice=>choice.part):[])];
   const previousRanges=prior.flatMap(p=>{const h=p?.teaser;return h?.status==='selected'&&Number.isFinite(h.start)&&Number.isFinite(h.end)&&h.start>=0&&h.end>h.start&&h.end<=sourceDuration?[{start:h.start,end:h.end}]:[];})
    .filter((r,i,all)=>all.findIndex(v=>v.start===r.start&&v.end===r.end)===i).slice(0,26);
   const {teaser,captionTrack}=await onResolve(parsed.input,controller.signal,previousRanges);if(controller.signal.aborted||request.current!==controller||revision!==inputRevision.current)return;
   if(teaser.status!=='selected')throw Error(explainInVietnamese(teaser.reason,'Không tìm thấy teaser phù hợp với mô tả; thiếu bằng chứng.'));
   const next={...part,teaser,customTeaser:parsed.mode==='description'?{version:1 as const,mode:'description' as const,input:parsed.input}:undefined};
   // Persist a successful proposal even when the review panel is hidden or
   // another part is visible. The next Generate must not lose this candidate.
   draftContext?.setControls(current=>{const catalog=current[catalogKey];const existing=validTeaserCatalog(catalog,part)&&(catalog.key===reviewRevision.key||catalog.key===reviewRevision.legacyKey)?catalog.items:[];return {...current,[catalogKey]:{key:reviewRevision.key,items:appendTeaserChoices(existing,[...choicesOf(part),...choicesOf(next,captionTrack)],part)}};});
   setCandidate({key:identity,captionTrack,part:next});setDraft({key:identity,times:times(teaser.start,teaser.end)});
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}
  finally{if(request.current===controller){request.current=null;setBusy(false);}}
 }
 const manualSelected=part.teaser?.status==='selected'&&part.teaser.selection==='manual';
 const needsReselection=(!manualSelected&&part.teaserNeedsReselection)||hookNeedsReselection(part);
 const detailMessages=[...new Set([rangeError,error].filter(Boolean))];
 const mainMessage=busy?'Đang chọn teaser…':applying?'Đang áp dụng…':rangeError?'Mốc thời gian chưa hợp lệ.':error.includes('HOOK_REPEAT_SELECTION')?'AI chọn lại đoạn đã có.':error?'Teaser cần kiểm tra.':proposed?'Chưa áp dụng ứng viên.':'';

 async function applyChoice(next:EditPart,captionTrack?:CaptionTrack){
  if(applyPending.current)return;applyPending.current=true;setApplying(true);request.current?.abort();audition.current?.pause();setError('');
  const revision=inputRevision.current;
  try{await onChange(next,captionTrack);setApplyAcknowledgement({signature:JSON.stringify([next.teaser,next.customTeaser]),revision});}
  catch(e){setError(e instanceof Error?e.message:'Chưa áp dụng được teaser.');}
  finally{applyPending.current=false;setApplying(false);}
 }
 return <><section className="studio-teaser-editor min-w-0 space-y-2 text-xs" aria-label={`Teaser Part ${part.id}`}>
  <div className="studio-teaser-header"><h4 className="font-semibold">Teaser {enabled&&(part.teaser?.status==='selected'&&!needsReselection?<span className="studio-connected" aria-label="Đã có teaser">✓</span>:<span className="studio-danger">· cần chọn</span>)}</h4>
   <button type="button" role="switch" aria-checked={enabled} aria-label={`Bật teaser Part ${part.id}`} className="studio-control studio-teaser-toggle" onClick={()=>{request.current?.abort();audition.current?.pause();setBusy(false);setError('');onToggle(!enabled);}}>{enabled?'Đang bật · Tắt teaser':'Đang tắt · Bật teaser'}</button>
  </div>
  <div hidden={!enabled} className="space-y-2">
  <div className="studio-teaser-time-row"><div className="grid min-w-0 grid-cols-2 gap-1.5">{(['start','end']as const).map(boundary=><label key={boundary} className="min-w-0 text-[11px] text-zinc-400">{boundary==='start'?'Bắt đầu':'Kết thúc'}
   <input aria-label={`Teaser Part ${part.id} ${boundary==='start'?'Bắt đầu':'Kết thúc'}`} aria-invalid={Boolean(rangeError)} placeholder="00:00:00:00" autoComplete="off" spellCheck={false} inputMode="text" className="studio-input mt-1 w-full min-w-0 px-2 font-mono text-xs" value={values[boundary]} onChange={e=>edit(boundary,e.target.value)}/>
  </label>)}</div>{transition}</div>
  <label className="block min-w-0 text-zinc-400">Custom Teaser<textarea aria-label={`Custom Teaser Part ${part.id}`} className="studio-textarea mt-1 w-full min-w-0 border p-2 text-xs" rows={1} maxLength={1000} ref={inputElement} defaultValue={input} placeholder="Mô tả footage hoặc 00:01:00:00 → 00:01:10:00" onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={e=>{composing.current=false;writeInput(e.currentTarget.value);}} onChange={e=>writeInput(e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter'&&(composing.current||e.nativeEvent.isComposing||e.nativeEvent.keyCode===229))e.stopPropagation();}} onBlur={e=>{composing.current=false;writeInput(e.currentTarget.value);}}/></label>
  <div className="studio-action-row">
  <button type="button" disabled={busy||applying||suspended||aiBusy} onClick={()=>void generate()} className="max-w-full rounded border border-white/15 px-3 py-2 text-left disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white">{busy?'Đang chọn teaser…':'Tạo/chọn lại teaser'}</button>
  {busy&&<button type="button" className="studio-control" onClick={()=>{request.current?.abort();audition.current?.pause();setBusy(false);setError('Đã dừng chọn teaser.');}}>Dừng chọn teaser</button>}
  </div>

  </div>
 </section>
 {active&&!suspended&&enabled&&statusTarget&&(mainMessage||detailMessages.length>0||busy&&progress)&&createPortal(<div className="studio-timeline-notice" role="status">
  <span>Part {part.id} · {mainMessage||'Teaser cần kiểm tra.'}</span>
  {(detailMessages.length>0||busy&&progress)&&<details><summary>Chi tiết</summary>{detailMessages.map((message,index)=><p key={index} className="break-words">{message}</p>)}{busy&&progress}</details>}
 </div>,statusTarget)}
 {active&&reviewVisible&&reviewTarget&&reviewSourceKey&&reviewRevision?.input===reviewInput&&createPortal(<TeaserCandidateReview part={part} proposed={enabled?proposed:null} proposedCaptionTrack={candidate?.key===identity?candidate.captionTrack:undefined} contextKey={reviewRevision.key} legacyContextKey={reviewRevision.legacyKey} sourceUrl={sourceUrl} suspended={suspended||!enabled||applying} onAudition={onAudition} onPlaybackControl={bindAudition}
  hasEdits={Boolean(draft?.key===identity||inputDraft!==null||proposed)}
  onApply={(next,captionTrack)=>{void applyChoice(next,captionTrack);}}/>,reviewTarget)}
 </>;
}
