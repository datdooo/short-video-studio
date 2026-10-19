import {PLAYBACK_RATE,RENDER_FPS} from '../render-config.mjs';
import {foregroundLeakClip,vrLeakPixel} from '../music/vr-light-leak.mjs';
import {rainbowPixel} from '../music/light-leak.mjs';
export {foregroundLeakClip};
export const TRANSITION_SPRITE='/effects/foreground-transitions-v3.png';
export const TRANSITION_WIDTH=216,TRANSITION_HEIGHT=270,TRANSITION_FRAMES=19;
export const SPRITE_IDS=Object.freeze(['vr-light-leak-v2','rainbow-light-leak','dip-black','flash-white']);
export function transitionFrame(w,seconds){return Math.max(0,Math.min(18,Math.round((seconds*RENDER_FPS-w.startFrame)/(2*w.halfFrames)*18)));}
export function transitionPixel(id,x,y,p){
 const a=Math.sin(Math.PI*p)**2;
 if(id==='dip-black')return Array(3).fill(Math.round(255*(1-a)));
 if(id==='flash-white')return Array(3).fill(Math.round(255*a));
 const rgb=id==='vr-light-leak-v2'?vrLeakPixel(x,y,p):rainbowPixel(x,y,p);
 // A one-frame bright core conceals the cut, with continuous entry/recovery;
 // it adds no time, held frame or crossfade of source content.
 const core=Math.sin(Math.PI*p)**12;
 return rgb.map(v=>Math.round(v+(255-v)*core));
}
export function foregroundTransitionFilters(input,output,windows,spriteInput,width=1080,height=1350,clockRate=PLAYBACK_RATE){
 const active=windows.filter(w=>SPRITE_IDS.includes(w.presetId));
 if(!active.length)return[`[${input}]null[${output}]`];
 const when=w=>`between(T,${w.startFrame/RENDER_FPS*clockRate},${w.endFrame/RENDER_FPS*clockRate})`;
 const row=active.reduceRight((rest,w)=>`if(between(t,${w.startFrame/RENDER_FPS*clockRate},${w.endFrame/RENDER_FPS*clockRate}),clip(round((t/${clockRate}*${RENDER_FPS}-${w.startFrame})/${2*w.halfFrames}*18),0,18),${rest})`,'0');
 const column=active.reduceRight((rest,w)=>`if(between(t,${w.startFrame/RENDER_FPS*clockRate},${w.endFrame/RENDER_FPS*clockRate}),${SPRITE_IDS.indexOf(w.presetId)},${rest})`,'0');
 const dip=active.filter(w=>w.presetId==='dip-black').map(when).join('+')||'0';
 return [`[${input}]split=2[transitionBase][transitionSeed]`,`[transitionSeed]alphaextract[transitionAlpha]`,
 `[${spriteInput}:v]crop=216:270:'216*(${column})':'270*(${row})',scale=${width}:${height}:flags=bilinear,format=gbrp[transitionWash]`,
 `[transitionBase]format=gbrp[transitionRGB]`,`[transitionRGB][transitionWash]blend=all_expr='if(${dip},A*B/255,255-(255-A)*(255-B)/255)'[transitionLit]`,
 `[transitionLit][transitionAlpha]alphamerge[${output}]`];
}
