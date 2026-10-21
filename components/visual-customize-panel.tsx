"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { VisualStyle } from "@/lib/visual-style/types";
import { getTextPreset } from "@/lib/visual-style/text-presets.mjs";
import { getFontDefinition } from "@/lib/visual-style/fonts.mjs";
import { getFilterPreset } from "@/lib/visual-style/filters.mjs";
import { getBackgroundPreset } from "@/lib/visual-style/backgrounds.mjs";
import { getOverlayPreset } from "@/lib/visual-style/overlays.mjs";
import { getTitleAnimation } from "@/lib/visual-style/animations.mjs";
import { getCutTransition } from "@/lib/visual-style/cut-transitions.mjs";

type Control = "text" | "font" | "filter" | "background" | "overlay" | "animation" | "transition";
export function VisualCustomizePanel({ style, controls,include }: { style: VisualStyle; controls: Record<Control, ReactNode>;include?:Control[] }) {
  const filter = getFilterPreset(style.filter.presetId || "current");
  const rows: { id: Control; label: string; value: string }[] = [
    { id: "text", label: "Text Style", value: getTextPreset(style.textPresetId || "current").label },
    { id: "font", label: "Font", value: getFontDefinition(style.originalTitle.font).label },
    { id: "filter", label: "Filter", value: filter.label + (style.filter.presetId ? ` · ${Math.round((style.filter.intensity ?? 1) * 100)}%` : "") },
    { id: "background", label: "Background", value: getBackgroundPreset(style.background.presetId || "current").label },
    { id: "overlay", label: "Overlay", value: style.overlays.length ? style.overlays.map((overlay) => "presetId" in overlay ? getOverlayPreset(overlay.presetId).label : "Custom").join(" + ") : "None" },
    { id: "animation", label: "Text Animation", value: getTitleAnimation(style.titleAnimation).label },
    { id: "transition", label: "Cut Transition", value: getCutTransition(style.cutTransition).label },
  ];
  return <details data-visual-customize className="studio-disclosure visual-customize mt-5 min-w-0 rounded-2xl border border-white/10 bg-white/[.025]">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
      Customize<ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform" />
    </summary>
    <div className="divide-y divide-white/8 border-t border-white/8 px-3">
      {rows.filter(row=>!include||include.includes(row.id)).map(({ id, label, value }) => <details key={id} data-customize-row={id} className="min-w-0">
        <summary className="grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_16px] items-center gap-3 rounded-lg py-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <span className="font-medium text-zinc-300">{label}</span><span className="truncate text-right text-zinc-400" title={value}>{value}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-zinc-500 transition-transform" />
        </summary>
        <div className="visual-customize-options min-w-0 pb-4 pt-1">{controls[id]}</div>
      </details>)}
    </div>
  </details>;
}
