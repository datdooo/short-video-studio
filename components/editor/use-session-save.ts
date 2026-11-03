"use client";
import { type SaveState } from "@/components/studio-header";
import { type Controls, type EditorSession } from "@/lib/editor-session";
import { useEffect, useRef, useState } from "react";
export function useSessionSave() {
  const [sessionReady, setSessionReady] = useState(false);
  const draftWriteBlocked = useRef(false);
  const unsavedSession = useRef(false),
    manualSavePending = useRef(false);
  const savedSessionNeedsArchive = useRef(false);
  const pendingSaveBaseline = useRef<"saved" | "dirty" | "idle" | null>("idle");
  const [restoreBlocked, setRestoreBlocked] = useState(false);
  const [preservedDrafts, setPreservedDrafts] = useState<{ key: string; label: string }[]>([]);
  const [sessionNotice, setSessionNotice] = useState(""),
    [saveError, setSaveError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("restoring");
  useEffect(() => {
    if (sessionNotice !== "Đã khôi phục phiên chỉnh sửa") return;
    const timer = setTimeout(
      () => setSessionNotice((current) => (current === "Đã khôi phục phiên chỉnh sửa" ? "" : current)),
      4000,
    );
    return () => clearTimeout(timer);
  }, [sessionNotice]);
  const [interruptedTasks, setInterruptedTasks] = useState<string[]>([]);
  const [restorePassive, setRestorePassive] = useState(false),
    [musicIntent, setMusicIntent] = useState(false);
  const [retainedSourceId, setRetainedSourceId] = useState(""),
    [restoredJobId, setRestoredJobId] = useState("");
  const jobRestoreEpoch = useRef(0);
  const [sourceRestoreNotice, setSourceRestoreNotice] = useState(""),
    [sourceRestoreVersion, setSourceRestoreVersion] = useState(0);
  const [controls, setControls] = useState<Controls>({}),
    [draftActivities, setDraftActivities] = useState<Record<string, boolean>>({});
  const pendingPreviewRestore = useRef<number | null>(null),
    restoringSource = useRef(false);
  const hydrated = useRef(false),
    sessionEpoch = useRef(0);
  const latestSession = useRef<EditorSession | null>(null);
  const observedSession = useRef<Omit<EditorSession, "previewTime"> | null>(null);
  const lastWrittenSession = useRef<{ snapshot: Omit<EditorSession, "previewTime">; previewTime: number } | null>(null);
  return {
    sessionReady,
    setSessionReady,
    draftWriteBlocked,
    unsavedSession,
    manualSavePending,
    savedSessionNeedsArchive,
    pendingSaveBaseline,
    restoreBlocked,
    setRestoreBlocked,
    preservedDrafts,
    setPreservedDrafts,
    sessionNotice,
    setSessionNotice,
    saveError,
    setSaveError,
    saveState,
    setSaveState,
    interruptedTasks,
    setInterruptedTasks,
    restorePassive,
    setRestorePassive,
    musicIntent,
    setMusicIntent,
    retainedSourceId,
    setRetainedSourceId,
    restoredJobId,
    setRestoredJobId,
    jobRestoreEpoch,
    sourceRestoreNotice,
    setSourceRestoreNotice,
    sourceRestoreVersion,
    setSourceRestoreVersion,
    controls,
    setControls,
    draftActivities,
    setDraftActivities,
    pendingPreviewRestore,
    restoringSource,
    hydrated,
    sessionEpoch,
    latestSession,
    observedSession,
    lastWrittenSession,
  };
}
