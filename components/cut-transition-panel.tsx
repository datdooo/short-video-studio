"use client";
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
  const pose = cutTransitionPose(value, windows, time);
  if (!windows.length || (normalizeCutTransition(value) === "none" && !windows.some((w) => w.presetId))) return null;
  return <div aria-hidden="true" data-cut-transition={normalizeCutTransition(value)} className="pointer-events-none absolute inset-0 z-[8]" style={{ backgroundColor: pose.color, opacity: pose.opacity }} />;
}
