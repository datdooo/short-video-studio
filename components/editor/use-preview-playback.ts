"use client";
import { createPreviewDecks } from "@/lib/preview-decks.mjs";
import { useCallback, useEffect, useRef, useState } from "react";
export function usePreviewPlayback() {
  const previewEpoch = useRef(0);
  const playbackIntentEpoch = useRef(0);
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(null);
  const [reviewTarget, setReviewTarget] = useState<HTMLDivElement | null>(null);
  const [previewStage, setPreviewStage] = useState<HTMLDivElement | null>(null);
  const [reviewCompact, setReviewCompact] = useState(true);
  useEffect(() => {
    if (!previewStage) return;
    const update = () => setReviewCompact(previewStage.clientWidth < 680);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(previewStage);
    return () => observer.disconnect();
  }, [previewStage]);
  const [previewWidth, setPreviewWidth] = useState(384);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const batchPreviewRef = useRef<HTMLVideoElement>(null);
  const teaserAuditions = useRef(new Map<number, () => void>());
  const registerTeaserAudition = useCallback((id: number, stop: (() => void) | null) => {
    if (stop) teaserAuditions.current.set(id, stop);
    else teaserAuditions.current.delete(id);
  }, []);
  const stopTeaserAuditions = useCallback((except?: number) => {
    for (const [id, stop] of teaserAuditions.current) if (id !== except) stop();
  }, []);
  const previewTicker = useRef<{ start: () => void; stop: () => void } | null>(null);
  const previewSegmentIndex = useRef(0);
  const deckVideos = useRef<(HTMLVideoElement | null)[]>([null, null]);
  const activeDeckSlot = useRef(0);
  const [visibleDeck, setVisibleDeck] = useState(0),
    [previewBuffering, setPreviewBuffering] = useState(false);
  const decks = useRef<ReturnType<typeof createPreviewDecks> | null>(null);
  const bindDeckA = useCallback((v: HTMLVideoElement | null) => {
    deckVideos.current[0] = v;
    if (activeDeckSlot.current === 0) previewVideoRef.current = v;
  }, []);
  const bindDeckB = useCallback((v: HTMLVideoElement | null) => {
    deckVideos.current[1] = v;
    if (v) v.muted = true;
    if (activeDeckSlot.current === 1) previewVideoRef.current = v;
  }, []);
  const previewPlayingRef = useRef(false);
  const musicPlaybackControl = useRef<{ play: () => void; pause: () => void } | null>(null);
  const registerMusicPlayback = useCallback((handle: { play: () => void; pause: () => void } | null) => {
    musicPlaybackControl.current = handle;
  }, []);
  function stopWorkspacePlayback(exceptTeaser?: number) {
    playbackIntentEpoch.current++;
    stopTeaserAuditions(exceptTeaser);
    previewPlayingRef.current = false;
    setIsPreviewPlaying(false);
    decks.current?.pause();
    previewTicker.current?.stop();
    for (const video of deckVideos.current) video?.pause();
    previewVideoRef.current?.pause();
    batchPreviewRef.current?.pause();
    musicPlaybackControl.current?.pause();
  }
  useEffect(() => {
    if (!previewElement) return;
    const updateWidth = () => {
      const width = previewElement.clientWidth;
      if (width > 0) setPreviewWidth(width);
    };
    updateWidth();
    const frame = window.requestAnimationFrame(updateWidth);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(previewElement);
    window.addEventListener("resize", updateWidth);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateWidth);
      observer.disconnect();
    };
  }, [previewElement]);
  return {
    previewEpoch,
    playbackIntentEpoch,
    previewElement,
    setPreviewElement,
    reviewTarget,
    setReviewTarget,
    previewStage,
    setPreviewStage,
    reviewCompact,
    setReviewCompact,
    previewWidth,
    setPreviewWidth,
    previewDuration,
    setPreviewDuration,
    previewCurrentTime,
    setPreviewCurrentTime,
    isPreviewPlaying,
    setIsPreviewPlaying,
    previewError,
    setPreviewError,
    previewVideoRef,
    batchPreviewRef,
    teaserAuditions,
    registerTeaserAudition,
    stopTeaserAuditions,
    previewTicker,
    previewSegmentIndex,
    deckVideos,
    activeDeckSlot,
    visibleDeck,
    setVisibleDeck,
    previewBuffering,
    setPreviewBuffering,
    decks,
    bindDeckA,
    bindDeckB,
    previewPlayingRef,
    musicPlaybackControl,
    registerMusicPlayback,
    stopWorkspacePlayback,
  };
}
