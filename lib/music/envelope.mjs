import {presentationSegments} from '../teaser-hooks.mjs';
import {PLAYBACK_RATE,segmentDuration} from '../render-config.mjs';
export const DUCK_GAIN=10**(-12/20),PRE_ROLL=.1,ATTACK=.05,HOLD=.3,RECOVERY=.6;
export const DUCKING_VERSION='vad-envelope-sidechain-v2';
export function mapSpeechIntervals(part,activity,speed=PLAYBACK_RATE){
  if(!Number.isFinite(speed)||speed<=0)throw Error('Invalid speech timeline speed');
  if(activity?.status!=='available')return[];
  const out=[];let at=0;
  for(const s of presentationSegments(part)){if(!s.type||s.type==='source')for(const r of activity.intervals){const start=Math.max(s.start,r.start),end=Math.min(s.end,r.end);if(end>start)out.push({start:at+(start-s.start)/speed,end:at+(end-s.start)/speed});}at+=segmentDuration(s)/speed;}
  return out.sort((a,b)=>a.start-b.start);
}
export function duckWindows(intervals,duration){
  const windows=[];
  for(const r of intervals){const start=Math.max(0,r.start-PRE_ROLL),end=Math.min(duration,r.end+HOLD);const prev=windows.at(-1);if(prev&&start<=prev.end+RECOVERY)prev.end=Math.max(prev.end,end);else windows.push({start,end});}
  return windows;
}
export function duckGainAt(t,windows){let gain=1;for(const w of windows){if(t<w.start)break;if(t<w.start+ATTACK)gain=Math.min(gain,1-(1-DUCK_GAIN)*(t-w.start)/ATTACK);else if(t<=w.end)gain=Math.min(gain,DUCK_GAIN);else if(t<w.end+RECOVERY)gain=Math.min(gain,DUCK_GAIN+(1-DUCK_GAIN)*(t-w.end)/RECOVERY);}return Math.max(DUCK_GAIN,Math.min(1,gain));}
export function musicGainAt(t,duration,settings,windows=[]){if(!settings.enabled||settings.volume===0||t<0||t>=duration)return 0;const fade=Math.min(.15,duration/4);return settings.volume/100*Math.min(1,t/fade,(duration-t)/fade)*(settings.ducking?duckGainAt(t,windows):1);}
export function duckExpression(windows){return windows.reduceRight((rest,w)=>`if(lt(t,${w.start}),1,if(lt(t,${w.start+ATTACK}),1-${1-DUCK_GAIN}*(t-${w.start})/${ATTACK},if(lte(t,${w.end}),${DUCK_GAIN},if(lt(t,${w.end+RECOVERY}),${DUCK_GAIN}+${1-DUCK_GAIN}*(t-${w.end})/${RECOVERY},${rest}))))`,'1');}
// The compressor sees a VAD-derived control signal, NEVER the source amplitude.
// With ratio=2, hard knee and threshold=DUCK_GAIN², gain=DUCK_GAIN/sqrt(key).
// Inverting the existing envelope gives the same -12dB/attack/hold/recovery
// policy in preview and export, without multiplying a second ducking envelope.
export function duckSidechainExpression(windows){const gain=duckExpression(windows);return `if(lt((${gain}),1),pow(${DUCK_GAIN}/(${gain}),2),0)`;}
// Clamp only the added music to available sample headroom; never scale the voice.
export function mixSample(source,music){const room=Math.max(0,.98-Math.abs(source));return source+Math.sign(music)*Math.min(Math.abs(music),room);}
