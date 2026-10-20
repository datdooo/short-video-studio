// One mixed-audio owner. Never mute source until Audio.play actually succeeds;
// invalidate full mix identity before replacing generated parts/music/gain.
export function createMusicPlayback({read,onStatus=()=>{}}){
 let epoch=0,starting=0,blocked=false,lastTime=0,status='',disposed=false;
 const tell=(next,error)=>{if(!disposed&&next!==status){status=next;onStatus(next,error);}};
 const unmute=()=>{const s=read();if(s.video)s.video.muted=false;};
 function pause(){epoch++;starting=0;read().audio?.pause();unmute();if(status==='playing')tell('paused');}
 async function play(explicit=false){
  if(disposed)return false;
  const s=read();if(explicit)blocked=false;if(!s.audio||s.key!==s.expectedKey){unmute();return false;}if(starting||blocked||(!s.playing&&!explicit))return false;
  const generation=++epoch;starting=generation;
  try{
   // Seek the prepared 1× mix BEFORE play, including paused seeks/repeated hooks.
   s.audio.currentTime=Math.max(0,Math.min(s.time,s.audio.duration||s.duration));
   s.audio.playbackRate=1;
   await s.audio.play();
   if(disposed||generation!==epoch)return false;
   const now=read();if(now.audio!==s.audio||now.key!==now.expectedKey||(!now.playing&&!explicit)){s.audio.pause();return false;}
   if(now.video)now.video.muted=true;tell('playing');return true;
  }catch(e){
   // A cancelled old play promise must not unmute/pause a newer source's mix.
   if(disposed||generation!==epoch)return false;
   s.audio.pause();unmute();blocked=true;tell('blocked',e?.message||'Playback rejected');return false;
  }finally{if(starting===generation)starting=0;}
 }
 return {play,pause,invalidate(){if(disposed)return;blocked=false;pause();tell('preparing');},ready(){if(disposed)return;tell('ready');if(read().playing)void play();},
 tick(){if(disposed)return;const s=read();if(!s.playing||!s.audio||s.key!==s.expectedKey){pause();lastTime=s.time;return;}
  const jump=Math.abs(s.time-lastTime)>.3;if((jump||!s.video?.seeking)&&Math.abs(s.audio.currentTime-s.time)>.15){try{s.audio.currentTime=Math.max(0,Math.min(s.time,s.audio.duration||s.duration));}catch{/* Not ready; source remains audible. */}}
  if(s.audio.paused&&!blocked&&!starting)void play();lastTime=s.time;
 },dispose(){if(disposed)return;disposed=true;pause();}};
}
