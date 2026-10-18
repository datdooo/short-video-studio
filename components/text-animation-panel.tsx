"use client";
import { listTitleAnimations, normalizeTitleAnimation } from "@/lib/visual-style/animations.mjs";
import type { TitleAnimationId } from "@/lib/visual-style/animations.mjs";
const animations = listTitleAnimations();
export function TextAnimationPanel({ value, onChange }: { value?: TitleAnimationId; onChange: (id: TitleAnimationId) => void }) {
  return <div className="mt-5">
    <label htmlFor="title-animation" className="text-xs font-semibold text-zinc-300">Text animation</label>
    <select id="title-animation" value={normalizeTitleAnimation(value)} onChange={(event) => onChange(normalizeTitleAnimation(event.target.value))} className="studio-input mt-1 w-full text-sm">
      {animations.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
    </select>
    <p className="mt-1 text-[11px] text-zinc-500">Titles + part number · first 0.5s of each part. Independent of visual templates.</p>
  </div>;
}
