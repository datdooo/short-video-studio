import {PLAYBACK_RATE,RENDER_FPS,FOREGROUND_HEIGHT,CANVAS_WIDTH,foregroundGeometry} from '../render-config.mjs';
// Original reference-inspired warm cloud field, not Adobe code/assets/parity.
// Bake once into a local sprite; preview only changes a CSS crop, never pixels.
export const VR_LEAK_ID='vr-light-leak-v2';
export const VR_LEAK_SPRITE='/effects/warm-cloud-leak-v2.png';
export const VR_LEAK_WIDTH=216, VR_LEAK_HEIGHT=270, VR_LEAK_FRAMES=19;
export function vrLeakPixel(x,y,p) {
  if(p<=0||p>=1)return[0,0,0];
  const ease=Math.sin(Math.PI*p)**2,flow=x+.32*(p-.5),wave=Math.sin(5*flow+2*y+2*p);
  const cloud=(Math.sin(9*flow-5*y+1.6*p)+Math.sin(4*flow+7*y-2*p)+.5*Math.sin(17*flow+11*y+3*p))/2.5;
  const left=Math.exp(-((flow-.04-.08*wave)**2/.12+(y-.45-.14*Math.sin(p*3))**2/.9));
  const pool=Math.exp(-((flow-.68-.12*Math.sin(p*2))**2/.28+(y-.6+.12*wave)**2/.5));
  const haze=Math.max(0,.44+.28*cloud),warm=left*(.8+.2*cloud),red=pool*(.65+.3*cloud);
  return [haze*.6+warm*.8+red*.95,haze*.3+warm*.94+red*.12,haze*.18+warm*.15+red*.38].map(v=>Math.round(255*Math.min(.99,ease*v)));
}
export function vrLeakFrame(window,seconds) {
  const phase=Math.max(0,Math.min(1,(seconds*RENDER_FPS-window.startFrame)/(2*window.halfFrames)));
  return Math.round(phase*(VR_LEAK_FRAMES-1));
}
// Transparent padding must reveal background untouched, even for native-size
// sources smaller than the foreground crop. Match FFmpeg even-size scaling.
export function foregroundLeakClip(width,height) {
  const {x,y,width:w,height:h}=foregroundGeometry(width,height);
  return {x,y,width:w,height:h};
}
export function vrLeakForegroundFilters(input,output,windows,spriteInput,width=CANVAS_WIDTH,height=FOREGROUND_HEIGHT) {
  const active=windows.filter(w=>w.presetId===VR_LEAK_ID);
  if(!active.length)return[`[${input}]null[${output}]`];
  const frame=active.reduceRight((rest,w)=>`if(between(t,${w.startFrame/RENDER_FPS*PLAYBACK_RATE},${w.endFrame/RENDER_FPS*PLAYBACK_RATE}),round((t*${RENDER_FPS}/(${PLAYBACK_RATE})-${w.startFrame})/${w.halfFrames*2}*${VR_LEAK_FRAMES-1}),${rest})`,'0');
  return [`[${input}]split=2[vrColor][vrAlphaSeed]`,`[vrAlphaSeed]alphaextract[vrAlpha]`,
    `[${spriteInput}:v]crop=${VR_LEAK_WIDTH}:${VR_LEAK_HEIGHT}:0:'${VR_LEAK_HEIGHT}*(${frame})',scale=${width}:${height}:flags=bilinear,format=gbrp[vrWash]`,
    `[vrColor]format=gbrp[vrBase]`,`[vrBase][vrWash]blend=all_mode=screen[vrLit]`,`[vrLit][vrAlpha]alphamerge[${output}]`];
}
