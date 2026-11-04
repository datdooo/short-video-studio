"use client";
import { Button } from "@/components/ui/button";

import { useSyncExternalStore } from "react";
import { UI_STRINGS } from "@/lib/ui-strings";
import { ForegroundTransition } from "@/components/cut-transition-panel";
import { SceneOverlays } from "@/components/overlay-panel";
import { PreviewBackground } from "@/components/preview-background";
import { VideoFilterDefinition } from "@/components/video-filter-panel";
import { type WorkerSource } from "@/lib/api/worker-client";
import type { EditPart, Segment } from "@/lib/edit-plan";
import { EditPlan, formatTime } from "@/lib/edit-plan";
import { PREVIEW_RATE, previewToExportTime } from "@/lib/preview-config.mjs";
import { locateTimelineTime } from "@/lib/preview-timeline.mjs";
import {
  CANVAS_WIDTH,
  TITLE_SHINE_SECONDS,
  TITLE_SHINE_WIDTH,
  FOREGROUND_HEIGHT,
  FOREGROUND_SCALE,
  FOREGROUND_Y,
  TITLE_LAYOUT,
} from "@/lib/render-config.mjs";
import { formatSourceTimecode } from "@/lib/source-timecode.mjs";
import type { Caption } from "@/lib/subtitles.mjs";
import { subtitleY } from "@/lib/subtitles.mjs";
import { presentationDuration } from "@/lib/teaser-hooks.mjs";
import { titleAnimationPreviewCss } from "@/lib/visual-style/animations.mjs";
import { backgroundCss } from "@/lib/visual-style/backgrounds.mjs";
import type { CutTransitionWindow } from "@/lib/visual-style/cut-transitions.mjs";
import { subtitlePreviewCss, textPreviewCss } from "@/lib/visual-style/text-render.mjs";
import { needsMeasuredTitleFit } from "@/lib/visual-style/title-fit.mjs";
import type { TextStyle, VisualStyle } from "@/lib/visual-style/types";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";

type Props = {
  activePart: EditPart;
  activePartIndex: number;
  bindDeckA: (v: HTMLVideoElement | null) => void;
  bindDeckB: (v: HTMLVideoElement | null) => void;
  deckVideos: RefObject<(HTMLVideoElement | null)[]>;
  foregroundImage: {
    fittedWidth: number;
    fittedHeight: number;
    scaledWidth: number;
    scaledHeight: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  foregroundSourceHeight: number;
  foregroundSourceWidth: number;
  hasEditPlan: boolean;
  isCurrentPreviewVideo: (video: HTMLVideoElement) => boolean;
  isPreparingSource: boolean;
  isPreviewPlaying: boolean;
  mainDraftErrors: Record<number, { sourceKey: string; key: string; invalid: boolean }>;
  mainEditorSourceKey: string;
  measuredTitlePair: {
    input: { original: string; part: string; originalStyle: TextStyle; partStyle: TextStyle; scale: number };
    pair: {
      original: {
        text: string;
        fontSize: number;
        lineSpacing: number;
        lineCount: number;
        maxLines: number;
        truncated: boolean;
      };
      part: {
        text: string;
        fontSize: number;
        lineSpacing: number;
        lineCount: number;
        maxLines: number;
        truncated: boolean;
      };
    };
  } | null;
  originalTitleFit: {
    text: string;
    fontSize: number;
    lineSpacing: number;
    lineCount: number;
    maxLines: number;
    truncated: boolean;
  };
  overlayPartTitle: string;
  partTitleFit: {
    text: string;
    fontSize: number;
    lineSpacing: number;
    lineCount: number;
    maxLines: number;
    truncated: boolean;
  };
  plan: EditPlan;
  playbackSegments: Segment[];
  preparedSource: WorkerSource | null;
  previewCaptions: Caption[];
  previewClock: import("@/lib/preview-clock.mjs").PreviewClock;
  previewError: string;
  previewPlan: EditPlan;
  previewPlayingRef: RefObject<boolean>;
  previewScale: number;
  previewSourceEpoch: number;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  previewVideoUrl: string;
  previewVisualStyle: VisualStyle;
  reviewCompact: boolean;
  reviewVisible: boolean;
  seekPreview: (value: number) => void;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setIsPreviewPlaying: Dispatch<SetStateAction<boolean>>;
  setPreviewDuration: Dispatch<SetStateAction<number>>;
  setPreviewElement: Dispatch<SetStateAction<HTMLDivElement | null>>;
  setPreviewError: Dispatch<SetStateAction<string>>;
  setPreviewStage: Dispatch<SetStateAction<HTMLDivElement | null>>;
  setReviewTarget: Dispatch<SetStateAction<HTMLDivElement | null>>;
  setSourceSize: Dispatch<SetStateAction<{ width: number; height: number }>>;
  sourceSelectionEpoch: RefObject<number>;
  sourceSize: { width: number; height: number };
  teaserDraftErrors: Record<number, { sourceKey: string; key: string; message: string }>;
  teaserIssues: { partId: number; reason: string }[];
  timelineDuration: number;
  titleFitInput: { original: string; part: string; originalStyle: TextStyle; partStyle: TextStyle; scale: number };
  togglePreview: () => Promise<void>;
  transitionWindows: CutTransitionWindow[];
  updatePreviewClock: () => void;
  videoColorFilter: string;
  visibleDeck: number;
  workspace: "editor" | "batch" | "storage";
  workspaceRef: RefObject<"editor" | "batch" | "storage">;
};
export function PreviewView({ model }: { model: Props }) {
  const {
    activePart,
    activePartIndex,
    bindDeckA,
    bindDeckB,
    deckVideos,
    foregroundImage,
    foregroundSourceHeight,
    foregroundSourceWidth,
    hasEditPlan,
    isCurrentPreviewVideo,
    isPreparingSource,
    isPreviewPlaying,
    mainDraftErrors,
    mainEditorSourceKey,
    measuredTitlePair,
    originalTitleFit,
    overlayPartTitle,
    partTitleFit,
    plan,
    playbackSegments,
    preparedSource,
    previewCaptions,
    previewClock,
    previewError,
    previewPlan,
    previewPlayingRef,
    previewScale,
    previewSourceEpoch,
    previewVideoRef,
    previewVideoUrl,
    previewVisualStyle,
    reviewCompact,
    reviewVisible,
    seekPreview,
    setActivePartIndex,
    setIsPreviewPlaying,
    setPreviewDuration,
    setPreviewElement,
    setPreviewError,
    setPreviewStage,
    setReviewTarget,
    setSourceSize,
    sourceSelectionEpoch,
    sourceSize,
    teaserDraftErrors,
    teaserIssues,
    timelineDuration,
    titleFitInput,
    togglePreview,
    transitionWindows,
    updatePreviewClock,
    videoColorFilter,
    visibleDeck,
    workspace,
    workspaceRef,
  } = model;
  const previewCurrentTime = useSyncExternalStore(
    previewClock.subscribe,
    previewClock.getSnapshot,
    previewClock.getServerSnapshot,
  );
  const previewEffectTime = previewToExportTime(previewCurrentTime);
  const previewCaption = previewCaptions.find(
    (cue) => previewCurrentTime * PREVIEW_RATE >= cue.start && previewCurrentTime * PREVIEW_RATE < cue.end,
  );
  const titleShineStyle = {
    maskImage: "linear-gradient(to right, transparent, var(--sample-black) 50%, transparent)",
    maskRepeat: "no-repeat",
    maskSize: `${TITLE_SHINE_WIDTH * previewScale}px 100%`,
    maskPosition: `${(((CANVAS_WIDTH - TITLE_SHINE_WIDTH) * (previewEffectTime % TITLE_SHINE_SECONDS)) / TITLE_SHINE_SECONDS - 90) * previewScale}px 0`,
  };

  return (
    <>
      <div className="studio-part-switcher" role="group" aria-label="Part cho preview và Timeline">
        {plan.parts.map((part, index) => {
          const issue = hasEditPlan && teaserIssues.find((issue) => issue.partId === part.id),
            invalidMain =
              mainDraftErrors[part.id]?.sourceKey === mainEditorSourceKey && mainDraftErrors[part.id]?.invalid,
            invalidTeaser =
              part.teaserEnabled !== false &&
              teaserDraftErrors[part.id]?.sourceKey === mainEditorSourceKey &&
              teaserDraftErrors[part.id]?.message;
          return (
            <Button
              variant="segmented"
              size="md"
              data-state={activePartIndex === index ? "active" : "inactive"}
              type="button"
              key={part.id}
              aria-pressed={activePartIndex === index}
              data-part={part.id}
              onClick={() => setActivePartIndex(index)}
            >
              Part {part.id}
              {hasEditPlan && (
                <small>
                  {(presentationDuration(previewPlan.parts[index]) / PREVIEW_RATE).toFixed(1)}s
                  {part.mainEdited ? " · Đã sửa tay" : ""}
                </small>
              )}
              {(issue || invalidMain || invalidTeaser) && (
                <span
                  className="studio-missing-teaser"
                  title={issue ? issue.reason : invalidTeaser || "Timeline có mốc chưa hợp lệ"}
                  aria-label={`Part ${part.id}: thiếu teaser hoặc lỗi mốc`}
                >
                  !
                </span>
              )}
            </Button>
          );
        })}
        {hasEditPlan && (
          <span className="studio-active-title" title={activePart.title}>
            {activePart.title}
          </span>
        )}
      </div>
      <div
        ref={setPreviewStage}
        className="studio-preview-stage"
        data-review-visible={reviewVisible}
        data-review-compact={reviewCompact}
      >
        <div className="studio-main-preview-column">
          <div className="studio-main-preview-stage">
            <div
              ref={setPreviewElement}
              aria-busy={needsMeasuredTitleFit(previewVisualStyle) && measuredTitlePair?.input !== titleFitInput}
              className="portrait-preview studio-portrait relative overflow-hidden rounded-lg border border-white/12 bg-black"
              style={{ aspectRatio: "9 / 16" }}
            >
              <VideoFilterDefinition filter={previewVisualStyle.filter} id="studio-preview-video-color" />
              {previewVideoUrl ? (
                <PreviewBackground
                  suspended={workspace !== "editor"}
                  activeDeck={visibleDeck}
                  sourceKey={previewVideoUrl}
                  video={previewVideoRef}
                  filter={`${videoColorFilter} blur(${40 * previewScale}px)`}
                  opacity={
                    previewVisualStyle.background.mode === "source-blur" ? previewVisualStyle.background.opacity : 0
                  }
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_46%,var(--placeholder-glow),transparent_28%),linear-gradient(145deg,var(--placeholder-top)_10%,var(--placeholder-middle)_48%,var(--placeholder-bottom)_80%)]" />
              )}
              {previewVisualStyle.background.mode !== "source-blur" && (
                <div
                  data-studio-background
                  className="absolute inset-0"
                  style={backgroundCss(previewVisualStyle.background)}
                />
              )}
              <div
                className="absolute inset-x-0 isolate overflow-hidden"
                style={{
                  top: `${(FOREGROUND_Y / 1920) * 100}%`,
                  height: `${(FOREGROUND_HEIGHT / 1920) * 100}%`,
                }}
              >
                {previewVideoUrl ? (
                  <>
                    {[0, 1].map((slot) => (
                      <video
                        aria-label="Video preview nguồn"
                        key={`${previewVideoUrl}:${slot}`}
                        ref={slot === 0 ? bindDeckA : bindDeckB}
                        data-preview-deck={slot}
                        data-preview-active={visibleDeck === slot}
                        data-visual-scale={FOREGROUND_SCALE}
                        crossOrigin="anonymous"
                        className="native-preview-video cursor-pointer"
                        style={{
                          width: `${(foregroundImage.scaledWidth / CANVAS_WIDTH) * 100}%`,
                          height: `${(foregroundImage.scaledHeight / FOREGROUND_HEIGHT) * 100}%`,
                          maxWidth: "none",
                          maxHeight: "none",
                          objectFit: "contain",
                          objectPosition: "center",
                          transform: "translate(-50%, -50%)",
                          filter: videoColorFilter,
                          visibility: visibleDeck === slot ? "visible" : "hidden",
                        }}
                        src={previewVideoUrl}
                        preload="metadata"
                        playsInline
                        onClick={() => void togglePreview()}
                        onLoadedMetadata={(event) => {
                          if (
                            previewSourceEpoch !== sourceSelectionEpoch.current ||
                            event.currentTarget !== deckVideos.current[slot]
                          )
                            return;
                          const duration = Number.isFinite(event.currentTarget.duration)
                            ? event.currentTarget.duration
                            : preparedSource?.duration || 0;
                          setPreviewDuration(duration);
                          setSourceSize({
                            width: event.currentTarget.videoWidth || 1920,
                            height: event.currentTarget.videoHeight || 1080,
                          });
                          // Segment seeking belongs to the active controller, never a stale metadata event.
                          setPreviewError("");
                        }}
                        onTimeUpdate={(event) => {
                          if (isCurrentPreviewVideo(event.currentTarget)) updatePreviewClock();
                        }}
                        onPlay={(event) => {
                          if (workspaceRef.current !== "editor" || !previewPlayingRef.current) {
                            event.currentTarget.pause();
                            return;
                          }
                          if (isCurrentPreviewVideo(event.currentTarget)) setIsPreviewPlaying(true);
                        }}
                        onPause={(event) => {
                          if (!hasEditPlan && isCurrentPreviewVideo(event.currentTarget)) {
                            previewPlayingRef.current = false;
                            setIsPreviewPlaying(false);
                          }
                        }}
                        onEnded={(event) => {
                          if (!hasEditPlan && isCurrentPreviewVideo(event.currentTarget)) {
                            previewPlayingRef.current = false;
                            setIsPreviewPlaying(false);
                          }
                        }}
                        onError={(event) => {
                          if (isCurrentPreviewVideo(event.currentTarget))
                            setPreviewError(
                              "Không phát được source. Hãy bấm Chuẩn bị source lại hoặc thử video MP4/H.264.",
                            );
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(125deg,#111_0%,#572317_42%,#ef6b32_43%,#241716_47%,#0b0c0f_100%)]" />
                )}
                <ForegroundTransition
                  value={previewVisualStyle.cutTransition}
                  windows={transitionWindows}
                  time={previewEffectTime}
                  width={foregroundSourceWidth}
                  height={foregroundSourceHeight}
                />
                {previewVideoUrl && !isPreviewPlaying && (
                  <Button
                    variant="icon"
                    size="icon"
                    tooltip={`${isPreviewPlaying ? UI_STRINGS.pausePreview : UI_STRINGS.playPreview} · Space`}
                    type="button"
                    onClick={() => void togglePreview()}
                    aria-label={UI_STRINGS.playPreview}
                    style={{ zIndex: transitionWindows.length ? "var(--layer-media-play)" : undefined }}
                    className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/50 backdrop-blur-md"
                  >
                    <Play className="ml-0.5 size-5 fill-white" />
                  </Button>
                )}
              </div>
              <SceneOverlays overlays={previewVisualStyle.overlays} />
              {hasEditPlan && (
                <div
                  data-title-animation={previewVisualStyle.titleAnimation || "none"}
                  className="pointer-events-none absolute inset-0 z-(--layer-media-text)"
                  style={titleAnimationPreviewCss(previewVisualStyle.titleAnimation, previewEffectTime, previewScale)}
                >
                  <div
                    className="absolute inset-x-[8.35%] z-(--layer-media-text) flex items-end justify-center text-center"
                    style={{
                      top: TITLE_LAYOUT.original.top * previewScale,
                      height: (TITLE_LAYOUT.original.bottom - TITLE_LAYOUT.original.top) * previewScale,
                      clipPath: `inset(-${20 * previewScale}px)`,
                    }}
                  >
                    <p
                      className="social-copy overlay-copy-block relative"
                      style={{
                        ...textPreviewCss(previewVisualStyle.originalTitle, plan.originalTitle, previewScale),
                        fontSize: `${(originalTitleFit.fontSize * previewScale).toFixed(2)}px`,
                        lineHeight:
                          (originalTitleFit.fontSize + originalTitleFit.lineSpacing) / originalTitleFit.fontSize,
                      }}
                    >
                      {originalTitleFit.text}
                      {previewVisualStyle.originalTitle.effect === "current-title-glow-shine" && (
                        <span
                          aria-hidden="true"
                          className="title-shine pointer-events-none absolute inset-0"
                          style={titleShineStyle}
                        >
                          {originalTitleFit.text}
                        </span>
                      )}
                    </p>
                  </div>
                  <div
                    className="absolute inset-x-[8.35%] z-(--layer-media-text) flex items-start justify-center text-center"
                    style={{
                      top: TITLE_LAYOUT.part.top * previewScale,
                      height: (TITLE_LAYOUT.part.bottom - TITLE_LAYOUT.part.top) * previewScale,
                      clipPath: `inset(-${20 * previewScale}px)`,
                    }}
                  >
                    <p
                      className="social-copy overlay-copy-block relative"
                      style={{
                        ...textPreviewCss(previewVisualStyle.partTitle, overlayPartTitle, previewScale),
                        fontSize: `${(partTitleFit.fontSize * previewScale).toFixed(2)}px`,
                        lineHeight: (partTitleFit.fontSize + partTitleFit.lineSpacing) / partTitleFit.fontSize,
                      }}
                    >
                      {partTitleFit.text}
                      {previewVisualStyle.partTitle.effect === "current-title-glow-shine" && (
                        <span
                          aria-hidden="true"
                          className="title-shine pointer-events-none absolute inset-0"
                          style={titleShineStyle}
                        >
                          {partTitleFit.text}
                        </span>
                      )}
                    </p>
                  </div>
                  <div
                    className="absolute inset-x-0 z-(--layer-media-text) text-center"
                    style={{ top: 1804 * previewScale, lineHeight: 1 }}
                  >
                    <span
                      className="social-copy"
                      style={{
                        ...textPreviewCss(
                          previewVisualStyle.partIndicator,
                          activePart.title,
                          previewScale,
                          "indicator",
                        ),
                        fontSize: `${58 * previewScale}px`,
                      }}
                    >
                      {activePart.id}/{plan.parts.length}
                    </span>
                  </div>
                </div>
              )}
              {!previewVideoUrl && (
                <div className="studio-empty-preview">
                  {isPreparingSource ? "Đang chuẩn bị nguồn…" : "Chọn nguồn để xem preview"}
                </div>
              )}
              {hasEditPlan && previewVisualStyle.subtitle.enabled && previewCaption && (
                <div
                  className="pointer-events-none absolute inset-x-[10%] z-(--layer-media-caption) text-center"
                  style={{
                    bottom: `${((1920 - subtitleY(previewVisualStyle.subtitle, preparedSource?.height || sourceSize.height)) / 1920) * 100}%`,
                  }}
                >
                  <p
                    className="whitespace-pre-line break-words font-bold"
                    style={{
                      ...subtitlePreviewCss(previewVisualStyle.subtitle, previewCaption.text, previewScale),
                      fontSize: previewVisualStyle.subtitle.size * previewScale,
                      lineHeight: 1.2,
                    }}
                  >
                    {previewCaption.text}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="studio-clock-labels">
            <span>Preview 1×</span>
            <span title="Timestamp gốc, không phải thời gian sau khi nối đoạn">
              Mốc nguồn ·{" "}
              <strong className="font-mono">
                {formatSourceTimecode(
                  hasEditPlan
                    ? locateTimelineTime(playbackSegments, previewCurrentTime, PREVIEW_RATE).sourceTime
                    : previewCurrentTime,
                )}
              </strong>
            </span>
          </div>
          <div className="preview-controls w-full max-w-[520px]">
            <Button
              variant="icon"
              size="icon"
              type="button"
              aria-label="Tua lùi 5 giây"
              title="← · Lùi 5 giây"
              disabled={!previewVideoUrl}
              onClick={() => seekPreview(Math.max(0, previewClock.timeRef.current - 5))}
            >
              <ArrowLeft className="size-3" />
            </Button>
            <Button
              variant="icon"
              size="icon"
              tooltip={`${isPreviewPlaying ? UI_STRINGS.pausePreview : UI_STRINGS.playPreview} · Space`}
              type="button"
              onClick={() => void togglePreview()}
              disabled={!previewVideoUrl}
              aria-label={isPreviewPlaying ? UI_STRINGS.pausePreview : UI_STRINGS.playPreview}
            >
              {isPreviewPlaying ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="ml-0.5 size-4 fill-current" />
              )}
            </Button>
            <Button
              variant="icon"
              size="icon"
              type="button"
              aria-label="Tua tới 5 giây"
              title="→ · Tới 5 giây"
              disabled={!previewVideoUrl}
              onClick={() => seekPreview(Math.min(timelineDuration, previewClock.timeRef.current + 5))}
            >
              <ArrowRight className="size-3" />
            </Button>
            <span>{formatTime(previewCurrentTime)}</span>
            <input
              className="preview-seek"
              type="range"
              min={0}
              max={Math.max(timelineDuration, 0)}
              step={0.05}
              value={Math.min(previewCurrentTime, timelineDuration || 0)}
              onChange={(event) => seekPreview(Number(event.target.value))}
              disabled={!previewVideoUrl || timelineDuration <= 0}
              aria-label={hasEditPlan ? "Tua bản dựng Preview 1×" : "Tua nguồn 1×"}
            />
            <span>{formatTime(timelineDuration)}</span>
          </div>
          {previewError && (
            <p className="mt-2 max-w-[520px] text-center text-xs leading-5 text-red-300">{previewError}</p>
          )}
        </div>
        <div
          id="studio-teaser-review-host"
          ref={setReviewTarget}
          className="studio-teaser-review-host"
          hidden={!reviewVisible}
        />
      </div>
    </>
  );
}
