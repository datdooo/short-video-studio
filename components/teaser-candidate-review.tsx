'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {Check,Play,Pause,RotateCcw,Film} from 'lucide-react';
import type {EditPart} from '@/lib/edit-plan';
import {chooseTeaserAlternative,validateTeaser,hookRangeKey,type Teaser} from '@/lib/teaser-hooks.mjs';
import {formatSourceTimecode} from '@/lib/source-timecode.mjs';
import {PREVIEW_RATE} from '@/lib/preview-config.mjs';
import {explainInVietnamese} from '@/lib/explanation-language.mjs';
import {useEditorDraft} from './editor-draft-context';

type Selected=Extract<Teaser,{status:'selected'}>;
type Choice={id:string;part:EditPart;draft?:boolean};
type PlaybackControl={pause:()=>void};
const choiceId=(h:Selected)=>JSON.stringify([h.selection,h.inputKey,h.start,h.end,h.candidateId||'']);
const seconds=(n:number)=>`${Math.max(0,n).toFixed(1)}s`;
const MAX_CHOICES=24;
function choicesOf(part:EditPart):Choice[]{
 const h=part.teaser;if(h?.status!=='selected')return[];
 const choices:Choice[]=[];
 try{validateTeaser(part);choices.push({id:choiceId(h),part:structuredClone(part)});}catch{return[];}
 for(let index=0;index<(h.alternatives?.length||0);index++)try{const next=chooseTeaserAlternative(part,index);if(next.teaser?.status==='selected')choices.push({id:choiceId(next.teaser),part:next});}catch{/* Malformed optional choices never hide the valid selected excerpt. */}
 return choices;
}
export function TeaserCandidateReview({part,proposed,contextKey,legacyContextKey,hasEdits,sourceUrl,suspended,onAudition,onPlaybackControl,onApply}:{
 part:EditPart;proposed:EditPart|null;contextKey:string;legacyContextKey?:string;hasEdits:boolean;sourceUrl:string;suspended:boolean;onAudition:()=>void;
 onPlaybackControl:(control:PlaybackControl|null)=>void;onApply:(choice:EditPart)=>void;
}){
 const h=part.teaser?.status==='selected'?part.teaser:null,currentId=h?choiceId(h):'';
 const pending=proposed?.teaser?.status==='selected'?proposed.teaser:null;
 const[catalog,setCatalog]=useEditorDraft<{key:string;items:Choice[]}|null>(`teaser-review-catalog-${part.id}`,null,v=>{
  if(v===null)return true;
  try{const value=v as {key:string;items:Choice[]};return typeof value.key==='string'&&Array.isArray(value.items)&&value.items.length<=MAX_CHOICES&&value.items.every(c=>{if(typeof c.id!=='string'||c.part?.id!==part.id||hookRangeKey(c.part)!==hookRangeKey(part)||c.part.teaser?.status!=='selected')return false;validateTeaser(c.part);return c.id===choiceId(c.part.teaser);});}catch{return false;}
 });
 const incoming=[...choicesOf(part),...(proposed&&pending?.selection!=='manual'?choicesOf(proposed):[])];
 const catalogMatches=catalog&&(catalog.key===contextKey||catalog.key===legacyContextKey);
 const choices:Choice[]=catalogMatches&&catalog?[...catalog.items]:[];
 for(const choice of incoming)if(!choices.some(c=>c.id===choice.id))choices.push(choice);
 // Append new analysis results. Apply only changes the current badge; it never
 // sorts/replaces the catalog. Bound UI history, preserving the active choice.
 while(choices.length>MAX_CHOICES){const index=choices.findIndex(c=>c.id!==currentId);choices.splice(index<0?0:index,1);}
 const ids=JSON.stringify(choices.map(c=>c.id));
 const savedChoices=[...choices];
 useEffect(()=>{if(savedChoices.length&&(catalog?.key!==contextKey||JSON.stringify(catalog.items.map(c=>c.id))!==ids))setCatalog({key:contextKey,items:savedChoices});},[contextKey,ids,catalog,setCatalog]);
 if(proposed&&pending?.selection==='manual'&&!choices.some(c=>c.id===choiceId(pending)))choices.push({id:choiceId(pending),part:proposed,draft:true});
 const[focus,setFocus]=useEditorDraft<{scope:string;id:string}|null>(`teaser-review-focus-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'scope'in v&&typeof v.scope==='string'&&'id'in v&&typeof v.id==='string');
 useEffect(()=>{if(legacyContextKey&&focus?.scope===legacyContextKey)setFocus({scope:contextKey,id:focus.id});},[legacyContextKey,contextKey,focus,setFocus]);
 const lastProposal=useRef('');
 const pendingId=pending?choiceId(pending):'';
 useEffect(()=>{if(!pendingId){lastProposal.current='';return;}if(lastProposal.current!==pendingId){lastProposal.current=pendingId;setFocus({scope:contextKey,id:pendingId});}},[pendingId,contextKey,setFocus]);
 const selected=choices.find(c=>c.id===(focus&&(focus.scope===contextKey||focus.scope===legacyContextKey)?focus.id:pendingId||currentId))||choices[0];
 const teaser=selected?.part.teaser?.status==='selected'?selected.part.teaser:null;
 const used=selected?.id===currentId;
 return <aside className="studio-teaser-review" data-has-choice={Boolean(teaser)} aria-label={`Ứng viên teaser Part ${part.id}`}>
  <header className="studio-teaser-review-heading"><div><strong>Ứng viên teaser</strong><span>Part {part.id} · {choices.length} phương án</span></div></header>
  {selected&&teaser?<>
   <RangePlayer key={`${sourceUrl}:${contextKey}:${selected.id}`} sourceUrl={sourceUrl} choice={teaser} suspended={suspended} onAudition={onAudition} onPlaybackControl={onPlaybackControl}/>
   <div className="studio-teaser-review-content">
    <div className="studio-teaser-options" role="group" aria-label="Chọn ứng viên để xem thử">
     {choices.map((choice,index)=>{const t=choice.part.teaser as Selected;return <button type="button" key={choice.id} className="studio-teaser-option" aria-pressed={selected.id===choice.id} onClick={()=>setFocus({scope:contextKey,id:choice.id})}>
      <span className="studio-teaser-option-index">{index+1}</span><span className="studio-teaser-option-copy"><strong>Phương án {index+1}{choice.id===pendingId&&!used?' · Mới':''}</strong><span>{formatSourceTimecode(t.start)} → {formatSourceTimecode(t.end)}</span></span>
      <span className="studio-teaser-option-status">{choice.id===currentId?<><Check size={13}/>Đang dùng</>:seconds((t.end-t.start)/PREVIEW_RATE)}</span>
     </button>;})}
    </div>
    <div className="studio-teaser-review-reason"><p>{explainInVietnamese(teaser.reason)}</p><details><summary>Lời trích và giải thích</summary>
     {teaser.observed&&<p><strong>Lời trích / quan sát:</strong> {explainInVietnamese(teaser.observed)}</p>}
     {teaser.partUnderstanding&&<p><strong>Nội dung part:</strong> {explainInVietnamese(teaser.partUnderstanding)}</p>}
     {teaser.startContext&&<p><strong>Ngữ cảnh mở đầu:</strong> {explainInVietnamese(teaser.startContext)}</p>}
     <p><strong>Liên hệ main:</strong> {explainInVietnamese(teaser.relation)}</p><p><strong>Điểm kết:</strong> {explainInVietnamese(teaser.ending)}</p>
     {teaser.heatmapEvidence&&<p><strong>Most Replayed:</strong> {explainInVietnamese(teaser.heatmapEvidence.reason)}</p>}
     {teaser.limitations.length>0&&<p><strong>Giới hạn:</strong> {teaser.limitations.map(s=>explainInVietnamese(s,'Giới hạn chưa có diễn giải tiếng Việt; dữ liệu gốc vẫn giữ trong plan.')).join(' · ')}</p>}
     <p>{teaser.provider} / {teaser.model}</p>
    </details></div>
   </div>
   <footer className="studio-teaser-review-footer"><span title="Phát video và tiếng nguồn; không render style hoặc trộn nhạc lại">Video nguồn · 1×</span><button type="button" className="studio-primary" disabled={suspended||Boolean(used&&!hasEdits)} onClick={()=>onApply(selected.part)}>{used&&!hasEdits?<><Check size={14}/>Đang dùng</>:used?'Dùng teaser này':'Áp dụng teaser'}</button></footer>
  </>:<div className="studio-teaser-review-empty"><Film size={24}/><strong>Chưa có ứng viên đã lưu</strong><p>Chọn lại bằng AI hoặc nhập mốc trong Timeline.</p></div>}
 </aside>;
}

// Wait for the commanded source seek, not a corrective seek inside onSeeking.
// Available source frame data can have sub-frame rounding; saved ranges stay exact.
function candidateFrameReady(node:HTMLVideoElement,target:number,signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  const events=['loadedmetadata','loadeddata','seeked','canplay'];
  let commanded=false,settled=false;
  function finish(error?:Error){
   if(settled)return;settled=true;
   for(const event of events)node.removeEventListener(event,ready);
   node.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);
   if(error)reject(error);else resolve();
  }
  function aborted(){finish(new DOMException('Candidate playback cancelled','AbortError'));}
  function failed(){finish(new Error('Không đọc được video nguồn. Kiểm tra nguồn đã chuẩn bị.'));}
  function ready(){
   if(signal.aborted){aborted();return;}
   if(node.readyState<1)return;
   if(!commanded){
    commanded=true;
    try{if(Math.abs(node.currentTime-target)>.001){node.currentTime=target;if(node.seeking)return;}}
    catch{failed();return;}
   }
   if(!node.seeking&&node.readyState>=2&&Math.abs(node.currentTime-target)<=1/30+.002)finish();
  }
  for(const event of events)node.addEventListener(event,ready);
  node.addEventListener('error',failed);signal.addEventListener('abort',aborted,{once:true});
  ready();
 });
}

function RangePlayer({sourceUrl,choice,suspended,onAudition,onPlaybackControl}:{sourceUrl:string;choice:Selected;suspended:boolean;onAudition:()=>void;onPlaybackControl:(control:PlaybackControl|null)=>void}){
 const video=useRef<HTMLVideoElement|null>(null),frame=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null),epoch=useRef(0),playIntent=useRef(false);
 const startup=useRef<AbortController|null>(null),requestedTime=useRef(choice.start);
 const[loaded,setLoaded]=useState(false),[playing,setPlaying]=useState(false),[position,setPosition]=useState(choice.start),[error,setError]=useState(''),[buffering,setBuffering]=useState(false);
 const length=(choice.end-choice.start)/PREVIEW_RATE;
 const clearClock=useCallback(()=>{if(frame.current&&video.current?.cancelVideoFrameCallback)video.current.cancelVideoFrameCallback(frame.current);frame.current=0;if(timer.current)clearTimeout(timer.current);timer.current=null;},[]);
 const pause=useCallback(()=>{playIntent.current=false;epoch.current++;startup.current?.abort();startup.current=null;clearClock();video.current?.pause();setPlaying(false);setBuffering(false);},[clearClock]);
 const bind=useCallback((node:HTMLVideoElement|null)=>{const old=video.current;if(old&&old!==node){startup.current?.abort();startup.current=null;clearClock();playIntent.current=false;epoch.current++;old.pause();old.removeAttribute('src');old.load();}video.current=node;},[clearClock]);
 useEffect(()=>{onPlaybackControl({pause});return()=>{playIntent.current=false;epoch.current++;startup.current?.abort();startup.current=null;clearClock();onPlaybackControl(null);};},[onPlaybackControl,pause,clearClock]);
 useEffect(()=>{if(suspended)pause();},[suspended,pause]);
 function startClock(){
  clearClock();const generation=epoch.current;
  const update=()=>{const node=video.current;if(!node||generation!==epoch.current||node.paused||!playIntent.current)return;
   if(!node.seeking){const time=Math.min(choice.end,Math.max(choice.start,node.currentTime));setPosition(previous=>Math.abs(time-previous)>=.1?time:previous);if(node.currentTime>=choice.end-1/120){pause();return;}}
   if(node.requestVideoFrameCallback)frame.current=node.requestVideoFrameCallback(update);else timer.current=setTimeout(update,33);
  };
  update();
 }
 async function prepare(node:HTMLVideoElement,target:number,resume:boolean){
  startup.current?.abort();clearClock();const controller=new AbortController();startup.current=controller;const generation=++epoch.current;
  requestedTime.current=target;setPosition(target);setError('');setBuffering(resume);setPlaying(false);
  node.pause();node.preload='auto';node.playbackRate=PREVIEW_RATE;node.preservesPitch=true;
  const current=()=>video.current===node&&generation===epoch.current&&!controller.signal.aborted;
  const deadline=setTimeout(()=>{if(current()){pause();setError('Chưa chuẩn bị được đoạn ứng viên trong 15 giây. Bấm Phát thử để thử lại.');}},15000);
  controller.signal.addEventListener('abort',()=>clearTimeout(deadline),{once:true});
  try{
   await candidateFrameReady(node,target,controller.signal);
   if(!current()||suspended)return;
   if(resume&&playIntent.current){onAudition();await node.play();if(!current()&&video.current===node&&!playIntent.current)node.pause();}
  }catch(error){
   if(current()){pause();setError(error instanceof Error&&!(error instanceof DOMException)?error.message:'Chưa phát được video. Bấm Phát thử để thử lại.');}
  }finally{clearTimeout(deadline);if(startup.current===controller){startup.current=null;if(!playIntent.current)setBuffering(false);}}
 }
 // Mounting is explicit user intent. Start even if metadata has not arrived;
 // readiness listeners handle both cached/no-op and asynchronous seeks.
 const prepareLatest=useRef(prepare);prepareLatest.current=prepare;
 useEffect(()=>{const node=video.current;if(loaded&&node&&playIntent.current)void prepareLatest.current(node,requestedTime.current,true);},[loaded]);
 function toggle(){
  if(playIntent.current){pause();return;}if(suspended||!sourceUrl)return;
  playIntent.current=true;onAudition();
  if(!loaded){requestedTime.current=choice.start;setLoaded(true);setBuffering(true);}
  else if(video.current){const time=video.current.currentTime;void prepare(video.current,time<choice.start||time>=choice.end-.001?choice.start:time,true);}
 }
 function seek(value:number){
  if(!Number.isFinite(value)||suspended)return;
  const time=Math.min(choice.end,Math.max(choice.start,choice.start+value*PREVIEW_RATE));requestedTime.current=time;setPosition(time);
  if(time>=choice.end)pause();
  if(video.current)void prepare(video.current,time,playIntent.current);
 }
 const active=(node:HTMLVideoElement)=>video.current===node;
 return <div className="studio-teaser-player">
  <div className="studio-teaser-player-picture">
   {loaded&&sourceUrl?<video ref={bind} src={sourceUrl} playsInline preload="auto" aria-label="Video ứng viên · bấm để phát hoặc tạm dừng" onClick={toggle}
    onPlay={e=>{if(!active(e.currentTarget))return;if(suspended||!playIntent.current){pause();return;}onAudition();}}
    onPlaying={e=>{if(!active(e.currentTarget))return;if(suspended||!playIntent.current){pause();return;}setPlaying(true);setBuffering(false);startClock();}}
    onPause={e=>{if(!active(e.currentTarget)||!e.currentTarget.paused)return;clearClock();setPlaying(false);if(!startup.current){playIntent.current=false;setBuffering(false);}}}
    onTimeUpdate={e=>{const node=e.currentTarget;if(!active(node)||node.seeking||startup.current)return;setPosition(Math.min(choice.end,Math.max(choice.start,node.currentTime)));if(playIntent.current&&node.currentTime>=choice.end)pause();}}
    onSeeking={e=>{if(active(e.currentTarget))clearClock();}}
    onSeeked={e=>{if(active(e.currentTarget)&&playIntent.current&&!e.currentTarget.paused&&!startup.current)startClock();}}
    onWaiting={e=>{if(active(e.currentTarget)&&playIntent.current)setBuffering(true);}}
    onError={e=>{if(active(e.currentTarget)){pause();setError('Không đọc được video nguồn. Kiểm tra nguồn đã chuẩn bị.');}}} onEnded={pause}/>:<button type="button" className="studio-teaser-player-start" disabled={suspended||!sourceUrl} onClick={toggle}><Play size={22}/><span>Phát thử ứng viên</span></button>}
   {loaded&&!playing&&!buffering&&<button type="button" className="studio-teaser-player-overlay" aria-label="Phát thử ứng viên" disabled={suspended} onClick={toggle}><Play size={22}/></button>}
  </div>
  <div className="studio-teaser-player-controls"><button type="button" className="studio-control-icon" disabled={suspended||!sourceUrl} aria-label={playing||buffering?'Tạm dừng ứng viên':'Phát thử ứng viên'} onClick={toggle}>{playing||buffering?<Pause size={16}/>:<Play size={16}/>}</button><button type="button" className="studio-control-icon" aria-label="Về đầu ứng viên" disabled={!loaded||suspended} onClick={()=>seek(0)}><RotateCcw size={16}/></button><input type="range" min={0} max={length} step={1/30} value={Math.min(length,Math.max(0,(position-choice.start)/PREVIEW_RATE))} disabled={!loaded||suspended} aria-label="Tua trong ứng viên teaser" onChange={e=>seek(Number(e.target.value))}/><span>{seconds((position-choice.start)/PREVIEW_RATE)} / {seconds(length)}</span></div>
  {error&&<p role="alert" className="studio-inline-error">{error}</p>}
 </div>;
}
