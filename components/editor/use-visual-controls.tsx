"use client";
import { BackgroundPanel } from "@/components/background-panel";
import { CutTransitionPanel } from "@/components/cut-transition-panel";
import { OverlayPanel } from "@/components/overlay-panel";
import { TextAnimationPanel } from "@/components/text-animation-panel";
import { TextFontSelector, TextStylePanel } from "@/components/text-style-panel";
import { VideoFilterPanel } from "@/components/video-filter-panel";
import type { EditPlan } from "@/lib/edit-plan";
import { applyBackgroundPreset } from "@/lib/visual-style/background-presets.mjs";
import { applyFilterIntensity, applyFilterPreset } from "@/lib/visual-style/filter-presets.mjs";
import { normalizeVisualStyle, resolvePlanVisualStyle } from "@/lib/visual-style/normalize.mjs";
import { applyOverlayOpacity, applyOverlayPreset } from "@/lib/visual-style/overlay-presets.mjs";
import { applyFontOverride, applyTextPreset } from "@/lib/visual-style/text-presets.mjs";
import type { VisualStyle } from "@/lib/visual-style/types";
import type { SetStateAction } from "react";
type State = { previewVisualStyle: VisualStyle; setPlan: (update: SetStateAction<EditPlan>) => void };
export function useVisualControls(state: State) {
  const { previewVisualStyle, setPlan } = state;
  const visualControls = {
    overlay: (
      <OverlayPanel
        overlays={previewVisualStyle.overlays}
        onPreset={(id) =>
          setPlan((current) => {
            const visualStyle = applyOverlayPreset(resolvePlanVisualStyle(current), id);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })
        }
        onOpacity={(opacity) =>
          setPlan((current) => {
            const visualStyle = applyOverlayOpacity(resolvePlanVisualStyle(current), opacity);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })
        }
      />
    ),
    background: (
      <BackgroundPanel
        background={previewVisualStyle.background}
        onPreset={(id) =>
          setPlan((current) => {
            const visualStyle = applyBackgroundPreset(resolvePlanVisualStyle(current), id);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })
        }
      />
    ),
    filter: (
      <VideoFilterPanel
        filter={previewVisualStyle.filter}
        onPreset={(id) =>
          setPlan((current) => {
            const visualStyle = applyFilterPreset(resolvePlanVisualStyle(current), id);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })
        }
        onIntensity={(intensity) =>
          setPlan((current) => {
            const visualStyle = applyFilterIntensity(resolvePlanVisualStyle(current), intensity);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })
        }
      />
    ),
    animation: (
      <TextAnimationPanel
        value={previewVisualStyle.titleAnimation}
        onChange={(id) =>
          setPlan((current) => {
            const visualStyle = normalizeVisualStyle({ ...resolvePlanVisualStyle(current), titleAnimation: id });
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })
        }
      />
    ),
    transition: (
      <CutTransitionPanel
        value={previewVisualStyle.cutTransition}
        onChange={(id) =>
          setPlan((current) => {
            const visualStyle = normalizeVisualStyle({ ...resolvePlanVisualStyle(current), cutTransition: id });
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })
        }
      />
    ),
    text: (
      <TextStylePanel
        style={previewVisualStyle}
        onPreset={(id) =>
          setPlan((current) => {
            const visualStyle = applyTextPreset(resolvePlanVisualStyle(current), id);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })
        }
      />
    ),
    font: (
      <TextFontSelector
        style={previewVisualStyle}
        onFont={(font) =>
          setPlan((current) => {
            const visualStyle = applyFontOverride(resolvePlanVisualStyle(current), font);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })
        }
      />
    ),
  };
  return { visualControls };
}
