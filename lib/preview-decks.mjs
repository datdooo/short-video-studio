import {PLAYBACK_RATE} from './render-config.mjs';
import {locateTimelineTime,timelineTimeForSegment} from './preview-timeline.mjs';
// Two reusable decoders, one next-range preseek. No video transcode or added time.
export function createPreviewDecks({videos,url,segments,onActive,onClock,onBuffer,onError,onEnded}){
 let active=0,index=0,playing=false,disposed=false,warm=-1,ready=false,pending=false,timer=0,generation=0;
 const listeners=[];
 for(const [i,v]of videos.entries()){
  if(v.getAttribute('src')!==url)v.src=url;
  v.preload='auto';v.playbackRate=PLAYBACK_RATE;v.preservesPitch=true;v.muted=i!==0;
 }
 const clock=()=>timelineTimeForSegment(segments,index,videos[active].currentTime);
 const clearTimer=()=>{clearTimeout(timer);timer=0;};
 function pause(){playing=false;pending=false;generation++;clearTimer();videos.forEach(v=>v.pause());onBuffer(false);}
 function warmNext(){
  const next=segments[index+1],v=videos[1-active];
  if(!next){warm=-1;ready=false;v.pause();if(v.getAttribute('src')){v.removeAttribute('src');v.load();}return;}
  if(warm===index+1)return;
  warm=index+1;ready=false;v.pause();v.muted=true;if(!v.getAttribute('src'))v.src=url;
  if(v.readyState>=1){try{v.currentTime=next.start;}catch{/* metadata callback retries */}}
 }
 function warmed(v){
  const next=segments[index+1];if(disposed||v!==videos[1-active]||warm!==index+1||!next)return;
  if(v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-next.start)<.05){ready=true;if(pending&&playing)handoff();}
 }
 function handoff(){
  clearTimer();if(disposed||!playing)return;
  const next=segments[index+1];if(!next){pause();onEnded();return;}
  if(!ready){pending=true;videos[active].pause();onClock((segments.slice(0,index+1).reduce((n,s)=>n+s.end-s.start,0))/PLAYBACK_RATE);onBuffer(true);return;}
  const old=videos[active],muted=old.muted;old.pause();old.muted=true;active=1-active;index++;pending=false;warm=-1;ready=false;
  const v=videos[active];v.muted=muted;onActive(active,index);onClock(clock());onBuffer(false);
  const epoch=generation;void v.play().catch(()=>{if(!disposed&&playing&&epoch===generation){pause();onError('Không phát được đoạn kế tiếp; bấm Play để tiếp tục.');}});warmNext();
 }
 for(const v of videos){
  const metadata=()=>{if(v===videos[1-active]){const next=segments[index+1];if(next&&warm===index+1)v.currentTime=next.start;}};
  const loaded=()=>warmed(v);v.addEventListener('loadedmetadata',metadata);v.addEventListener('loadeddata',loaded);v.addEventListener('seeked',loaded);v.addEventListener('canplay',loaded);listeners.push([v,metadata,loaded]);
 }
 onActive(0,0);if(videos[0].readyState>=1)videos[0].currentTime=segments[0]?.start||0;
 warmNext();
 return{clock,pause,async play(){if(disposed)return;const last=segments.at(-1);if(last&&index===segments.length-1&&videos[active].currentTime>=last.end-.01)this.seek(0);playing=true;try{await videos[active].play();warmNext();}catch(e){pause();throw e;}},
 tick(){if(disposed||!playing||pending)return;const v=videos[active],current=segments[index];if(!current||v.seeking)return;onClock(clock());warmNext();const remaining=(current.end-v.currentTime)/PLAYBACK_RATE;if(remaining<=.002)handoff();else if(remaining<.12&&!timer)timer=setTimeout(()=>{timer=0;if(playing&&!v.paused&&!v.seeking&&(current.end-v.currentTime)/PLAYBACK_RATE<=.002)handoff();},remaining*1000);},
 seek(seconds){clearTimer();generation++;pending=false;onBuffer(false);const pos=locateTimelineTime(segments,seconds);index=pos.index;warm=-1;ready=false;const v=videos[active];v.currentTime=pos.sourceTime;onActive(active,index);onClock(seconds);warmNext();if(playing)void v.play().catch(()=>onError('Bấm Play để tiếp tục sau khi tua.'));},
 dispose(){disposed=true;generation++;pause();for(const[v,metadata,loaded]of listeners){v.removeEventListener('loadedmetadata',metadata);for(const e of['loadeddata','seeked','canplay'])v.removeEventListener(e,loaded);}const spare=videos[1-active];spare.removeAttribute('src');spare.load();}
 };
}
