import {PLAYBACK_RATE} from './render-config.mjs';
import {locateTimelineTime,timelineTimeForSegment} from './preview-timeline.mjs';

// React owns refs; each controller owns a stable pair of media elements. A newer
// controller can claim reused nodes before an older async play/cleanup completes.
const owners = new WeakMap();
export function createPreviewDecks({videos:refs,url,segments:ranges,onActive,onClock,onBuffer,onError,onEnded}) {
 const videos=[refs[0],refs[1]],segments=ranges.map(s=>({...s}));
 if(videos.some(v=>!v)||videos[0]===videos[1])throw new TypeError('Preview requires two distinct video elements.');
 const owner={},listeners=[];
 let initialSeek=true,requestedStart=segments[0]?.start||0;
 let active=0,index=0,playing=false,disposed=false,warm=-1,ready=false,pending=false,timer=0,generation=0;
 videos.forEach(v=>owners.set(v,owner));
 const live=()=>!disposed&&videos.every(v=>owners.get(v)===owner);
 const clearTimer=()=>{clearTimeout(timer);timer=0;};
 const clock=()=>timelineTimeForSegment(segments,index,videos[active].currentTime);
 for(const [i,v]of videos.entries()){
  if(v.getAttribute('src')!==url)v.src=url;
  v.preload='auto';v.playbackRate=PLAYBACK_RATE;v.preservesPitch=true;v.muted=i!==0;
 }
 function pause(){if(!live())return;playing=false;pending=false;generation++;clearTimer();videos.forEach(v=>v.pause());onBuffer(false);}
 function warmNext(){
  if(!live())return;
  const next=segments[index+1],v=videos[1-active];
  if(!next){warm=-1;ready=false;v.pause();if(v.getAttribute('src')){v.removeAttribute('src');v.load();}return;}
  if(warm===index+1)return;
  warm=index+1;ready=false;v.pause();v.muted=true;if(!v.getAttribute('src'))v.src=url;
  if(v.readyState>=1)v.currentTime=next.start;
 }
 function warmed(v){
  const next=segments[index+1];if(!live()||v!==videos[1-active]||warm!==index+1||!next)return;
  if(v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-next.start)<.05){ready=true;if(pending&&playing)handoff();}
 }
 function playDeck(v,message){
  const epoch=generation;
  return v.play().catch(error=>{
   if(!live()||epoch!==generation)return;
   pause();if(message)onError(message);else throw error;
  });
 }
 function handoff(){
  clearTimer();if(!live()||!playing)return;
  const next=segments[index+1];if(!next){pause();onEnded();return;}
  if(!ready){pending=true;videos[active].pause();onClock((segments.slice(0,index+1).reduce((n,s)=>n+s.end-s.start,0))/PLAYBACK_RATE);onBuffer(true);return;}
  const old=videos[active],muted=old.muted;old.pause();old.muted=true;active=1-active;index++;pending=false;warm=-1;ready=false;
  const v=videos[active];v.muted=muted;onActive(active,index);onClock(clock());onBuffer(false);
  void playDeck(v,'Không phát được đoạn kế tiếp; bấm Play để tiếp tục.');warmNext();
 }
 for(const v of videos){
  const metadata=()=>{if(!live())return;if(initialSeek&&v===videos[active]){initialSeek=false;v.currentTime=requestedStart;}if(v===videos[1-active]){const next=segments[index+1];if(next&&warm===index+1)v.currentTime=next.start;}};
  const loaded=()=>warmed(v);v.addEventListener('loadedmetadata',metadata);for(const e of ['loadeddata','seeked','canplay'])v.addEventListener(e,loaded);listeners.push([v,metadata,loaded]);
 }
 onActive(0,0);if(videos[0].readyState>=1){initialSeek=false;videos[0].currentTime=requestedStart;}
 warmNext();
 return{clock,pause,async play(){if(!live())return;const last=segments.at(-1);if(last&&index===segments.length-1&&videos[active].currentTime>=last.end-.01)this.seek(0);playing=true;const epoch=generation;await playDeck(videos[active]);if(live()&&epoch===generation&&playing)warmNext();},
 tick(){if(!live()||!playing||pending)return;const v=videos[active],current=segments[index];if(!current||v.seeking)return;onClock(clock());warmNext();const remaining=(current.end-v.currentTime)/PLAYBACK_RATE;if(remaining<=.002)handoff();else if(remaining<.12&&!timer){const epoch=generation;timer=setTimeout(()=>{timer=0;if(live()&&epoch===generation&&playing&&!v.paused&&!v.seeking&&(current.end-v.currentTime)/PLAYBACK_RATE<=.002)handoff();},remaining*1000);}},
 seek(seconds){if(!live())return;clearTimer();generation++;pending=false;onBuffer(false);const pos=locateTimelineTime(segments,seconds);index=pos.index;warm=-1;ready=false;const v=videos[active];requestedStart=pos.sourceTime;initialSeek=v.readyState<1;if(!initialSeek)v.currentTime=requestedStart;onActive(active,index);onClock(seconds);warmNext();if(playing)void playDeck(v,'Bấm Play để tiếp tục sau khi tua.');},
 dispose(){
  if(disposed)return;disposed=true;playing=false;pending=false;generation++;clearTimer();
  for(const[v,metadata,loaded]of listeners){v.removeEventListener('loadedmetadata',metadata);for(const e of ['loadeddata','seeked','canplay'])v.removeEventListener(e,loaded);}
  // Never emit UI callbacks or touch nodes already claimed by a newer controller.
  videos.forEach(v=>{if(owners.get(v)===owner){owners.delete(v);v.pause();v.removeAttribute('src');v.load();}});
 }
 };
}
