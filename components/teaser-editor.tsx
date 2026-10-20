'use client';
import {useCallback,useEffect,useMemo,useRef,useState}from'react';
import {useEditorDraft,useDraftActivity,draftIdentity} from './editor-draft-context';
import type{EditPart}from'@/lib/edit-plan';
import {chooseTeaserAlternative,hookNeedsReselection}from'@/lib/teaser-hooks.mjs';
import {customTimestampPart,parseCustomTeaser}from'@/lib/custom-teaser.mjs';
import {formatSourceTimecode,sourceTimecodeValue,parseSourceTimecode}from'@/lib/source-timecode.mjs';
import type{Teaser}from'@/lib/teaser-hooks.mjs';
import {explainInVietnamese}from'@/lib/explanation-language.mjs';
import {PLAYBACK_RATE}from'@/lib/render-config.mjs';
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
export function TeaserEditor({part,cues,sourceUrl,active,onAudition,onChange,onResolve}:{part:EditPart;sourceUrl:string;active:boolean;onAudition:()=>void;cues:{start:number;end:number;text:string}[];onChange:(p:EditPart)=>void;onResolve:(input:string,signal:AbortSignal)=>Promise<Teaser>}){
 const identity=useMemo(()=>draftIdentity([part.segments,part.teaser,part.customTeaser,cues]),[part,cues]);
 const baseline=useMemo(()=>savedTimes(part),[part]);
 const[draft,setDraft]=useEditorDraft<{key:string;times:Times}|null>(`teaser-times-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'key'in v&&typeof v.key==='string'&&'times'in v&&!!v.times&&typeof v.times==='object'&&'start'in v.times&&typeof v.times.start==='string'&&'end'in v.times&&typeof v.times.end==='string'),[inputDraft,setInputDraft]=useEditorDraft<{key:string;text:string}|null>(`teaser-input-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'key'in v&&typeof v.key==='string'&&'text'in v&&typeof v.text==='string');
 const[error,setError]=useState(''),[busy,setBusy]=useState(false),request=useRef<AbortController|null>(null);
 const[candidate,setCandidate]=useEditorDraft<{key:string;part:EditPart}|null>(`teaser-candidate-${part.id}`,null,v=>{try{if(v===null)return true;const c=v as {key:string;part:EditPart};if(typeof c.key!=='string'||c.part?.id!==part.id||draftIdentity(c.part.segments)!==draftIdentity(part.segments)||c.part.teaser?.status!=='selected'||!Array.isArray(c.part.teaser.limitations)||!Array.isArray(c.part.teaser.evidenceTimes))return false;customTimestampPart(part,`${c.part.teaser.start}–${c.part.teaser.end}`,cues);return true;}catch{return false;}}),[showPreview,setShowPreview]=useState(false),preview=useRef<HTMLVideoElement|null>(null);
 useDraftActivity(`teaser Part ${part.id}`,busy);
 const proposed=candidate?.key===identity?candidate.part:null,h=proposed?.teaser;
 const values=draft&&draft.key===identity?draft.times:baseline;
 const input=inputDraft?.key===identity?inputDraft.text:savedInput(part);
 const {rangeError,rendered}=useMemo(()=>{let rangeError='',rendered:number|undefined;
 try{if(values.start||values.end){const start=sourceTimecodeValue(values.start,values.exactStart),end=sourceTimecodeValue(values.end,values.exactEnd);rendered=(end-start)/PLAYBACK_RATE;customTimestampPart(part,`${start}–${end}`,cues);}}
 catch(e){rangeError=e instanceof Error?e.message:String(e);}
 return{rangeError,rendered};},[values,part,cues]);
 useEffect(()=>{let current=true;request.current?.abort();preview.current?.pause();queueMicrotask(()=>{if(current){setBusy(false);setError('');}});return()=>{current=false;request.current?.abort();preview.current?.pause();};},[identity]);
 useEffect(()=>{if(!active)preview.current?.pause();},[active]);
 const bindPreview=useCallback((video:HTMLVideoElement|null)=>{const previous=preview.current;if(previous&&previous!==video){previous.pause();previous.removeAttribute('src');previous.load();}preview.current=video;},[]);
 function edit(boundary:'start'|'end',value:string){
  request.current?.abort();preview.current?.pause();setShowPreview(false);setCandidate(null);setBusy(false);setError('');
  const nextTimes={...values,[boundary]:value,[boundary==='start'?'exactStart':'exactEnd']:undefined};setDraft({key:identity,times:nextTimes});
  try{const start=sourceTimecodeValue(nextTimes.start,nextTimes.exactStart),end=sourceTimecodeValue(nextTimes.end,nextTimes.exactEnd),next=customTimestampPart(part,`${start}–${end}`,cues);setCandidate({key:identity,part:next});}
  catch{/* Incomplete/invalid edits stay draft; the saved teaser remains effective. */}
 }
 async function generate(){
  request.current?.abort();preview.current?.pause();setShowPreview(false);setCandidate(null);const controller=new AbortController();request.current=controller;setError('');setBusy(true);
  try{
   // Preserve sub-frame legacy values if only pressing the button on an unchanged
   // projected input. Actual edits parse the entered source timecode exactly.
   const raw=inputDraft?.key===identity?input:part.customTeaser?.input||input;
   const parsed=parseCustomTeaser(raw);
   if(parsed.mode==='timestamp'){if(inputDraft?.key===identity){const fields=input.split(/\s*[–—→-]\s*/u);if(fields.length!==2)throw Error('Nhập một range HH:MM:SS:FF → HH:MM:SS:FF.');fields.forEach(parseSourceTimecode);}const next=customTimestampPart(part,parsed.input,cues);setCandidate({key:identity,part:next});setDraft({key:identity,times:times(parsed.start,parsed.end)});return;}
   const teaser=await onResolve(parsed.input,controller.signal);if(controller.signal.aborted)return;
   if(teaser.status!=='selected')throw Error(explainInVietnamese(teaser.reason,'Không tìm thấy teaser phù hợp với mô tả; thiếu bằng chứng.'));
   setCandidate({key:identity,part:{...part,teaser,customTeaser:parsed.mode==='description'?{version:1,mode:'description',input:parsed.input}:undefined}});setDraft({key:identity,times:times(teaser.start,teaser.end)});
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}
  finally{if(request.current===controller&&!controller.signal.aborted)setBusy(false);}
 }
 return <section className="min-w-0 space-y-2 text-xs" aria-label={`Teaser Part ${part.id}`}>
  <h4 className="font-semibold">Teaser</h4>
  <div className="grid min-w-0 grid-cols-2 gap-2">{(['start','end']as const).map(boundary=><label key={boundary} className="min-w-0 text-[11px] text-zinc-400">{boundary==='start'?'Bắt đầu':'Kết thúc'}
   <input aria-label={`Teaser Part ${part.id} ${boundary==='start'?'Bắt đầu':'Kết thúc'}`} aria-invalid={Boolean(rangeError)} placeholder="00:00:00:00" autoComplete="off" spellCheck={false} inputMode="text" className="studio-input mt-1 w-full min-w-0 px-2 font-mono text-xs" value={values[boundary]} onChange={e=>edit(boundary,e.target.value)}/>
  </label>)}</div>
  <p className="text-zinc-500">Sau {PLAYBACK_RATE}×: {rendered!==undefined&&rendered>0?`${rendered.toFixed(2)} giây`:'—'} · tối đa 9 giây. Phát thêm trước main; giữ lần xuất hiện gốc.</p>
  {rangeError&&<p role="alert" className="text-amber-200">{rangeError} Chưa áp dụng; preview/export giữ teaser đã lưu.</p>}
  {(part.teaserNeedsReselection||hookNeedsReselection(part))&&<p role="alert" className="text-amber-200">Main đã đổi hoặc teaser không còn đủ điều kiện. Cần chọn lại; không tự thay footage.</p>}
  {part.teaser?.status==='unavailable'&&<p className="text-amber-200">Chưa có teaser hợp lệ. Chọn lại bằng AI hoặc nhập mốc nguồn trong Timeline.</p>}
  <label className="block min-w-0 text-zinc-400">Custom Teaser<textarea aria-label={`Custom Teaser Part ${part.id}`} className="studio-textarea mt-1 w-full min-w-0 border p-2 text-xs" rows={2} maxLength={1000} value={input} placeholder="Mô tả footage hoặc 00:01:00:00 → 00:01:10:00" onChange={e=>{request.current?.abort();setBusy(false);setError('');preview.current?.pause();setShowPreview(false);setCandidate(null);setInputDraft({key:identity,text:e.target.value});}}/></label>
  <p className="text-[11px] text-zinc-500">Mô tả hoặc để trống: chọn lại bằng ChatGPT. Timestamp: dùng đúng mốc nguồn, không gọi AI. Không thay main; loại 10 giây rendered đầu main. Ứng viên hợp lệ có thể áp dụng ngay; nghe/xem thử là tùy chọn. Cần tự kiểm tra trọn nghĩa.</p>
  <button type="button" disabled={busy} onClick={()=>void generate()} className="max-w-full rounded border border-white/15 px-3 py-2 text-left disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white">{busy?'Đang tìm/kiểm tra…':'Tạo/chọn lại teaser'}</button>
  <button type="button" disabled={!proposed||h?.status!=='selected'||Boolean(rangeError)} className="ml-2 max-w-full rounded border border-white/15 px-3 py-2 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white" onClick={()=>{if(proposed&&h?.status==='selected'&&!rangeError){preview.current?.pause();onChange(proposed);setCandidate(null);setShowPreview(false);}}}>Áp dụng teaser</button>
  {proposed&&h?.status==='selected'&&<div className="space-y-2 rounded border border-white/10 p-2"><p className="text-zinc-400">Ứng viên chưa áp dụng · dùng hai mốc nguồn phía trên.</p><p>{explainInVietnamese(h.reason)}</p><p>{explainInVietnamese(h.ending)}</p><button type="button" onClick={()=>{onAudition();setShowPreview(v=>!v);preview.current?.pause();}} className="rounded border border-white/15 px-3 py-2">Nghe / xem thử · tùy chọn</button>
   {showPreview&&<video key={`${h.start}:${h.end}`} ref={bindPreview} src={sourceUrl} controls playsInline preload="metadata" className="max-h-48 w-full" onLoadedMetadata={e=>{if(e.currentTarget!==preview.current)return;e.currentTarget.currentTime=h.start;e.currentTarget.playbackRate=PLAYBACK_RATE;}} onSeeking={e=>{if(e.currentTarget.currentTime<h.start||e.currentTarget.currentTime>h.end)e.currentTarget.currentTime=h.start;}} onTimeUpdate={e=>{if(e.currentTarget.currentTime>=h.end)e.currentTarget.pause();}} onPlay={e=>{if(e.currentTarget!==preview.current)return;onAudition();if(e.currentTarget.currentTime<h.start||e.currentTarget.currentTime>=h.end)e.currentTarget.currentTime=h.start;}}/>}
  </div>}
  {!part.customTeaser&&part.teaser?.status==='selected'&&!!part.teaser.alternatives?.length&&<button type="button" className="ml-2 max-w-full rounded border border-white/15 px-3 py-2" onClick={()=>onChange(chooseTeaserAlternative(part,0))}>Phương án AI đã lưu ({part.teaser.alternatives.length})</button>}
  {error&&<p role="alert" className="text-amber-200">{explainInVietnamese(error,'Không chọn được teaser; kiểm tra nguồn, kết nối AI hoặc mốc đã nhập.')} Teaser/main hiện tại không thay đổi.</p>}
 </section>;
}
