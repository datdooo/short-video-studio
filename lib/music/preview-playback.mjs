// One mixed-audio owner. Never mute source until Audio.play actually succeeds;
// invalidate full mix identity before replacing generated parts/music/gain.
export function createMusicPlayback({read,onStatus=()=>{}}){
 let epoch=0,starting=false,blocked=false,lastTime=0,status='';
 const tell=(next,error)=>{if(next!==status){status=next;onStatus(next,error);}};
 const unmute=()=>{const s=read();if(s.video)s.video.muted=false;};
 function pause(){read().audio?.pause();unmute();if(status==='playing')tell('paused');}
 async function play(explicit=false){const s=read();if(explicit)blocked=false;if(!s.audio||s.key!==s.expectedKey){unmute();return false;}if(starting||blocked||(!s.playing&&!explicit))return false;
  const generation=epoch;starting=true;
  try{await s.audio.play();const now=read();if(generation!==epoch||now.audio!==s.audio||now.key!==now.expectedKey||(!now.playing&&!explicit)){s.audio.pause();return false;}if(now.video)now.video.muted=true;tell('playing');return true;}
  catch(e){s.audio.pause();unmute();blocked=true;tell('blocked',e?.message||'Playback rejected');return false;}
  finally{starting=false;}
 }
 return {play,pause,invalidate(){epoch++;blocked=false;pause();tell('preparing');},ready(){tell('ready');if(read().playing)void play();},
 tick(){const s=read();if(!s.playing||!s.audio||s.key!==s.expectedKey){pause();lastTime=s.time;return;}
  const jump=Math.abs(s.time-lastTime)>.3;if((jump||!s.video?.seeking)&&Math.abs(s.audio.currentTime-s.time)>.15){try{s.audio.currentTime=Math.max(0,Math.min(s.time,s.audio.duration||s.duration));}catch{/* Not ready; source remains audible. */}}
  if(s.audio.paused&&!blocked&&!starting)void play();lastTime=s.time;
 },dispose(){epoch++;pause();}};
}
