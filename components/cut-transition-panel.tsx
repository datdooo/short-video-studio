"use client";
import {useEffect,useRef} from "react";
import {rainbowPixel} from "@/lib/music/light-leak.mjs";
import { Check } from "lucide-react";
import { listCutTransitions, normalizeCutTransition, cutTransitionPose } from "@/lib/visual-style/cut-transitions.mjs";
import type { CutTransitionId, CutTransitionWindow } from "@/lib/visual-style/cut-transitions.mjs";
const presets = listCutTransitions();
export function CutTransitionPanel({ value, onChange }: { value?: CutTransitionId; onChange: (id: CutTransitionId) => void }) {
  const selected = normalizeCutTransition(value);
  return <section aria-labelledby="cut-transition-heading" className="mt-5">
    <h3 id="cut-transition-heading" className="text-xs font-semibold text-zinc-300">Cut Transition</h3>
    <div className="mt-2 grid grid-cols-3 gap-2">{presets.map(({ id, label }) => <button key={id} type="button" aria-label={`Cut transition: ${label}`} aria-pressed={selected === id} onClick={() => onChange(id)} className={`flex items-center justify-between gap-1 rounded-xl border px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${selected === id ? "border-white bg-white/10" : "border-white/10 hover:border-white/40"}`}>{label}{selected === id && <Check aria-hidden="true" className="size-3" />}</button>)}</div>
    <p className="mt-1 text-[11px] text-zinc-500">Internal cuts only · up to 0.4s · scene only, audio and text stay unchanged.</p>
  </section>;
}
export function CutTransitionVeil({ value, windows, time }: { value?: CutTransitionId; windows: CutTransitionWindow[]; time: number }) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const rainbow=windows.find(w=>w.presetId==='rainbow-light-leak'&&time*30>=w.startFrame&&time*30<=w.endFrame);
  useEffect(()=>{const c=canvas.current,ctx=c?.getContext('2d');if(!ctx||!c)return;const image=ctx.createImageData(180,320);if(rainbow){const phase=(time*30-rainbow.startFrame)/(rainbow.halfFrames*2);for(let y=0;y<320;y++)for(let x=0;x<180;x++){const pixel=rainbowPixel(x/180,y/320,phase),i=(y*180+x)*4;image.data[i]=pixel[0];image.data[i+1]=pixel[1];image.data[i+2]=pixel[2];image.data[i+3]=255;}}ctx.putImageData(image,0,0);},[rainbow,time]);
  const pose = cutTransitionPose(value, windows.filter(w=>w.presetId!=='rainbow-light-leak'), time);
  if (!windows.length || (normalizeCutTransition(value) === "none" && !windows.some((w) => w.presetId))) return null;
  return <><canvas ref={canvas} width={180} height={320} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[8] size-full" style={{mixBlendMode:"screen",opacity:rainbow?1:0}}/><div aria-hidden="true" data-cut-transition={normalizeCutTransition(value)} className="pointer-events-none absolute inset-0 z-[8]" style={{ backgroundColor: pose.color, opacity: pose.opacity }} /></>;
}
