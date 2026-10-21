"use client";

import { Check } from "lucide-react";
import { listFilterPresets, filterColorMatrix, browserFilterStyle, type VideoFilter } from "@/lib/visual-style/filters.mjs";

export function VideoFilterDefinition({ filter, id }: { filter: VideoFilter; id: string }) {
  if (!filter.presetId) return null;
  return <svg width="0" height="0" aria-hidden="true" className="pointer-events-none absolute"><defs>
    <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={filterColorMatrix(filter).join(" ")} />
    </filter>
  </defs></svg>;
}

const presets = listFilterPresets();
export function VideoFilterPanel({ filter, onPreset, onIntensity }: { filter: VideoFilter; onPreset: (id: string) => void; onIntensity: (value: number) => void }) {
  const selected = filter.presetId || "current";
  return <section aria-labelledby="video-filter-heading" className="mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
    <h3 id="video-filter-heading" className="text-sm font-semibold">Video Filter</h3>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {presets.map((preset) => {
        const id = `studio-filter-card-${preset.id}`;
        return <button key={preset.id} type="button" aria-label={`Video filter: ${preset.label}`} aria-pressed={selected === preset.id} title={preset.description} onClick={() => onPreset(preset.id)} className={`relative rounded-xl border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${selected === preset.id ? "border-white bg-white/10" : "border-white/10 bg-black/20 hover:border-white/40"}`}>
          <VideoFilterDefinition filter={preset.filter} id={id} />
          <span aria-hidden="true" className="flex h-9 overflow-hidden rounded-lg" style={{ filter: browserFilterStyle(preset.filter, undefined, id) }}>
            {["#c99b72", "#789b65", "#799dab", "#8a8084"].map((color) => <span key={color} className="flex-1" style={{ backgroundColor: color }} />)}
          </span>
          <span className="mt-2 flex items-center justify-between gap-1 text-xs font-medium">{preset.label}{selected === preset.id && <Check aria-hidden="true" className="size-3 shrink-0" />}</span>
        </button>;
      })}
    </div>
    <label htmlFor="video-filter-intensity" className="mt-4 flex items-center justify-between text-xs font-medium"><span>Intensity</span><output>{Math.round((filter.intensity ?? 1) * 100)}%</output></label>
    <input id="video-filter-intensity" aria-label="Video filter intensity" type="range" min="0" max="100" step="1" disabled={selected === "current"} value={Math.round((filter.intensity ?? 1) * 100)} onChange={(event) => onIntensity(Number(event.target.value) / 100)} className="mt-2 w-full accent-white disabled:opacity-30" />
    <p role="status" className="mt-1 text-xs text-zinc-400">{selected === "current" ? "Current" : presets.find((preset) => preset.id === selected)?.label}</p>
  </section>;
}
