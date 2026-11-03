"use client";
import { WORKER_ORIGIN, type WorkerSource } from "@/lib/api/worker-client";
import type { EditPart, EditPlan } from "@/lib/edit-plan";
import { TITLE_SHINE_SECONDS, TITLE_SHINE_WIDTH, foregroundGeometry } from "@/lib/render-config.mjs";
import { fitTitlePair } from "@/lib/render-spec";
import { fontFamilyForStyle } from "@/lib/visual-style/fonts.mjs";
import { constrainTitlePair, needsMeasuredTitleFit, partOverlayTitle } from "@/lib/visual-style/title-fit.mjs";
import type { VisualStyle } from "@/lib/visual-style/types";
import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";
type State = {
  activePart: EditPart;
  deckVideos: RefObject<(HTMLVideoElement | null)[]>;
  hasEditPlan: boolean;
  localVideoUrl: string;
  partDuration: number;
  plan: EditPlan;
  preparedSource: WorkerSource | null;
  previewDuration: number;
  previewEffectTime: number;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  previewVisualStyle: VisualStyle;
  previewWidth: number;
  sourceMode: "youtube" | "local";
  sourceSelectionEpoch: RefObject<number>;
  sourceSize: { width: number; height: number };
};
export function usePreviewStyle(state: State) {
  const {
    activePart,
    deckVideos,
    hasEditPlan,
    localVideoUrl,
    partDuration,
    plan,
    preparedSource,
    previewDuration,
    previewEffectTime,
    previewVideoRef,
    previewVisualStyle,
    previewWidth,
    sourceMode,
    sourceSelectionEpoch,
    sourceSize,
  } = state;
  const timelineDuration = hasEditPlan ? partDuration : previewDuration;
  const overlayPartTitle = partOverlayTitle(activePart.title);
  const fontStack = useMemo(
    () =>
      fontFamilyForStyle(previewVisualStyle.originalTitle.font, `${plan.originalTitle} ${activePart.title}`, {
        browser: true,
      }).split(", "),
    [activePart.title, plan.originalTitle, previewVisualStyle.originalTitle.font],
  );
  const legacyTitlePair = useMemo(
    () => fitTitlePair(plan.originalTitle, activePart.title),
    [plan.originalTitle, activePart.title],
  );
  const titleFitInput = useMemo(
    () => ({
      original: plan.originalTitle,
      part: overlayPartTitle,
      originalStyle: previewVisualStyle.originalTitle,
      partStyle: previewVisualStyle.partTitle,
      scale: previewWidth / 1080,
    }),
    [
      plan.originalTitle,
      overlayPartTitle,
      previewVisualStyle.originalTitle,
      previewVisualStyle.partTitle,
      previewWidth,
    ],
  );
  const [measuredTitlePair, setMeasuredTitlePair] = useState<{
    input: typeof titleFitInput;
    pair: typeof legacyTitlePair;
  } | null>(null);
  useEffect(() => {
    const style = { originalTitle: titleFitInput.originalStyle, partTitle: titleFitInput.partStyle };
    if (!needsMeasuredTitleFit(style)) return;
    let cancelled = false;
    void (async () => {
      for (const [text, appearance] of [
        [titleFitInput.original, style.originalTitle],
        [titleFitInput.part, style.partTitle],
      ] as const) {
        await document.fonts.load(
          `${appearance.fontWeight} 70px ${fontFamilyForStyle(appearance.font, text, { browser: true })}`,
          text || "A",
        );
      }
      if (cancelled) return;
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      const pair = await constrainTitlePair(
        titleFitInput.original,
        titleFitInput.part,
        legacyTitlePair,
        (text, size, role) => {
          const appearance = role === "original" ? style.originalTitle : style.partTitle;
          context.font = `${appearance.fontWeight} ${(size * titleFitInput.scale).toFixed(2)}px ${fontFamilyForStyle(appearance.font, role === "original" ? titleFitInput.original : titleFitInput.part, { browser: true })}`;
          const metrics = context.measureText(text);
          return (
            Math.max(metrics.width, metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) /
              titleFitInput.scale +
            appearance.outline * 2 +
            2
          );
        },
      );
      if (!cancelled) setMeasuredTitlePair({ input: titleFitInput, pair });
    })().catch((error) => console.error("Title font measurement failed", error));
    return () => {
      cancelled = true;
    };
  }, [titleFitInput, legacyTitlePair]);
  const { original: originalTitleFit, part: partTitleFit } =
    measuredTitlePair?.input === titleFitInput ? measuredTitlePair.pair : legacyTitlePair;
  const previewScale = previewWidth / 1080;
  const previewVideoUrl = useMemo(
    () =>
      (sourceMode === "local" && localVideoUrl) ||
      (preparedSource ? `${WORKER_ORIGIN}/api/sources/${preparedSource.id}/media` : ""),
    [localVideoUrl, preparedSource, sourceMode],
  );
  const decodedVideo = deckVideos.current.find(
    (video) =>
      !!video && video.getAttribute("src") === previewVideoUrl && video.readyState >= 1 && video.videoWidth > 0,
  );
  const foregroundSourceWidth = decodedVideo?.videoWidth || preparedSource?.width || sourceSize.width,
    foregroundSourceHeight = decodedVideo?.videoHeight || preparedSource?.height || sourceSize.height;
  const foregroundImage = foregroundGeometry(foregroundSourceWidth, foregroundSourceHeight);
  const titleShineStyle = {
    maskImage: "linear-gradient(to right, transparent, #000 50%, transparent)",
    maskRepeat: "no-repeat",
    maskSize: `${TITLE_SHINE_WIDTH * previewScale}px 100%`,
    maskPosition: `${(((1080 - TITLE_SHINE_WIDTH) * (previewEffectTime % TITLE_SHINE_SECONDS)) / TITLE_SHINE_SECONDS - 90) * previewScale}px 0`,
  };
  const previewSourceEpoch = sourceSelectionEpoch.current;
  const isCurrentPreviewVideo = (video: HTMLVideoElement) =>
    previewSourceEpoch === sourceSelectionEpoch.current && video === previewVideoRef.current;
  return {
    timelineDuration,
    overlayPartTitle,
    fontStack,
    legacyTitlePair,
    titleFitInput,
    measuredTitlePair,
    setMeasuredTitlePair,
    originalTitleFit,
    partTitleFit,
    previewScale,
    previewVideoUrl,
    decodedVideo,
    foregroundSourceWidth,
    foregroundSourceHeight,
    foregroundImage,
    titleShineStyle,
    previewSourceEpoch,
    isCurrentPreviewVideo,
  };
}
