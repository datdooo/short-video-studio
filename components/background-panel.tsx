"use client";

import { Check } from "lucide-react";
import { backgroundCss, listBackgroundPresets, type Background } from "@/lib/visual-style/backgrounds.mjs";

const presets = listBackgroundPresets();
export function BackgroundPanel({ background, onPreset }: { background: Background; onPreset: (id: string) => void }) {
  const selected = background.presetId || "current";
  return <section aria-labelledby="background-heading" className="mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
    <h3 id="background-heading" className="text-sm font-semibold">Background</h3>
    <div className="mt-3 grid grid-cols-3 gap-2">
      {presets.map((preset) => <button key={preset.id} type="button" aria-label={`Background: ${preset.label}`} aria-pressed={selected === preset.id} onClick={() => onPreset(preset.id)} className={`relative rounded-xl border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${selected === preset.id ? "border-white bg-white/10" : "border-white/10 bg-black/20 hover:border-white/40"}`}>
        <span aria-hidden="true" className="relative block h-10 overflow-hidden rounded-lg" style={backgroundCss(preset.background)}>
          {preset.background.mode === "source-blur" && <span className="absolute -inset-2" style={{ background: "linear-gradient(135deg,#789b65,#799dab,#c99b72)", filter: "blur(6px)", opacity: preset.background.opacity }} />}
        </span>
        <span className="mt-2 flex items-center justify-between gap-1 text-[11px] font-medium">{preset.label}{selected === preset.id && <Check aria-hidden="true" className="size-3 shrink-0" />}</span>
      </button>)}
    </div>
  </section>;
}
