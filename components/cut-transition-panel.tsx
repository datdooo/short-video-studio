"use client";
import {TRANSITION_SPRITE,TRANSITION_FRAMES,SPRITE_IDS,transitionFrame,foregroundLeakClip} from "@/lib/visual-style/foreground-transitions.mjs";
import { Check } from "lucide-react";
import { listCutTransitions, normalizeCutTransition } from "@/lib/visual-style/cut-transitions.mjs";
import type { CutTransitionId, CutTransitionWindow } from "@/lib/visual-style/cut-transitions.mjs";
const presets = listCutTransitions();
export function CutTransitionPanel({ value, onChange }: { value?: CutTransitionId; onChange: (id: CutTransitionId) => void }) {
  const selected = normalizeCutTransition(value);
  return <section aria-labelledby="cut-transition-heading" className="mt-5">
    <h3 id="cut-transition-heading" className="text-xs font-semibold text-zinc-300">Cut Transition</h3>
    <div className="mt-2 grid grid-cols-3 gap-2">{presets.map(({ id, label }) => <button key={id} type="button" aria-label={`Cut transition: ${label}`} aria-pressed={selected === id} onClick={() => onChange(id)} className={`flex items-center justify-between gap-1 rounded-xl border px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${selected === id ? "border-white bg-white/10" : "border-white/10 hover:border-white/40"}`}>{label}{selected === id && <Check aria-hidden="true" className="size-3" />}</button>)}</div>
  </section>;
}
// All effects live inside the clipped foreground, below scene decorations/text.
export function ForegroundTransition({value,windows,time,width,height}:{value?:CutTransitionId;windows:CutTransitionWindow[];time:number;width:number;height:number}){
 const active=windows.find(w=>time*30>=w.startFrame&&time*30<=w.endFrame),id=active?.presetId||value||'none';
 if(!active||!SPRITE_IDS.includes(id))return null;
 const g=foregroundLeakClip(width,height),column=SPRITE_IDS.indexOf(id),frame=transitionFrame(active,time);
 return <div aria-hidden="true" data-foreground-transition={id} className="pointer-events-none absolute inset-0 z-[1]" style={{mixBlendMode:id==='dip-black'?'multiply':'screen',backgroundImage:`url(${TRANSITION_SPRITE})`,backgroundSize:`${SPRITE_IDS.length*100}% ${TRANSITION_FRAMES*100}%`,backgroundPosition:`${column/(SPRITE_IDS.length-1)*100}% ${frame/(TRANSITION_FRAMES-1)*100}%`,clipPath:`inset(${g.y/1350*100}% ${g.x/1080*100}% ${g.y/1350*100}% ${g.x/1080*100}%)`}}/>;
}
