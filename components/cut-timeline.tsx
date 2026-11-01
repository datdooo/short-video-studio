'use client';
import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {TimelineAction,TimelineRow} from '@xzdarcy/timeline-engine';
import type {TimelineState} from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import type {EditPart} from '@/lib/edit-plan';
import {presentationSegments,adjustTeaserRange,validateTeaser} from '@/lib/teaser-hooks.mjs';
import {segmentDuration,isStillSegment} from '@/lib/render-config.mjs';
import {formatSourceTimecode} from '@/lib/source-timecode.mjs';
import {rangeTime,type MainRangeRow} from '@/lib/main-ranges.mjs';
// MIT package owns ruler, virtualization, pointer capture, resize and autoscroll.
// It never plays media: the existing preview deck remains the only clock.
const Timeline=lazy(()=>import('@xzdarcy/react-timeline-editor').then(module=>({default:module.Timeline})));
type Range={start:number;end:number};
type Clip={id:string;kind:'main'|'teaser'|'padding';index:number;start:number;end:number;sourceStart:number;sourceEnd:number};
type Edit={kind:'main';ranges:Range[]}|{kind:'teaser';part:EditPart};
type Command={before:Edit;after:Edit};
type Props={part:EditPart;sourceId:string;duration:number;currentTime:number;disabled:boolean;cues:{start:number;end:number;text:string}[];onSeek:(time:number)=>void;onMain:(rows:MainRangeRow[])=>void;checkMain:(rows:MainRangeRow[])=>string;onTeaser:(part:EditPart)=>Promise<void>};
const rowsFor=(ranges:Range[]):MainRangeRow[]=>ranges.map(r=>({start:rangeTime(r.start),end:rangeTime(r.end),exactStart:r.start,exactEnd:r.end,timecode:true}));
const stateKey=(part:EditPart)=>JSON.stringify([part.title,part.hook,part.segments,part.teaser,part.customTeaser,part.teaserEnabled]);
export function CutTimeline(props:Props){
 const {part,sourceId,duration,currentTime,disabled,cues,checkMain}=props;
 const [mounted,setMounted]=useState(false),[zoom,setZoom]=useState(8),[snap,setSnap]=useState(false),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[remount,setRemount]=useState(0);
 const [history,setHistory]=useState<Command[]>([]),[future,setFuture]=useState<Command[]>([]);
 const engine=useRef<TimelineState|null>(null),pending=useRef(false),cancelled=useRef(false),gesture=useRef<{key:string;clip:Clip}|null>(null),live=useRef(props);live.current=props;
 const seekFrame=useRef<number|null>(null),seekTime=useRef(0);
 function seek(time:number){seekTime.current=Math.min(total,Math.max(0,time));if(seekFrame.current===null)seekFrame.current=requestAnimationFrame(()=>{seekFrame.current=null;live.current.onSeek(seekTime.current);});}
 useEffect(()=>()=>{if(seekFrame.current!==null)cancelAnimationFrame(seekFrame.current);},[]);
 const bindEngine=useCallback((value:TimelineState|null)=>{engine.current=value;value?.setTime(live.current.currentTime);},[]);
 const expected=useRef<string|null>(null),key=stateKey(part),lastKey=useRef(key);
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{if(lastKey.current!==key){if(expected.current!==key&&expected.current!=='main-pending'){setHistory([]);setFuture([]);}lastKey.current=key;expected.current=null;gesture.current=null;}},[key]);
 useEffect(()=>{engine.current?.setTime(currentTime);},[currentTime,remount,mounted]);
 const clips=useMemo(()=>{
  const segments=presentationSegments(part),hasTeaser=segments!==part.segments;let at=0,mainIndex=0;
  return segments.map((s,index)=>{const start=at;at+=segmentDuration(s);const kind=index===0&&hasTeaser?'teaser':s.isPadding||isStillSegment(s)?'padding':'main';return{id:`${kind}-${index}`,kind,index:kind!=='teaser'&&!s.isPadding?mainIndex++:-1,start,end:at,sourceStart:s.start,sourceEnd:s.end} as Clip;});
 },[key]);
 const total=clips.at(-1)?.end||0;
 const data=useMemo<TimelineRow[]>(()=>['teaser','main'].map(kind=>({id:kind,rowHeight:44,actions:clips.filter(c=>kind==='teaser'?c.kind==='teaser':c.kind!=='teaser').map(c=>({id:c.id,start:c.start,end:c.end,effectId:'clip',movable:false,flexible:!disabled&&!busy&&c.kind!=='padding',selected:c.id===selected,minStart:0,maxEnd:c.start+duration}))})),[clips,disabled,busy,selected,duration,remount]);
 function abortGesture(){cancelled.current=true;gesture.current=null;setRemount(n=>n+1);}
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&gesture.current){e.preventDefault();abortGesture();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
 function currentRanges(){return live.current.part.segments.filter(s=>!s.isPadding).map(({start,end})=>({start,end}));}
 function proposal(clip:Clip,start:number,end:number,dir:'left'|'right'):Edit{
  // A trim changes a SOURCE endpoint; it never moves the chosen source footage.
  let time=dir==='left'?clip.sourceStart+(start-clip.start):clip.sourceEnd+(end-clip.end);
  if(snap)time=Math.round(time*30)/30;
  if(clip.kind==='teaser'){
   const next=adjustTeaserRange(live.current.part,dir==='left'?time:clip.sourceStart,dir==='right'?time:clip.sourceEnd,cues,{id:sourceId,duration});
   validateTeaser(next,duration,sourceId);return{kind:'teaser',part:next};
  }
  const ranges=currentRanges();ranges[clip.index]={start:dir==='left'?time:clip.sourceStart,end:dir==='right'?time:clip.sourceEnd};
  const invalid=checkMain(rowsFor(ranges));if(invalid)throw Error(invalid);return{kind:'main',ranges};
 }
 async function apply(edit:Edit){
  if(edit.kind==='main'){
   const invalid=live.current.checkMain(rowsFor(edit.ranges));if(invalid)throw Error(invalid);
   live.current.onMain(rowsFor(edit.ranges));
   // Main handler maintains AI/manual retention bindings; acknowledge its new
   // projection in the next effect instead of manufacturing those bindings here.
   expected.current='main-pending';
  }else{await live.current.onTeaser(edit.part);expected.current=stateKey({...live.current.part,teaser:edit.part.teaser,customTeaser:edit.part.customTeaser,teaserNeedsReselection:false});}
 }
 async function commit(command:Command,direction:'new'|'undo'|'redo'){
  if(pending.current||live.current.disabled)return;
  pending.current=true;setBusy(true);setError('');
  try{await apply(direction==='undo'?command.before:command.after);
   if(direction==='new'){setHistory(h=>[...h.slice(-49),command]);setFuture([]);}
   else if(direction==='undo'){setHistory(h=>h.slice(0,-1));setFuture(f=>[...f,command]);}
   else{setFuture(f=>f.slice(0,-1));setHistory(h=>[...h,command]);}
  }catch(e){setError(e instanceof Error?e.message:'Không áp dụng được mốc.');}
  finally{pending.current=false;setBusy(false);setRemount(n=>n+1);}
 }
 function start(action:TimelineAction){const clip=clips.find(c=>c.id===action.id);if(!clip)return;cancelled.current=false;gesture.current={key,clip};setSelected(clip.id);setError('');}
 function end(startTime:number,endTime:number,dir:'left'|'right'){
  const active=gesture.current;gesture.current=null;
  if(cancelled.current||!active||active.key!==stateKey(live.current.part)||disabled){setRemount(n=>n+1);return;}
  try{
   if(Math.abs((dir==='left'?startTime-active.clip.start:endTime-active.clip.end))<1e-9){setRemount(n=>n+1);return;}
   const after=proposal(active.clip,startTime,endTime,dir);
   const before:Edit=after.kind==='main'?{kind:'main',ranges:currentRanges()}:{kind:'teaser',part:structuredClone(live.current.part)};
   if(JSON.stringify(after)!==JSON.stringify(before))void commit({before,after},'new');
  }catch(e){setError(e instanceof Error?e.message:'Mốc chưa hợp lệ.');setRemount(n=>n+1);}
 }
 // One own main update may include refreshed retention metadata. External
 // changes still clear local undo history; raw timecode drafts are never touched.
 return <div className="studio-cut-timeline" onKeyDown={event=>{
   const target=event.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable=true]'))return;
   if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){
    event.preventDefault();if(event.shiftKey){if(future.length)void commit(future[future.length-1],'redo');}else if(history.length)void commit(history[history.length-1],'undo');
   }
  }} aria-label={`Timeline dựng Part ${part.id}`}>
  <div className="studio-cut-toolbar">
   <strong>Timeline · Part {part.id}</strong><span>Preview 1× · {rangeTime(currentTime)} / {rangeTime(total)}</span>
   <button type="button" disabled={!history.length||disabled||busy} onClick={()=>void commit(history[history.length-1],'undo')}>Undo</button>
   <button type="button" disabled={!future.length||disabled||busy} onClick={()=>void commit(future[future.length-1],'redo')}>Redo</button>
   <label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/>Snap 30 fps</label>
   <label>Zoom <input aria-label="Zoom timeline" type="range" min="1" max="60" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
  </div>
  <div className="studio-cut-tracks"><div className="studio-cut-track-labels"><span>Teaser</span><span>Main</span></div>
   <div className="studio-cut-track-body"><Suspense fallback={<p>Đang mở timeline…</p>}>{mounted&&<Timeline key={remount} ref={bindEngine} editorData={data} effects={{clip:{id:'clip',name:'Cut'}}} style={{width:'100%',height:144}} rowHeight={44} scale={10} scaleWidth={zoom*10} minScaleCount={Math.max(2,Math.ceil(total/10)+1)} startLeft={16} autoScroll gridSnap={false} dragLine={false} autoReRender={false} disableDrag={disabled||busy}
    onChange={()=>false} onClickTimeArea={time=>{seek(time);return true;}}
    onCursorDrag={time=>seek(time)}
    onClickActionOnly={(_event,{action,time})=>{setSelected(action.id);seek(time);}}
    onActionResizeStart={({action})=>start(action)}
    onActionResizing={({start,end,dir})=>{const active=gesture.current;if(cancelled.current||!active||active.key!==stateKey(live.current.part))return false;try{proposal(active.clip,start,end,dir);return true;}catch{return false;}}}
    onActionResizeEnd={({start,end,dir})=>end(start,end,dir)}
    getActionRender={action=>{const clip=clips.find(c=>c.id===action.id);return clip?<div role="button" tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();setSelected(clip.id);seek(clip.start);}}} aria-label={`${clip.kind==='teaser'?'Teaser':clip.kind==='padding'?'Padding':`Main ${clip.index+1}`} · nguồn ${formatSourceTimecode(clip.sourceStart)} đến ${formatSourceTimecode(clip.sourceEnd)}`} className={`studio-cut-clip studio-cut-${clip.kind}`} title={`${clip.kind==='teaser'?'Teaser':clip.kind==='padding'?'Padding':`Main ${clip.index+1}`} · nguồn ${formatSourceTimecode(clip.sourceStart)} → ${formatSourceTimecode(clip.sourceEnd)}`}><b>{clip.kind==='teaser'?'Teaser':clip.kind==='padding'?'Padding':`Main ${clip.index+1}`}</b><small>{formatSourceTimecode(clip.sourceStart)} → {formatSourceTimecode(clip.sourceEnd)}</small></div>:null;}}
   />}</Suspense></div>
  </div>
  <p className="studio-muted text-xs">Bấm để tua · Kéo mép để chỉnh mốc nguồn · Escape hủy kéo. Ô timecode bên dưới giữ nguyên độ chính xác.</p>
  {error&&<p role="alert" className="text-xs text-amber-200">{error}</p>}
 </div>;
}
