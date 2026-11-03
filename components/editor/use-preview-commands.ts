"use client";
import type { Segment } from "@/lib/edit-plan";
import { PREVIEW_RATE } from "@/lib/preview-config.mjs";
import { locateTimelineTime, timelineTimeForSegment } from "@/lib/preview-timeline.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect } from "react";
type State = {
  decks: RefObject<{
    clock: () => number;
    pause: () => void;
    play: () => Promise<void>;
    tick: () => void;
    seek: (seconds: number) => void;
    dispose: () => void;
  } | null>;
  hasEditPlan: boolean;
  markPreviewPositionDirty: () => void;
  musicPlaybackControl: RefObject<{ play: () => void; pause: () => void } | null>;
  playbackIntentEpoch: RefObject<number>;
  playbackSegments: Segment[];
  previewCurrentTime: number;
  previewEpoch: RefObject<number>;
  previewPlayingRef: RefObject<boolean>;
  previewSegmentIndex: RefObject<number>;
  previewSourceEpoch: number;
  previewTicker: RefObject<{ start: () => void; stop: () => void } | null>;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  previewVideoUrl: string;
  setIsPreviewPlaying: Dispatch<SetStateAction<boolean>>;
  setMusicIntent: Dispatch<SetStateAction<boolean>>;
  setPreviewCurrentTime: Dispatch<SetStateAction<number>>;
  setPreviewError: Dispatch<SetStateAction<string>>;
  sourceSelectionEpoch: RefObject<number>;
  stopTeaserAuditions: (except?: number) => void;
  stopWorkspacePlayback: (exceptTeaser?: number) => void;
  timelineDuration: number;
  workspace: "editor" | "batch" | "storage";
  workspaceRef: RefObject<"editor" | "batch" | "storage">;
};
export function usePreviewCommands(state: State) {
  const {
    decks: decksRef,
    hasEditPlan,
    markPreviewPositionDirty,
    musicPlaybackControl,
    playbackIntentEpoch: playbackIntentEpochRef,
    playbackSegments,
    previewCurrentTime,
    previewEpoch,
    previewPlayingRef,
    previewSegmentIndex: previewSegmentIndexRef,
    previewSourceEpoch,
    previewTicker,
    previewVideoRef,
    previewVideoUrl,
    setIsPreviewPlaying,
    setMusicIntent,
    setPreviewCurrentTime,
    setPreviewError,
    sourceSelectionEpoch,
    stopTeaserAuditions,
    stopWorkspacePlayback,
    timelineDuration,
    workspace,
    workspaceRef,
  } = state;
  async function togglePreview() {
    if (workspaceRef.current !== "editor" || previewSourceEpoch !== sourceSelectionEpoch.current) return;
    const video = previewVideoRef.current;
    if (!video || !previewVideoUrl) return;
    stopTeaserAuditions();
    setMusicIntent(true);
    const epoch = previewEpoch.current,
      intent = ++playbackIntentEpochRef.current,
      controller = decksRef.current;
    setPreviewError("");
    if (!previewPlayingRef.current) {
      try {
        if (hasEditPlan && !decksRef.current) {
          const last = playbackSegments.at(-1);
          if (
            last &&
            previewSegmentIndexRef.current === playbackSegments.length - 1 &&
            video.currentTime >= last.end - 0.05
          ) {
            previewSegmentIndexRef.current = 0;
            video.currentTime = playbackSegments[0].start;
          }
          video.playbackRate = PREVIEW_RATE;
        }
        previewPlayingRef.current = true;
        setIsPreviewPlaying(true);
        previewTicker.current?.start();
        musicPlaybackControl.current?.play();
        if (controller) await controller.play();
        else await video.play();
        if (
          workspaceRef.current !== "editor" ||
          (!previewPlayingRef.current && intent !== playbackIntentEpochRef.current)
        )
          video.pause();
      } catch {
        if (
          intent !== playbackIntentEpochRef.current ||
          workspaceRef.current !== "editor" ||
          epoch !== previewEpoch.current ||
          previewVideoRef.current !== video
        )
          return;
        musicPlaybackControl.current?.pause();
        previewPlayingRef.current = false;
        setIsPreviewPlaying(false);
        setPreviewError("Trình duyệt chưa phát được video source này.");
      }
    } else {
      stopWorkspacePlayback();
    }
  }
  const seekPreview = useCallback(
    (value: number) => {
      const video = previewVideoRef.current;
      if (!video || !Number.isFinite(value)) return;
      stopTeaserAuditions();
      markPreviewPositionDirty();
      if (decksRef.current) {
        decksRef.current.seek(value);
        return;
      }
      let sourceTime = value;
      if (hasEditPlan) {
        const position = locateTimelineTime(playbackSegments, value);
        previewSegmentIndexRef.current = position.index;
        sourceTime = position.sourceTime;
        if (workspaceRef.current === "editor" && previewPlayingRef.current) {
          const epoch = previewEpoch.current,
            intent = playbackIntentEpochRef.current;
          void video
            .play()
            .then(() => {
              if (
                workspaceRef.current !== "editor" ||
                (!previewPlayingRef.current && intent !== playbackIntentEpochRef.current)
              )
                video.pause();
            })
            .catch(() => {
              if (
                workspaceRef.current === "editor" &&
                intent === playbackIntentEpochRef.current &&
                epoch === previewEpoch.current
              )
                setPreviewError("Bấm Play để tiếp tục sau khi tua.");
            });
        }
      }
      video.currentTime = sourceTime;
      setPreviewCurrentTime(value);
    },
    [
      hasEditPlan,
      playbackSegments,
      stopTeaserAuditions,
      markPreviewPositionDirty,
      decksRef,
      playbackIntentEpochRef,
      previewEpoch,
      previewPlayingRef,
      previewSegmentIndexRef,
      previewVideoRef,
      setPreviewCurrentTime,
      setPreviewError,
    ],
  );
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.defaultPrevented || event.isComposing) return;
      if (event.code === "Space" || event.key === " ") {
        const seek = target instanceof HTMLInputElement && target.classList.contains("preview-seek");
        const editing =
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest(
              'input, textarea, select, button, a, summary, [role="textbox"], [role="combobox"], [role="dialog"], [role="menu"], .studio-teaser-review',
            ));
        if (
          workspace !== "editor" ||
          !previewVideoUrl ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          (!seek && editing)
        )
          return;
        event.preventDefault();
        if (!event.repeat) void togglePreview();
        return;
      }
      if (
        workspace !== "editor" ||
        !previewVideoUrl ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest('input, textarea, select, [role="textbox"], [role="combobox"], .studio-teaser-review')))
      )
        return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      seekPreview(Math.max(0, Math.min(timelineDuration, previewCurrentTime + (event.key === "ArrowRight" ? 5 : -5))));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [workspace, previewVideoUrl, timelineDuration, previewCurrentTime, seekPreview, togglePreview]);
  function updatePreviewClock() {
    const video = previewVideoRef.current;
    if (!video) return;
    let timelineTime = video.currentTime;
    if (hasEditPlan) {
      timelineTime =
        decksRef.current?.clock() ??
        timelineTimeForSegment(playbackSegments, previewSegmentIndexRef.current, video.currentTime);
    }
    setPreviewCurrentTime(timelineTime);
  }
  return { togglePreview, seekPreview, updatePreviewClock };
}
