import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef } from "react";
("use client");
type State = { saveSession: (onlyIfChanged?: boolean) => boolean; unsavedSession: RefObject<boolean> };
export function useSessionExitSave(state: State) {
  const { saveSession, unsavedSession } = state;
  const manualSaveAction = useRef(saveSession);
  useLayoutEffect(() => {
    manualSaveAction.current = saveSession;
  }, [saveSession]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.shiftKey ||
        (!event.metaKey && !event.ctrlKey) ||
        event.key.toLowerCase() !== "s"
      )
        return;
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229 || event.repeat) return;
      manualSaveAction.current();
    };
    // A close can dispatch all three events. A successful write coalesces
    // identical snapshots/playheads; playing frames never start a save timer.
    const hide = () => {
      if (document.visibilityState === "hidden") manualSaveAction.current(true);
    };
    const pageHide = () => {
      manualSaveAction.current(true);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      manualSaveAction.current(true);
      if (unsavedSession.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", pageHide);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", pageHide);
    };
  }, [unsavedSession]);
  return { manualSaveAction };
}
