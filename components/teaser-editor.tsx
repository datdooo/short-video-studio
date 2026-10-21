'use client';
import {useCallback,useEffect,useMemo,useRef,useState}from'react';
import {createPortal} from 'react-dom';
import {TeaserCandidateReview} from './teaser-candidate-review';
import {useEditorDraft,useDraftActivity,draftIdentity} from './editor-draft-context';
import type{ReactNode}from'react';
import type{EditPart}from'@/lib/edit-plan';
import {chooseTeaserAlternative,validateTeaser,hookNeedsReselection,hookRangeKey,hookDurationLimits}from'@/lib/teaser-hooks.mjs';
import {customTimestampPart,parseCustomTeaser}from'@/lib/custom-teaser.mjs';
import {formatSourceTimecode,sourceTimecodeValue}from'@/lib/source-timecode.mjs';
import type{Teaser}from'@/lib/teaser-hooks.mjs';
import {explainInVietnamese}from'@/lib/explanation-language.mjs';
import {checkHookSpeechBoundaries,hookSpeechBoundaryWarning} from '@/lib/teaser-boundaries.mjs';
import {PREVIEW_RATE}from'@/lib/preview-config.mjs';
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
export function TeaserEditor({transition,onAuditionControl,reviewTarget,reviewVisible=false,onOpenReview,onCloseReview,children,suspended=false,onDraft,part,cues,sourceUrl,active,onAudition,onChange,onResolve,onToggle}:{transition?:ReactNode;onAuditionControl?:(id:number,stop:(()=>void)|null)=>void;reviewTarget?:HTMLElement|null;reviewVisible?:boolean;onOpenReview?:()=>void;onCloseReview?:()=>void;children?:ReactNode;suspended?:boolean;onDraft?:(id:number,key:string,message:string)=>void;part:EditPart;sourceUrl:string;active:boolean;onAudition:()=>void;cues:{start:number;end:number;text:string}[];onChange:(p:EditPart)=>void;onToggle:(enabled:boolean)=>void;onResolve:(input:string,signal:AbortSignal)=>Promise<Teaser>}){
 const enabled=part.teaserEnabled!==false;
 const identity=useMemo(()=>draftIdentity([part.segments,part.teaser,part.customTeaser,cues]),[part,cues]);
 const baseline=useMemo(()=>savedTimes(part),[part]);
 const[draft,setDraft]=useEditorDraft<{key:string;times:Times}|null>(`teaser-times-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'key'in v&&typeof v.key==='string'&&'times'in v&&!!v.times&&typeof v.times==='object'&&'start'in v.times&&typeof v.times.start==='string'&&'end'in v.times&&typeof v.times.end==='string'),[inputDraft,setInputDraft]=useEditorDraft<{key:string;text:string}|null>(`teaser-input-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'key'in v&&typeof v.key==='string'&&'text'in v&&typeof v.text==='string');
 const[error,setError]=useState(''),[busy,setBusy]=useState(false),request=useRef<AbortController|null>(null);
 const[candidate,setCandidate]=useEditorDraft<{key:string;part:EditPart}|null>(`teaser-candidate-${part.id}`,null,v=>{try{if(v===null)return true;const c=v as {key:string;part:EditPart};if(typeof c.key!=='string'||c.part?.id!==part.id||draftIdentity(c.part.segments)!==draftIdentity(part.segments)||c.part.teaser?.status!=='selected'||!Array.isArray(c.part.teaser.limitations)||!Array.isArray(c.part.teaser.evidenceTimes))return false;validateTeaser(c.part);checkHookSpeechBoundaries(c.part.teaser,cues);return true;}catch{return false;}});
 const audition=useRef<{pause:()=>void}|null>(null);
 const bindAudition=useCallback((control:{pause:()=>void}|null)=>{audition.current=control;},[]);
 useDraftActivity(`teaser Part ${part.id}`,enabled&&busy);
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
  inputValue.current=raw;inputRevision.current++;
  request.current?.abort();setBusy(false);setError('');audition.current?.pause();setCandidate(null);
  setInputDraft({key:identity,text:raw});
 }

 const boundaryWarning=useMemo(()=>{const value=proposed?.teaser??part.teaser;return value?.status==='selected'?hookSpeechBoundaryWarning(value,cues):'';},[proposed?.teaser,part.teaser,cues]);
 const {rangeError,previewSeconds}=useMemo(()=>{let rangeError='',previewSeconds:number|undefined;
 try{if(draft?.key===identity&&!values.start&&!values.end)throw Error('Nhập đủ mốc bắt đầu/kết thúc teaser.');if(values.start||values.end){const start=sourceTimecodeValue(values.start,values.exactStart),end=sourceTimecodeValue(values.end,values.exactEnd);previewSeconds=(end-start)/PREVIEW_RATE;customTimestampPart(part,`${start}–${end}`,cues);}}
 catch(e){rangeError=e instanceof Error?e.message:String(e);}
 return{rangeError,previewSeconds};},[values,part,cues,draft,identity]);
 useEffect(()=>{let current=true;request.current?.abort();audition.current?.pause();queueMicrotask(()=>{if(current){setBusy(false);setError('');}});return()=>{current=false;request.current?.abort();audition.current?.pause();};},[identity,sourceUrl]);
 const draftMessage=!enabled?'':rangeError?`Teaser Part ${part.id}: ${rangeError}`:proposed?`Part ${part.id}: áp dụng hoặc bỏ ứng viên teaser trước khi xuất.`:busy?`Part ${part.id}: đang chọn teaser, chờ kết quả trước khi xuất.`:'';
 const report=useRef(onDraft);useEffect(()=>{report.current=onDraft;},[onDraft]);
 const rangeKey=hookRangeKey(part);
 useEffect(()=>{report.current?.(part.id,rangeKey,draftMessage);},[part.id,rangeKey,draftMessage]);
 useEffect(()=>{if(!active||suspended||!enabled)audition.current?.pause();if(!enabled)request.current?.abort();},[active,suspended,enabled]);
 useEffect(()=>{onAuditionControl?.(part.id,()=>audition.current?.pause());return()=>onAuditionControl?.(part.id,null);},[part.id,onAuditionControl]);

 function edit(boundary:'start'|'end',value:string){
  request.current?.abort();audition.current?.pause();setCandidate(null);setBusy(false);setError('');
  const nextTimes={...values,[boundary]:value,[boundary==='start'?'exactStart':'exactEnd']:undefined};setDraft({key:identity,times:nextTimes});
  try{const start=sourceTimecodeValue(nextTimes.start,nextTimes.exactStart),end=sourceTimecodeValue(nextTimes.end,nextTimes.exactEnd),next=customTimestampPart(part,`${start}–${end}`,cues);setCandidate({key:identity,part:next});}
  catch{/* Incomplete/invalid edits stay draft; the saved teaser remains effective. */}
 }
 async function generate(){
  if(!enabled||composing.current)return;
  if(suspended){setError('Tạm dừng trong lúc export; thử lại sau khi xuất xong.');return;}
  request.current?.abort();audition.current?.pause();setCandidate(null);const controller=new AbortController();request.current=controller;setError('');setBusy(true);
  const revision=inputRevision.current;
  try{
   // Preserve sub-frame legacy values if only pressing the button on an unchanged
   // projected input. Actual edits parse the entered source timecode exactly.
   const raw=inputDraft?(inputElement.current?.value??inputValue.current):(part.customTeaser?.input??inputElement.current?.value??inputValue.current);
   const parsed=parseCustomTeaser(raw);
   if(parsed.mode==='timestamp'){const next=customTimestampPart(part,parsed.input,cues);setCandidate({key:identity,part:next});setDraft({key:identity,times:times(parsed.start,parsed.end)});onOpenReview?.();return;}
   const teaser=await onResolve(parsed.input,controller.signal);if(controller.signal.aborted||request.current!==controller||revision!==inputRevision.current)return;
   if(teaser.status!=='selected')throw Error(explainInVietnamese(teaser.reason,'Không tìm thấy teaser phù hợp với mô tả; thiếu bằng chứng.'));
   setCandidate({key:identity,part:{...part,teaser,customTeaser:parsed.mode==='description'?{version:1,mode:'description',input:parsed.input}:undefined}});setDraft({key:identity,times:times(teaser.start,teaser.end)});onOpenReview?.();
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}
  finally{if(request.current===controller&&!controller.signal.aborted)setBusy(false);}
 }
 return <><section className="studio-teaser-editor min-w-0 space-y-2 text-xs" aria-label={`Teaser Part ${part.id}`}>
  <div className="studio-teaser-header"><h4 className="font-semibold">Teaser {enabled&&(part.teaser?.status==='selected'&&!part.teaserNeedsReselection&&!hookNeedsReselection(part)?<span className="studio-connected" aria-label="Đã có teaser">✓</span>:<span className="studio-danger">· cần chọn</span>)}</h4>
   <button type="button" role="switch" aria-checked={enabled} aria-label={`Bật teaser Part ${part.id}`} className="studio-control studio-teaser-toggle" onClick={()=>{request.current?.abort();audition.current?.pause();setBusy(false);setError('');onToggle(!enabled);}}>{enabled?'Đang bật · Tắt teaser':'Đang tắt · Bật teaser'}</button>
  </div>
  {!enabled&&<p className="studio-muted">Chỉ phát/xuất nội dung chính. Teaser và mốc đang nhập vẫn được giữ.</p>}
  <div hidden={!enabled} className="space-y-2">
  <div className="studio-teaser-time-row"><div className="grid min-w-0 grid-cols-2 gap-1.5">{(['start','end']as const).map(boundary=><label key={boundary} className="min-w-0 text-[11px] text-zinc-400">{boundary==='start'?'Bắt đầu':'Kết thúc'}
   <input aria-label={`Teaser Part ${part.id} ${boundary==='start'?'Bắt đầu':'Kết thúc'}`} aria-invalid={Boolean(rangeError)} placeholder="00:00:00:00" autoComplete="off" spellCheck={false} inputMode="text" className="studio-input mt-1 w-full min-w-0 px-2 font-mono text-xs" value={values[boundary]} onChange={e=>edit(boundary,e.target.value)}/>
  </label>)}</div>{transition}</div>
  <p className="studio-teaser-duration">Preview {PREVIEW_RATE}×: {previewSeconds!==undefined&&previewSeconds>0?`${previewSeconds.toFixed(2)} giây`:'—'} · tối đa {hookDurationLimits().maxSourceSeconds/PREVIEW_RATE} giây preview ({hookDurationLimits().maxRenderedSeconds} giây export)</p>
  {boundaryWarning&&<p className="text-amber-200">{boundaryWarning}</p>}
  {rangeError&&<p role="alert" className="text-amber-200">{rangeError} Sửa hoặc bỏ mốc nháp trước khi xuất.</p>}
  {(part.teaserNeedsReselection||hookNeedsReselection(part))&&<p role="alert" className="text-amber-200">Main đã đổi hoặc teaser không còn đủ điều kiện. Cần chọn lại; không tự thay footage.</p>}
  {part.teaser?.status==='unavailable'&&<p role="alert" className="text-amber-200">Part {part.id}: {explainInVietnamese(part.teaser.reason,'Chưa có teaser hợp lệ. Chọn lại bằng AI hoặc nhập mốc nguồn trong Timeline.')}</p>}
  <label className="block min-w-0 text-zinc-400">Custom Teaser<textarea aria-label={`Custom Teaser Part ${part.id}`} className="studio-textarea mt-1 w-full min-w-0 border p-2 text-xs" rows={1} maxLength={1000} ref={inputElement} defaultValue={input} placeholder="Mô tả footage hoặc 00:01:00:00 → 00:01:10:00" onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={e=>{composing.current=false;writeInput(e.currentTarget.value);}} onChange={e=>writeInput(e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter'&&(composing.current||e.nativeEvent.isComposing||e.nativeEvent.keyCode===229))e.stopPropagation();}} onBlur={e=>{composing.current=false;writeInput(e.currentTarget.value);}}/></label>
  {children}
  <details className="text-zinc-500"><summary className="cursor-pointer">Trợ giúp teaser</summary><p className="mt-1">Mô tả hoặc để trống: ChatGPT chọn lại, tránh 10 giây export đầu main. Nhập timestamp thủ công: được chọn cả đầu main, không gọi AI. Mỗi teaser vẫn nằm trọn trong main và tối đa 9 giây export (11.25 giây preview 1×). Giữ lần xuất hiện gốc trong main.</p></details>
  <div className="studio-action-row">
  <button type="button" disabled={busy||suspended} onClick={()=>void generate()} className="max-w-full rounded border border-white/15 px-3 py-2 text-left disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white">{busy?'Đang tìm/kiểm tra…':'Tạo/chọn lại teaser'}</button>
  <button type="button" disabled={suspended||!proposed||h?.status!=='selected'||Boolean(rangeError)} className="studio-primary max-w-full rounded border border-white/15 px-3 py-2 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white" onClick={()=>{if(proposed&&h?.status==='selected'&&!rangeError){audition.current?.pause();onChange(proposed);setCandidate(null);}}}>Áp dụng teaser</button>
  {(draft?.key===identity||inputDraft!==null||proposed)&&<button type="button" className="studio-ghost" onClick={()=>{request.current?.abort();audition.current?.pause();setBusy(false);setDraft(null);setInputDraft(null);setCandidate(null);setError('');}}>Bỏ sửa teaser</button>}
  </div>
  {(proposed||(part.teaser?.status==='selected'&&['ai','external-import'].includes(part.teaser.selection)))&&<button type="button" className="studio-ghost" onClick={onOpenReview}>Xem ứng viên và phát thử</button>}


  {error&&<p role="alert" className="text-amber-200">{explainInVietnamese(error,'Không chọn được teaser; kiểm tra nguồn, kết nối AI hoặc mốc đã nhập.')} Teaser/main hiện tại không thay đổi.</p>}
  </div>
 </section>
 {active&&reviewVisible&&reviewTarget&&createPortal(<TeaserCandidateReview part={part} proposed={enabled?proposed:null} sourceUrl={sourceUrl} suspended={suspended||!enabled} onAudition={onAudition} onPlaybackControl={bindAudition}
  canApplyProposed={Boolean(proposed&&h?.status==='selected'&&!rangeError)}
  onApplyProposed={()=>{if(proposed&&h?.status==='selected'&&!rangeError){audition.current?.pause();onChange(proposed);setCandidate(null);}}}
  onApplyAlternative={index=>{request.current?.abort();audition.current?.pause();onChange(chooseTeaserAlternative(part,index));setDraft(null);setInputDraft(null);setCandidate(null);setError('');}}
  onClose={()=>{audition.current?.pause();onCloseReview?.();}}/>,reviewTarget)}
 </>;
}
