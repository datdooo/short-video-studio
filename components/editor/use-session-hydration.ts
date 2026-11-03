"use client";
import type { SaveState } from "@/components/studio-header";
import type { EditorSession } from "@/lib/editor-session";
import { listPreservedEditorSessions, managedId, readEditorSession } from "@/lib/editor-session";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
type State = {
  draftWriteBlocked: RefObject<boolean>;
  hydrated: RefObject<boolean>;
  restoreEditorDraft: (
    d: Partial<EditorSession>,
    nextWorkspace?: "editor" | "batch" | "storage",
    savedBaseline?: boolean,
  ) => void;
  setBatchId: Dispatch<SetStateAction<string>>;
  setPreservedDrafts: Dispatch<SetStateAction<{ key: string; label: string }[]>>;
  setRestoreBlocked: Dispatch<SetStateAction<boolean>>;
  setRestorePassive: Dispatch<SetStateAction<boolean>>;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
  setSessionNotice: Dispatch<SetStateAction<string>>;
  setSessionReady: Dispatch<SetStateAction<boolean>>;
};
export function useSessionHydration(state: State) {
  const {
    draftWriteBlocked: draftWriteBlockedRef,
    hydrated: hydratedRef,
    restoreEditorDraft,
    setBatchId,
    setPreservedDrafts,
    setRestoreBlocked,
    setRestorePassive,
    setSaveState,
    setSessionNotice,
    setSessionReady,
  } = state;
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const result = readEditorSession(),
      d = result.draft;
    draftWriteBlockedRef.current = !!result.blocked;
    setRestoreBlocked(!!result.blocked);
    setPreservedDrafts(listPreservedEditorSessions());
    if (result.notice) setSessionNotice(result.notice);
    if (d) {
      restoreEditorDraft(d, d.workspace || "editor", true);
    } else if (!result.blocked) {
      try {
        setBatchId(managedId(localStorage.getItem("shortcut-beta-batch-id")));
        setRestorePassive(true);
      } catch {
        /* Storage is optional. */
      }
    }
    setSaveState(result.blocked ? "error" : d ? "saved" : "idle");
    setSessionReady(true);
  }, [
    draftWriteBlockedRef,
    hydratedRef,
    setBatchId,
    setPreservedDrafts,
    setRestoreBlocked,
    setRestorePassive,
    setSaveState,
    setSessionNotice,
    setSessionReady,
  ]);
  return {};
}
