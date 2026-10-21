import {PREVIEW_RATE} from './preview-config.mjs';
import {segmentDuration} from './render-config.mjs';
import {locateTimelineTime,timelineTimeForSegment} from './preview-timeline.mjs';

// React owns refs; a controller owns a stable pair. Old asynchronous callbacks
// cannot touch nodes reclaimed by a newer controller/source.
const owners=new WeakMap(),frameTolerance=1/60+.001;
export function createPreviewDecks({videos:refs,url,segments:ranges,onActive,onClock,onBuffer,onError,onEnded}){
 const videos=[refs[0],refs[1]],segments=ranges.map(s=>({...s}));
 if(videos.some(v=>!v)||videos[0]===videos[1]||!segments.length)throw TypeError('Preview requires two distinct video elements and source ranges.');
 const owner={},listeners=[];
 let active=0,index=0,playing=false,disposed=false,warm=-1,ready=false,pending=false,timer=0,generation=0;
 let initialSeek=true,requestedStart=segments[0].start,waiting=false,buffering=false,bufferTimer=0,warmError=false,hasStarted=false;
 videos.forEach(v=>owners.set(v,owner));
 const live=()=>!disposed&&videos.every(v=>owners.get(v)===owner);
 const clearTimer=()=>{clearTimeout(timer);timer=0;};
 const clock=()=>timelineTimeForSegment(segments,index,videos[active].currentTime);
 function buffer(value){
  if(!live())return;
  if(value&&buffering&&bufferTimer)return;
  clearTimeout(bufferTimer);bufferTimer=0;
  if(buffering!==value){buffering=value;onBuffer(value);}
  if(value&&playing){const epoch=generation;bufferTimer=setTimeout(()=>{if(live()&&epoch===generation&&playing&&buffering)fail('Giải mã/tua video quá lâu. Preview đã dừng; bấm Play để thử lại.');},15000);}
 }
 function pause(){if(!live())return;playing=false;pending=false;hasStarted=false;generation++;clearTimer();videos.forEach(v=>v.pause());buffer(false);}
 function fail(message){if(!live())return;pause();onError(message);}
 function warmNext(){
  if(!live())return;
  const next=segments[index+1],v=videos[1-active];
  if(!next){warm=-1;ready=false;v.pause();if(v.getAttribute('src')){v.removeAttribute('src');v.load();}return;}
  if(warm===index+1)return;
  warm=index+1;ready=false;warmError=false;v.pause();v.muted=true;if(!v.getAttribute('src'))v.src=url;
  if(v.readyState>=1)v.currentTime=next.start;
 }
 function warmed(v){
  const next=segments[index+1];if(!live()||v!==videos[1-active]||warm!==index+1||!next)return;
  if(v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-next.start)<=frameTolerance){ready=true;if(pending&&playing)handoff();}
 }
 async function playDeck(v,message){
  const epoch=generation;
  try{await v.play();if(live()&&epoch!==generation&&!playing)v.pause();}
  catch(error){if(!live()||epoch!==generation)return;pause();if(message)onError(message);else throw error;}
 }
 function handoff(){
  clearTimer();if(!live()||!playing)return;
  const next=segments[index+1];if(!next){pause();onEnded();return;}
  if(!ready){
   if(warmError){fail('Không giải mã được đoạn kế tiếp. Preview đã dừng; kiểm tra nguồn rồi thử lại.');return;}
   pending=true;videos[active].pause();onClock(segments.slice(0,index+1).reduce((n,s)=>n+segmentDuration(s),0)/PREVIEW_RATE);buffer(true);return;
  }
  const old=videos[active],muted=old.muted;old.pause();old.muted=true;
  active=1-active;index++;pending=false;warm=-1;ready=false;waiting=false;hasStarted=false;
  const v=videos[active];v.muted=muted;onActive(active,index);onClock(clock());
  // BGM resumes only once the new active deck actually plays, not on swap.
  buffer(true);void playDeck(v,'Không phát được đoạn kế tiếp; bấm Play để tiếp tục.');warmNext();
 }
 function activeReady(v){
  if(!live())return;
  if(v!==videos[active]){warmed(v);return;}
  if(v.seeking||v.readyState<2||initialSeek||pending)return;
  waiting=false;onClock(clock());
  if(!playing){buffer(false);return;}
  if(!v.paused&&hasStarted)buffer(false);
 }
 function listen(v,event,handler){v.addEventListener(event,handler);listeners.push([v,event,handler]);}
 for(const [slot,v]of videos.entries()){
  listen(v,'loadedmetadata',()=>{
   if(!live())return;
   if(initialSeek&&v===videos[active]){initialSeek=false;v.currentTime=requestedStart;}
   else if(v===videos[1-active]){const next=segments[index+1];if(next&&warm===index+1)v.currentTime=next.start;}
  });
  for(const event of ['loadeddata','seeked','canplay'])listen(v,event,()=>activeReady(v));
  listen(v,'playing',()=>{if(live()&&v===videos[active])hasStarted=true;activeReady(v);});
  listen(v,'pause',()=>{if(live()&&v===videos[active]&&playing&&!pending&&!v.ended){hasStarted=false;buffer(true);}});
  listen(v,'seeking',()=>{if(!live())return;if(v===videos[active]){clearTimer();buffer(true);}else ready=false;});
  for(const event of ['waiting','stalled'])listen(v,event,()=>{if(live()&&v===videos[active]&&playing&&(event!=='stalled'||v.readyState<3)){waiting=true;hasStarted=false;clearTimer();buffer(true);}});
  listen(v,'error',()=>{if(!live()||!v.getAttribute('src'))return;if(v===videos[active]||pending)fail('Không đọc/giải mã được video. Preview và nhạc đã dừng.');else{ready=false;warmError=true;}});
  listen(v,'ended',()=>{
   if(!live()||v!==videos[active]||!playing||pending)return;
   if(v.currentTime<segments[index].end-1/30-.002){fail('Video kết thúc trước mốc nguồn đã chọn. Sửa range; app không tự kéo frame hoặc đổi main.');return;}
   handoff();
  });
  if(v.getAttribute('src')!==url)v.src=url;
  v.preload='auto';v.playbackRate=PREVIEW_RATE;v.preservesPitch=true;v.muted=slot!==0;
 }
 onActive(0,0);if(videos[0].readyState>=1){initialSeek=false;videos[0].currentTime=requestedStart;}
 warmNext();
 return{
  clock,pause,
  async play(){
   if(!live())return;
   const v=videos[active],last=segments.at(-1);
   if(index===segments.length-1&&v.currentTime>=last.end-.01)this.seek(0);
   playing=true;const epoch=generation;waiting=false;hasStarted=false;
   if(v.currentTime>=segments[index].end-.002&&index<segments.length-1){handoff();return;}
   buffer(true);await playDeck(v);if(live()&&epoch===generation&&playing){warmNext();activeReady(v);}
  },
  tick(){
   if(!live()||!playing||pending)return;
   const v=videos[active],current=segments[index];if(v.seeking||initialSeek||waiting)return;
   if(v.readyState<2){buffer(true);return;}
   onClock(clock());warmNext();const remaining=(current.end-v.currentTime)/PREVIEW_RATE;
   if(remaining<=.002)handoff();
   else if(remaining<.12&&!timer){const epoch=generation;timer=setTimeout(()=>{timer=0;if(live()&&epoch===generation&&playing&&!v.paused&&!v.seeking&&(current.end-v.currentTime)/PREVIEW_RATE<=.002)handoff();},remaining*1000);}
  },
  seek(seconds){
   if(!live())return;clearTimer();generation++;pending=false;waiting=false;hasStarted=false;
   const pos=locateTimelineTime(segments,seconds);index=pos.index;warm=-1;ready=false;warmError=false;
   const v=videos[active];requestedStart=pos.sourceTime;initialSeek=v.readyState<1;
   const unchanged=Math.abs(v.currentTime-requestedStart)<.001;
   buffer(true);if(!initialSeek)v.currentTime=requestedStart;
   if(unchanged&&!initialSeek&&!v.seeking){hasStarted=playing&&!v.paused;activeReady(v);}
   onActive(active,index);onClock(seconds);warmNext();
   if(playing)void playDeck(v,'Bấm Play để tiếp tục sau khi tua.');
  },
  dispose(){
   if(disposed)return;disposed=true;playing=false;pending=false;generation++;clearTimer();clearTimeout(bufferTimer);
   for(const[v,event,handler]of listeners)v.removeEventListener(event,handler);
   videos.forEach(v=>{if(owners.get(v)===owner){owners.delete(v);v.pause();v.removeAttribute('src');v.load();}});
  },
 };
}
