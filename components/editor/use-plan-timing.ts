"use client";
import type { WorkerHealth } from "@/lib/api/worker-client";
import { type WorkerSource } from "@/lib/api/worker-client";
import { EditPlan } from "@/lib/edit-plan";
import { webAiEditorSignature } from "@/lib/editor-identity";
import { captureAiMainRanges } from "@/lib/main-ranges.mjs";
import { PREVIEW_RATE, previewToExportTime } from "@/lib/preview-config.mjs";
import type { SubtitleStyle } from "@/lib/subtitles.mjs";
import { effectiveCaptionTrack, partCaptions, type CaptionTrack } from "@/lib/subtitles.mjs";
import {
  hookRangeKey,
  partTransitionWindows,
  presentationDuration,
  presentationSegments,
} from "@/lib/teaser-hooks.mjs";
import { DEFAULT_VISUAL_STYLE } from "@/lib/visual-style/defaults.mjs";
import { browserFilterStyle } from "@/lib/visual-style/filters.mjs";
import { resolvePlanVisualStyle } from "@/lib/visual-style/normalize.mjs";
import { effectiveCutPlan } from "@/worker/part-start.mjs";
import { useMemo } from "react";
type State = {
  activePartIndex: number;
  hasEditPlan: boolean;
  localVideoUrl: string;
  mainDraftErrors: Record<number, { sourceKey: string; key: string; invalid: boolean }>;
  plan: EditPlan;
  preparedSource: WorkerSource | null;
  previewCurrentTime: number;
  sourceCaptions: CaptionTrack | null;
  sourceMode: "youtube" | "local";
  sourceUrl: string;
  subtitleSettings: SubtitleStyle;
  teaserDraftErrors: Record<number, { sourceKey: string; key: string; message: string }>;
  workerHealth: WorkerHealth | null;
};
export function usePlanTiming(state: State) {
  const {
    activePartIndex,
    hasEditPlan,
    localVideoUrl,
    mainDraftErrors,
    plan,
    preparedSource,
    previewCurrentTime,
    sourceCaptions,
    sourceMode,
    sourceUrl,
    subtitleSettings,
    teaserDraftErrors,
    workerHealth,
  } = state;
  const mainEditorSourceKey = preparedSource?.id || (sourceMode === "local" ? localVideoUrl : sourceUrl);
  const timing = useMemo(() => {
    let base = { parts: plan.parts, providerUsed: plan.providerUsed, analysis: plan.analysis };
    try {
      base = effectiveCutPlan(base);
      // Legacy AI plans get an in-memory restore checkpoint from their actual
      // effective main ranges, never an outer start/end window.
      const effective = captureAiMainRanges(base);
      return { parts: effective.parts, analysis: effective.analysis, error: "" };
    } catch (caught) {
      return {
        parts: base.parts,
        analysis: base.analysis,
        error: caught instanceof Error ? caught.message : "Thời gian không hợp lệ.",
      };
    }
  }, [plan.parts, plan.providerUsed, plan.analysis, preparedSource?.duration]);
  const draftError =
    hasEditPlan &&
    timing.parts.some(
      (p) =>
        mainDraftErrors[p.id]?.sourceKey === mainEditorSourceKey &&
        mainDraftErrors[p.id]?.key === hookRangeKey(p) &&
        mainDraftErrors[p.id]?.invalid,
    )
      ? "Timeline có dòng chưa hợp lệ; sửa hoặc xóa dòng trước khi xuất/lưu/phân tích."
      : "";
  const teaserDraftError = hasEditPlan
    ? timing.parts
        .filter((p) => p.teaserEnabled !== false)
        .map((p) => teaserDraftErrors[p.id])
        .find((d) => d?.sourceKey === mainEditorSourceKey && d.message)?.message || ""
    : "";
  const captionState = useMemo(() => {
    if (!preparedSource) return { track: undefined, error: "" };
    try {
      return {
        track: effectiveCaptionTrack(
          { captionCues: plan.captionCues },
          preparedSource,
          sourceCaptions?.sourceId === preparedSource.id ? sourceCaptions : undefined,
        ),
        error: "",
      };
    } catch (e) {
      return { track: undefined, error: e instanceof Error ? e.message : "Phụ đề không hợp lệ." };
    }
  }, [plan.captionCues, preparedSource, sourceCaptions]);
  const effectiveTiming = {
    plan: { ...plan, parts: timing.parts, analysis: timing.analysis },
    error: timing.error || draftError || teaserDraftError || captionState.error,
  };
  const previewPlan: EditPlan = {
    ...effectiveTiming.plan,
    captionCues: captionState.track,
    musicSpeech: plan.musicSpeech?.sourceId === preparedSource?.id ? plan.musicSpeech : undefined,
  };
  const previewVisualStyle = useMemo(
    () => resolvePlanVisualStyle({ visualStyle: previewPlan.visualStyle, subtitles: subtitleSettings }),
    [previewPlan.visualStyle, subtitleSettings],
  );
  const videoColorFilter = browserFilterStyle(previewVisualStyle.filter, {
    contrast: workerHealth?.render?.contrast ?? DEFAULT_VISUAL_STYLE.filter.contrast,
    saturation: workerHealth?.render?.saturation ?? DEFAULT_VISUAL_STYLE.filter.saturation,
  });
  const activePart = previewPlan.parts[activePartIndex];
  const playbackSegments = useMemo(() => presentationSegments(activePart), [activePart]);
  const transitionWindows = useMemo(
    () =>
      hasEditPlan
        ? partTransitionWindows(activePart, previewVisualStyle.cutTransition, previewPlan.hookTransition)
        : [],
    [hasEditPlan, previewVisualStyle.cutTransition, activePart, previewPlan.hookTransition],
  );
  const subtitleCues = useMemo(() => captionState.track?.cues || [], [captionState.track]);
  const previewCaptions = useMemo(
    () => partCaptions(previewPlan.captionCues?.cues || subtitleCues, activePart, previewVisualStyle.subtitle),
    [previewPlan.captionCues, subtitleCues, activePart, previewVisualStyle.subtitle],
  );
  const previewCaption = previewCaptions.find(
    (cue) => previewCurrentTime * PREVIEW_RATE >= cue.start && previewCurrentTime * PREVIEW_RATE < cue.end,
  );
  const partDuration = presentationDuration(activePart) / PREVIEW_RATE;
  const previewEffectTime = previewToExportTime(previewCurrentTime);
  const mainSignature = webAiEditorSignature(previewPlan, subtitleCues);
  return {
    mainEditorSourceKey,
    timing,
    draftError,
    teaserDraftError,
    captionState,
    effectiveTiming,
    previewPlan,
    previewVisualStyle,
    videoColorFilter,
    activePart,
    playbackSegments,
    transitionWindows,
    subtitleCues,
    previewCaptions,
    previewCaption,
    partDuration,
    previewEffectTime,
    mainSignature,
  };
}
