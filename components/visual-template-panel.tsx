"use client";

import { Check,ChevronDown } from "lucide-react";
import type { VisualStyle } from "@/lib/visual-style/types";
import { listVisualTemplates, applyVisualTemplate, matchVisualTemplate } from "@/lib/visual-style/templates.mjs";
import { backgroundCss } from "@/lib/visual-style/backgrounds.mjs";
import { overlayAssetUrl } from "@/lib/visual-style/overlays.mjs";
import { browserFilterStyle } from "@/lib/visual-style/filters.mjs";
import { textPreviewCss } from "@/lib/visual-style/text-render.mjs";
import { VideoFilterDefinition } from "./video-filter-panel";
const templates = listVisualTemplates().map((recipe) => ({ ...recipe, style: applyVisualTemplate(undefined, recipe.id) }));
export function VisualTemplatePanel({ style, onTemplate }: { style: VisualStyle; onTemplate: (id: string) => void }) {
  const selected = matchVisualTemplate(style);
  return <details aria-labelledby="visual-template-heading" className="group/template mt-5 rounded-2xl border border-white/15 bg-white/[.04] p-4">
    <summary id="visual-template-heading" className="group flex cursor-pointer list-none items-center justify-between gap-2 rounded text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white [&::-webkit-details-marker]:hidden"><span className="min-w-0 break-words">Visual Template · <span role="status" aria-label="Visual template status">{templates.find(template=>template.id===selected)?.label??'Custom'}</span></span><ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open/template:rotate-180" /></summary>
    <p className="mt-1 text-xs leading-5 text-zinc-500">Chọn một giao diện đầy đủ, rồi tùy chỉnh bên dưới.</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {templates.map((template) => {
        const filterId = `studio-template-${template.id}`;
        const sample = template.category === "regional" ? (template.fontId === "Noto Sans JP" ? "学びを育てる" : "함께 배우기") : "Create & Learn";
        return <button key={template.id} type="button" aria-label={`Visual template: ${template.label}`} aria-pressed={selected === template.id} title={template.description} onClick={() => onTemplate(template.id)} className={`relative rounded-xl border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${selected === template.id ? "border-white bg-white/10" : "border-white/10 bg-black/20 hover:border-white/40"}`}>
          <VideoFilterDefinition filter={template.style.filter} id={filterId} />
          <span aria-hidden="true" className="relative flex h-16 items-center justify-center overflow-hidden rounded-lg bg-black" style={backgroundCss(template.style.background)}>
            {template.style.background.mode === "source-blur" && <span className="absolute -inset-2" style={{ background: "linear-gradient(135deg,#789b65,#799dab,#c99b72)", opacity: template.style.background.opacity, filter: `${browserFilterStyle(template.style.filter, undefined, filterId)} blur(6px)` }} />}
            {template.style.overlays.map((overlay) => <span key={overlay.id} className="absolute inset-0" style={{ backgroundImage: `url("${overlayAssetUrl(overlay.assetId)}")`, backgroundSize: "100% 100%", opacity: overlay.opacity }} />)}
            <span className="relative px-1 text-center text-[11px]" style={textPreviewCss(template.style.originalTitle, sample, 0.25)}>{sample}</span>
          </span>
          <span className="mt-2 flex items-center justify-between gap-1 text-[11px] font-medium">{template.label}{selected === template.id && <Check aria-hidden="true" className="size-3 shrink-0" />}</span>
        </button>;
      })}
    </div>
  </details>;
}
