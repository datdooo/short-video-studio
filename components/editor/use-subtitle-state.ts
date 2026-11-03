"use client";
import { type CaptionTrack } from "@/lib/subtitles.mjs";
import { useRef, useState } from "react";
export function useSubtitleState() {
  const [sourceCaptions, setSourceCaptions] = useState<CaptionTrack | null>(null);
  const subtitleRequestSerial = useRef(0);
  const subtitleController = useRef<AbortController | null>(null);
  const [subtitleStartedAt, setSubtitleStartedAt] = useState(0);
  const subtitleSourceRef = useRef<string | undefined>(undefined);
  const subtitleAutoKey = useRef("");
  const [subtitleBusy, setSubtitleBusy] = useState(false);
  const [subtitleNotice, setSubtitleNotice] = useState("");
  const [speechModel, setSpeechModel] = useState<{
    modelReady: boolean;
    installing: boolean;
    model?: string;
    backend?: string;
    modelId?: string;
    downloadedBytes?: number;
    totalBytes?: number;
  } | null>(null);
  return {
    sourceCaptions,
    setSourceCaptions,
    subtitleRequestSerial,
    subtitleController,
    subtitleStartedAt,
    setSubtitleStartedAt,
    subtitleSourceRef,
    subtitleAutoKey,
    subtitleBusy,
    setSubtitleBusy,
    subtitleNotice,
    setSubtitleNotice,
    speechModel,
    setSpeechModel,
  };
}
