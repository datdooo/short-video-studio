"use client";
import { type SourcePreparationProgress, type WorkerSource } from "@/lib/api/worker-client";
import { DEFAULT_REQUEST } from "@/lib/editor-defaults";
import { useEffect, useRef, useState } from "react";
export function useSourcePreparation() {
  const [sourceMode, setSourceMode] = useState<"youtube" | "local">("youtube");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState(DEFAULT_REQUEST.originalTitle);
  const [transcript, setTranscript] = useState("");
  const [transcriptStatus, setTranscriptStatus] = useState("");
  const transcriptRevision = useRef(0),
    transcriptEdited = useRef(false),
    transcriptRequest = useRef<AbortController | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState("");
  const [localFileName, setLocalFileName] = useState("");
  const [localDraftId, setLocalDraftId] = useState("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [youtubeState, setYoutubeState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [youtubeError, setYoutubeError] = useState("");
  const [isPreparingSource, setIsPreparingSource] = useState(false);
  const [sourcePreparationStartedAt, setSourcePreparationStartedAt] = useState(0);
  const [sourcePreparationProgress, setSourcePreparationProgress] = useState<SourcePreparationProgress | null>(null);
  const [preparedSource, setPreparedSource] = useState<WorkerSource | null>(null);
  const sourceSelectionEpoch = useRef(0);
  const [sourceRevision, setSourceRevision] = useState(0);
  const sourceRequests = useRef(new Set<AbortController>());
  const sourcePreparation = useRef<AbortController | null>(null);
  useEffect(() => {
    const requests = sourceRequests.current;
    return () => {
      for (const request of requests) request.abort();
      requests.clear();
    };
  }, []);
  const [sourceSize, setSourceSize] = useState({ width: 1920, height: 1080 });
  return {
    sourceMode,
    setSourceMode,
    sourceUrl,
    setSourceUrl,
    sourceTitle,
    setSourceTitle,
    transcript,
    setTranscript,
    transcriptStatus,
    setTranscriptStatus,
    transcriptRevision,
    transcriptEdited,
    transcriptRequest,
    localVideoUrl,
    setLocalVideoUrl,
    localFileName,
    setLocalFileName,
    localDraftId,
    setLocalDraftId,
    localFile,
    setLocalFile,
    youtubeState,
    setYoutubeState,
    youtubeError,
    setYoutubeError,
    isPreparingSource,
    setIsPreparingSource,
    sourcePreparationStartedAt,
    setSourcePreparationStartedAt,
    sourcePreparationProgress,
    setSourcePreparationProgress,
    preparedSource,
    setPreparedSource,
    sourceSelectionEpoch,
    sourceRevision,
    setSourceRevision,
    sourceRequests,
    sourcePreparation,
    sourceSize,
    setSourceSize,
  };
}
