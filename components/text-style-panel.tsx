"use client";

import { Check } from "lucide-react";
import { listFonts, fontFamilyForStyle } from "@/lib/visual-style/fonts.mjs";
import { listTextPresets } from "@/lib/visual-style/text-presets.mjs";
import { textPreviewCss } from "@/lib/visual-style/text-render.mjs";
import type { VisualStyle } from "@/lib/visual-style/types";

const presets = listTextPresets();
const fonts = listFonts();
export function TextStylePanel({ style, onPreset }: { style: VisualStyle; onPreset: (id: string) => void }) {
  const selected = style.textPresetId || "current";
  return <section aria-labelledby="text-style-heading" className="mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
    <h3 id="text-style-heading" className="text-sm font-semibold">Text style</h3>
    <p className="mt-1 text-xs leading-5 text-zinc-500">Áp dụng cho tiêu đề và phụ đề. Bạn vẫn có thể chỉnh riêng phụ đề bên dưới.</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {presets.map((preset) => <button key={preset.id} type="button" aria-label={`Text style: ${preset.label}`} aria-pressed={selected === preset.id} title={preset.description} onClick={() => onPreset(preset.id)} className={`relative rounded-xl border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${selected === preset.id ? "border-white bg-white/10" : "border-white/10 bg-black/20 hover:border-white/40"}`}>
        <span aria-hidden="true" className="flex min-h-10 items-center justify-center overflow-hidden rounded-lg bg-[#191b21] px-1 text-center text-lg leading-tight" style={textPreviewCss(preset.originalTitle, preset.id === "jp-clean" ? "トマト" : preset.id === "kr-clean" ? "토마토" : "Aa", 0.25)}>{preset.id === "jp-clean" ? "トマト" : preset.id === "kr-clean" ? "토마토" : "Aa"}</span>
        <span className="mt-2 flex items-center justify-between gap-1 text-xs font-medium">{preset.label}{selected === preset.id && <Check aria-hidden="true" className="size-3 shrink-0" />}</span>
      </button>)}
    </div>
  </section>;
}
export function TextFontSelector({ style, onFont }: { style: VisualStyle; onFont: (id: string) => void }) {
  return <div>
    <label htmlFor="text-font" className="sr-only">Font</label>
    <select id="text-font" value={style.originalTitle.font} onChange={(event) => onFont(event.target.value)} className="studio-input mt-1 w-full text-sm">
      {["Recommended", "Japanese", "Korean"].map((group) => <optgroup key={group} label={group}>{fonts.filter((font) => font.group === group).map((font) => <option key={font.id} value={font.id} style={{ fontFamily: fontFamilyForStyle(font.id, font.group === "Japanese" ? "トマト" : font.group === "Korean" ? "토마토" : "Aa", { browser: true }) }}>{font.label}</option>)}</optgroup>)}
    </select>
  </div>;
}
