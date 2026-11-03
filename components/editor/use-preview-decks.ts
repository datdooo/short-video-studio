"use client";
import type { Segment } from "@/lib/edit-plan";
import { createPreviewDecks } from "@/lib/preview-decks.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
type State = {
  activeDeckSlot: RefObject<number>;
  deckVideos: RefObject<(HTMLVideoElement | null)[]>;
  decks: RefObject<{
    clock: () => number;
    pause: () => void;
    play: () => Promise<void>;
    tick: () => void;
    seek: (seconds: number) => void;
    dispose: () => void;
  } | null>;
  hasEditPlan: boolean;
  musicPlaybackControl: RefObject<{ play: () => void; pause: () => void } | null>;
  partDuration: number;
  pendingPreviewRestore: RefObject<number | null>;
  playbackSegments: Segment[];
  previewEpoch: RefObject<number>;
  previewPlayingRef: RefObject<boolean>;
  previewSegmentIndex: RefObject<number>;
  previewTicker: RefObject<{ start: () => void; stop: () => void } | null>;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  previewVideoUrl: string;
  setIsPreviewPlaying: Dispatch<SetStateAction<boolean>>;
  setPreviewBuffering: Dispatch<SetStateAction<boolean>>;
  setPreviewCurrentTime: Dispatch<SetStateAction<number>>;
  setPreviewError: Dispatch<SetStateAction<string>>;
  setVisibleDeck: Dispatch<SetStateAction<number>>;
  workspaceRef: RefObject<"editor" | "batch" | "storage">;
};
export function usePreviewDecks(state: State) {
  const {
    activeDeckSlot: activeDeckSlotRef,
    deckVideos: deckVideosRef,
    decks: decksRef,
    hasEditPlan,
    musicPlaybackControl,
    partDuration,
    pendingPreviewRestore: pendingPreviewRestoreRef,
    playbackSegments,
    previewEpoch: previewEpochRef,
    previewPlayingRef,
    previewSegmentIndex: previewSegmentIndexRef,
    previewTicker: previewTickerRef,
    previewVideoRef,
    previewVideoUrl,
    setIsPreviewPlaying,
    setPreviewBuffering,
    setPreviewCurrentTime,
    setPreviewError,
    setVisibleDeck,
    workspaceRef,
  } = state;
  useEffect(() => {
    const a = deckVideosRef.current[0],
      b = deckVideosRef.current[1];
    if (!previewVideoUrl || !a || !b) return;
    const videos = [a, b],
      epoch = ++previewEpochRef.current;
    let active = true,
      frame = 0,
      ticking = false;
    const current = () => active && previewEpochRef.current === epoch;
    previewPlayingRef.current = false;
    musicPlaybackControl.current?.pause();
    if (!hasEditPlan) {
      activeDeckSlotRef.current = 0;
      previewVideoRef.current = a;
      a.muted = false;
      a.playbackRate = 1;
      if (a.getAttribute("src") !== previewVideoUrl) a.src = previewVideoUrl;
      b.pause();
      const restorePosition = () => {
        if (!current() || pendingPreviewRestoreRef.current === null) return;
        const position = Math.max(
          0,
          Math.min(
            pendingPreviewRestoreRef.current,
            Number.isFinite(a.duration) ? a.duration : pendingPreviewRestoreRef.current,
          ),
        );
        pendingPreviewRestoreRef.current = null;
        a.currentTime = position;
        setPreviewCurrentTime(position);
        a.pause();
      };
      a.addEventListener("loadedmetadata", restorePosition);
      if (a.readyState >= 1) restorePosition();
      queueMicrotask(() => {
        if (current()) {
          setVisibleDeck(0);
          setIsPreviewPlaying(false);
          setPreviewBuffering(false);
        }
      });
      return () => {
        active = false;
        a.removeEventListener("loadedmetadata", restorePosition);
        for (const video of videos) {
          video.pause();
          video.removeAttribute("src");
          video.load();
        }
      };
    }
    const controller = createPreviewDecks({
      videos,
      url: previewVideoUrl,
      segments: playbackSegments,
      onActive: (slot, index) => {
        if (!current()) return;
        activeDeckSlotRef.current = slot;
        previewVideoRef.current = videos[slot];
        previewSegmentIndexRef.current = index;
        setVisibleDeck(slot);
      },
      onClock: (seconds) => {
        if (current()) setPreviewCurrentTime(seconds);
      },
      onBuffer: (value) => {
        if (current()) setPreviewBuffering(value);
      },
      onError: (message) => {
        if (!current()) return;
        previewPlayingRef.current = false;
        setIsPreviewPlaying(false);
        musicPlaybackControl.current?.pause();
        setPreviewError(message);
      },
      onEnded: () => {
        if (!current()) return;
        previewPlayingRef.current = false;
        setIsPreviewPlaying(false);
        musicPlaybackControl.current?.pause();
      },
    });
    decksRef.current = controller;
    if (pendingPreviewRestoreRef.current !== null) {
      const position = Math.max(0, Math.min(pendingPreviewRestoreRef.current, partDuration));
      pendingPreviewRestoreRef.current = null;
      controller.seek(position);
      controller.pause();
    }
    const tick = () => {
      if (!current() || !ticking) return;
      controller.tick();
      if (current() && ticking) frame = requestAnimationFrame(tick);
    };
    const ticker = {
      start: () => {
        cancelAnimationFrame(frame);
        ticking = current() && workspaceRef.current === "editor" && previewPlayingRef.current;
        if (ticking) frame = requestAnimationFrame(tick);
      },
      stop: () => {
        ticking = false;
        cancelAnimationFrame(frame);
      },
    };
    previewTickerRef.current = ticker;
    queueMicrotask(() => {
      if (current()) {
        setIsPreviewPlaying(false);
        setPreviewBuffering(false);
      }
    });
    return () => {
      active = false;
      ticker.stop();
      if (previewTickerRef.current === ticker) previewTickerRef.current = null;
      controller.dispose();
      if (decksRef.current === controller) decksRef.current = null;
    };
  }, [
    hasEditPlan,
    playbackSegments,
    previewVideoUrl,
    partDuration,
    activeDeckSlotRef,
    deckVideosRef,
    decksRef,
    musicPlaybackControl,
    pendingPreviewRestoreRef,
    previewEpochRef,
    previewPlayingRef,
    previewSegmentIndexRef,
    previewTickerRef,
    previewVideoRef,
    setIsPreviewPlaying,
    setPreviewBuffering,
    setPreviewCurrentTime,
    setPreviewError,
    setVisibleDeck,
  ]);
  return {};
}
