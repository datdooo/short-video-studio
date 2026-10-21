'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {Check,Play,Pause,RotateCcw,X,Film} from 'lucide-react';
import type {EditPart} from '@/lib/edit-plan';
import type {Teaser} from '@/lib/teaser-hooks.mjs';
import {formatSourceTimecode} from '@/lib/source-timecode.mjs';
import {PREVIEW_RATE} from '@/lib/preview-config.mjs';
import {explainInVietnamese} from '@/lib/explanation-language.mjs';
import {useEditorDraft} from './editor-draft-context';

type Selected=Extract<Teaser,{status:'selected'}>;
type Choice={id:string;teaser:Selected;alternativeIndex?:number;draft?:boolean};
type PlaybackControl={pause:()=>void};
const choiceId=(h:Selected)=>JSON.stringify([h.start,h.end,h.candidateId||'']);
const seconds=(n:number)=>`${Math.max(0,n).toFixed(1)}s`;

export function TeaserCandidateReview({part,proposed,sourceUrl,suspended,onAudition,onPlaybackControl,onApplyAlternative,onApplyProposed,canApplyProposed,onClose}:{
 part:EditPart;proposed:EditPart|null;sourceUrl:string;suspended:boolean;onAudition:()=>void;
 onPlaybackControl:(control:PlaybackControl|null)=>void;onApplyAlternative:(index:number)=>void;
 onApplyProposed:()=>void;canApplyProposed:boolean;onClose:()=>void;
}){
 const h=part.teaser?.status==='selected'?part.teaser:null;
 const saved:Choice[]=h&&['ai','external-import'].includes(h.selection)
  ?[{id:choiceId(h),teaser:h},...(h.alternatives||[]).map((choice,index)=>{const teaser={...h,...choice,alternatives:undefined} as Selected;return{id:choiceId(teaser),teaser,alternativeIndex:index};})]:[];
 // The selected excerpt changes on Apply; the analysis input does not. Keep
 // card order in existing source/part UI drafts, separate from the EditPlan.
 const analysisKey=h?JSON.stringify([sourceUrl,h.inputKey,h.rangeKey,h.binding?.contextKey]):sourceUrl;
 const[order,setOrder]=useEditorDraft<{key:string;ids:string[]}|null>(`teaser-review-order-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'key'in v&&typeof v.key==='string'&&'ids'in v&&Array.isArray(v.ids)&&v.ids.length<=3&&v.ids.every(id=>typeof id==='string'));
 const unique=[...new Map(saved.map(c=>[c.id,c])).values()];
 const ids=unique.map(c=>c.id),orderedIds=[...(order?.key===analysisKey?order.ids.filter(id=>ids.includes(id)):[]),...ids.filter(id=>order?.key!==analysisKey||!order.ids.includes(id))];
 const orderValue=JSON.stringify(orderedIds);
 useEffect(()=>{if(unique.length&&(order?.key!==analysisKey||JSON.stringify(order.ids)!==orderValue))setOrder({key:analysisKey,ids:orderedIds});},[analysisKey,orderValue,order,setOrder]);
 const choices=orderedIds.map(id=>unique.find(c=>c.id===id)!);
 const pending=proposed?.teaser?.status==='selected'?proposed.teaser:null;
 if(pending)choices.push({id:'draft',teaser:pending,draft:true});
 const scope=JSON.stringify([analysisKey,pending?.inputKey,pending?.start,pending?.end]);
 const[focus,setFocus]=useEditorDraft<{scope:string;id:string}|null>(`teaser-review-focus-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'scope'in v&&typeof v.scope==='string'&&'id'in v&&typeof v.id==='string');
 const selected=choices.find(c=>c.id===(focus?.scope===scope?focus.id:pending?'draft':h?choiceId(h):''))||choices[0];
 const used=selected&&!selected.draft&&h&&selected.id===choiceId(h);
 return <aside className="studio-teaser-review" aria-label={`Ứng viên teaser Part ${part.id}`}>
  <header className="studio-teaser-review-heading"><div><strong>Ứng viên teaser</strong><span>Part {part.id} · {choices.length} phương án</span></div><button type="button" className="studio-control-icon" aria-label="Đóng ứng viên teaser" onClick={onClose}><X size={16}/></button></header>
  {selected?<>
   <RangePlayer key={`${sourceUrl}:${scope}:${selected.id}`} sourceUrl={sourceUrl} choice={selected.teaser} suspended={suspended} onAudition={onAudition} onPlaybackControl={onPlaybackControl}/>
   <div className="studio-teaser-review-content">
    <div className="studio-teaser-options" role="group" aria-label="Chọn ứng viên để xem thử">
     {choices.map((choice,index)=><button type="button" key={choice.id} className="studio-teaser-option" aria-pressed={selected.id===choice.id} onClick={()=>setFocus({scope,id:choice.id})}>
      <span className="studio-teaser-option-index">{choice.draft?'Mới':index+1}</span><span className="studio-teaser-option-copy"><strong>{choice.draft?'Ứng viên chưa áp dụng':`Phương án ${index+1}`}</strong><span>{formatSourceTimecode(choice.teaser.start)} → {formatSourceTimecode(choice.teaser.end)}</span></span>
      <span className="studio-teaser-option-status">{!choice.draft&&h&&choice.id===choiceId(h)?<><Check size={13}/>Đang dùng</>:seconds((choice.teaser.end-choice.teaser.start)/PREVIEW_RATE)}</span>
     </button>)}
    </div>
    <div className="studio-teaser-review-reason"><p>{explainInVietnamese(selected.teaser.reason)}</p><details><summary>Lời trích và giải thích</summary>
     {selected.teaser.observed&&<p><strong>Lời trích / quan sát:</strong> {explainInVietnamese(selected.teaser.observed)}</p>}
     {selected.teaser.partUnderstanding&&<p><strong>Nội dung part:</strong> {explainInVietnamese(selected.teaser.partUnderstanding)}</p>}
     <p><strong>Liên hệ main:</strong> {explainInVietnamese(selected.teaser.relation)}</p><p><strong>Điểm kết:</strong> {explainInVietnamese(selected.teaser.ending)}</p>
     {selected.teaser.limitations.length>0&&<p><strong>Giới hạn:</strong> {selected.teaser.limitations.map(s=>explainInVietnamese(s,'Giới hạn chưa có diễn giải tiếng Việt; dữ liệu gốc vẫn giữ trong plan.')).join(' · ')}</p>}
    </details></div>
   </div>
   <footer className="studio-teaser-review-footer"><span title="Phát video và tiếng nguồn; không render style hoặc trộn nhạc lại">Video nguồn · 1×</span><button type="button" className="studio-primary" disabled={suspended||Boolean(used)||(selected.draft?!canApplyProposed:selected.alternativeIndex===undefined)} onClick={()=>selected.draft?onApplyProposed():selected.alternativeIndex!==undefined&&onApplyAlternative(selected.alternativeIndex)}>{used?<><Check size={14}/>Đang dùng</>:<>Áp dụng teaser</>}</button></footer>
  </>:<div className="studio-teaser-review-empty"><Film size={24}/><strong>Chưa có ứng viên AI đã lưu</strong><p>Chọn lại bằng AI hoặc nhập Custom Teaser trong Timeline. Kết quả sẽ xuất hiện ở đây để xem thử.</p></div>}
 </aside>;
}

function RangePlayer({sourceUrl,choice,suspended,onAudition,onPlaybackControl}:{sourceUrl:string;choice:Selected;suspended:boolean;onAudition:()=>void;onPlaybackControl:(control:PlaybackControl|null)=>void}){
 const video=useRef<HTMLVideoElement|null>(null),frame=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null),epoch=useRef(0),playIntent=useRef(false);
 const[loaded,setLoaded]=useState(false),[playing,setPlaying]=useState(false),[position,setPosition]=useState(choice.start),[error,setError]=useState(''),[buffering,setBuffering]=useState(false);
 const length=(choice.end-choice.start)/PREVIEW_RATE;
 const clearClock=useCallback(()=>{if(frame.current&&video.current?.cancelVideoFrameCallback)video.current.cancelVideoFrameCallback(frame.current);frame.current=0;if(timer.current)clearTimeout(timer.current);timer.current=null;},[]);
 const pause=useCallback(()=>{playIntent.current=false;epoch.current++;clearClock();video.current?.pause();setPlaying(false);setBuffering(false);},[clearClock]);
 const bind=useCallback((node:HTMLVideoElement|null)=>{const old=video.current;if(old&&old!==node){clearClock();playIntent.current=false;epoch.current++;old.pause();old.removeAttribute('src');old.load();}video.current=node;},[clearClock]);
 useEffect(()=>{onPlaybackControl({pause});return()=>{playIntent.current=false;epoch.current++;clearClock();onPlaybackControl(null);};},[onPlaybackControl,pause,clearClock]);
 useEffect(()=>{if(suspended)pause();},[suspended,pause]);
 function startClock(){
  clearClock();const generation=epoch.current;
  const update=()=>{const node=video.current;if(!node||generation!==epoch.current||node.paused||!playIntent.current)return;const time=Math.min(choice.end,Math.max(choice.start,node.currentTime));setPosition(previous=>Math.abs(time-previous)>=.1?time:previous);if(node.currentTime>=choice.end-1/120){pause();return;}if(node.requestVideoFrameCallback)frame.current=node.requestVideoFrameCallback(update);else timer.current=setTimeout(update,33);};
  update();
 }
 async function play(node:HTMLVideoElement){
  if(suspended||!playIntent.current||video.current!==node)return;
  onAudition();setError('');node.playbackRate=PREVIEW_RATE;node.preservesPitch=true;
  if(node.currentTime<choice.start||node.currentTime>=choice.end-.001)node.currentTime=choice.start;
  const generation=++epoch.current;
  try{await node.play();if(generation!==epoch.current){if(video.current===node&&!playIntent.current)node.pause();return;}}
  catch{if(generation===epoch.current){setError('Chưa phát được video. Bấm Phát thử để thử lại.');pause();}}
 }
 function toggle(){if(playIntent.current){pause();return;}if(suspended||!sourceUrl)return;playIntent.current=true;onAudition();if(!loaded){setLoaded(true);setBuffering(true);}else if(video.current)void play(video.current);}
 function seek(value:number){const time=choice.start+value*PREVIEW_RATE;setPosition(time);if(video.current){video.current.currentTime=time;if(time>=choice.end)pause();}}
 return <div className="studio-teaser-player">
  <div className="studio-teaser-player-picture">
   {loaded&&sourceUrl?<video ref={bind} src={sourceUrl} playsInline preload="metadata" aria-label="Phát thử ứng viên từ video nguồn" onLoadedMetadata={e=>{if(e.currentTarget!==video.current)return;e.currentTarget.currentTime=choice.start;if(playIntent.current)void play(e.currentTarget);}} onPlay={()=>{if(suspended||!playIntent.current){pause();return;}onAudition();setPlaying(true);setBuffering(false);startClock();}} onPlaying={()=>{if(suspended||!playIntent.current){pause();return;}setBuffering(false);startClock();}} onPause={e=>{if(!e.currentTarget.paused)return;playIntent.current=false;clearClock();setPlaying(false);setBuffering(false);}} onTimeUpdate={e=>{setPosition(Math.min(choice.end,Math.max(choice.start,e.currentTarget.currentTime)));if(e.currentTarget.currentTime>=choice.end)pause();}} onSeeking={e=>{if(e.currentTarget.currentTime<choice.start||e.currentTarget.currentTime>choice.end)e.currentTarget.currentTime=Math.min(choice.end,Math.max(choice.start,e.currentTarget.currentTime));}} onWaiting={()=>{if(playIntent.current)setBuffering(true);}} onError={()=>{pause();setError('Không đọc được video nguồn. Kiểm tra nguồn đã chuẩn bị.');}} onEnded={pause}/>:<button type="button" className="studio-teaser-player-start" disabled={suspended||!sourceUrl} onClick={toggle}><Play size={22}/><span>Phát thử ứng viên</span></button>}
   {loaded&&!playing&&!buffering&&<button type="button" className="studio-teaser-player-overlay" aria-label="Phát thử ứng viên" disabled={suspended} onClick={toggle}><Play size={22}/></button>}
   {buffering&&<span className="studio-teaser-player-loading" role="status">Đang tải đoạn nguồn…</span>}
  </div>
  <div className="studio-teaser-player-controls"><button type="button" className="studio-control-icon" disabled={suspended||!sourceUrl} aria-label={playing?'Tạm dừng ứng viên':'Phát thử ứng viên'} onClick={toggle}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><button type="button" className="studio-control-icon" aria-label="Về đầu ứng viên" disabled={!loaded||suspended} onClick={()=>seek(0)}><RotateCcw size={16}/></button><input type="range" min={0} max={length} step={1/30} value={Math.min(length,Math.max(0,(position-choice.start)/PREVIEW_RATE))} disabled={!loaded||suspended} aria-label="Tua trong ứng viên teaser" onChange={e=>seek(Number(e.target.value))}/><span>{seconds((position-choice.start)/PREVIEW_RATE)} / {seconds(length)}</span></div>
  {error&&<p role="alert" className="studio-inline-error">{error}</p>}
 </div>;
}
