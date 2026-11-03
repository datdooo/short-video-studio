"use client";
import { useEditPlan } from "@/components/editor/use-edit-plan";
import { type AiDiagnostics } from "@/lib/ai-progress";
import { type RenderJob, type WorkerSource } from "@/lib/api/worker-client";
import type { AiProvider } from "@/lib/edit-plan";
import { EditPlan } from "@/lib/edit-plan";
import type { Controls } from "@/lib/editor-session";
import type { Caption } from "@/lib/subtitles.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
type State = {
  sourceRevision: number;
  cutHistory: ReturnType<typeof useEditPlan>["cutHistory"];
  draftActivities: Record<string, boolean>;
  draftError: string;
  hasEditPlan: boolean;
  instruction: string;
  invalidateAnalysis: () => void;
  isAnalyzing: boolean;
  plan: EditPlan;
  preparedSource: WorkerSource | null;
  provider: AiProvider;
  sessionScope: string;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setControls: Dispatch<SetStateAction<Controls>>;
  setMainDraftErrors: Dispatch<SetStateAction<Record<number, { sourceKey: string; key: string; invalid: boolean }>>>;
  setRenderJob: Dispatch<SetStateAction<RenderJob | null>>;
  setTeaserDraftErrors: Dispatch<SetStateAction<Record<number, { sourceKey: string; key: string; message: string }>>>;
  sourceSelectionEpoch: RefObject<number>;
  stopWorkspacePlayback: (exceptTeaser?: number) => void;
  subtitleCues: Caption[];
  supplementalPrompt: string;
  teaserDraftError: string;
  teaserOperations: Record<
    number,
    {
      diagnostics: AiDiagnostics | null;
      startedAt: number;
      running: boolean;
      finishedAt?: number;
      finishedStage?: "complete" | "error" | "cancelled";
    }
  >;
  transcript: string;
  workspace: "editor" | "batch" | "storage";
  workspaceRef: RefObject<"editor" | "batch" | "storage">;
};
export function useCutHistoryControls(state: State) {
  const {
    cutHistory,
    draftActivities,
    draftError,
    hasEditPlan,
    instruction,
    invalidateAnalysis,
    isAnalyzing,
    plan,
    preparedSource,
    provider,
    sessionScope,
    setActivePartIndex,
    setControls,
    setMainDraftErrors,
    setRenderJob,
    setTeaserDraftErrors,
    stopWorkspacePlayback,
    subtitleCues,
    supplementalPrompt,
    teaserDraftError,
    teaserOperations,
    transcript,
    workspace,
    workspaceRef,
    sourceRevision,
  } = state;
  const cutHistoryScope = useMemo(
    () =>
      JSON.stringify([
        preparedSource?.id,
        preparedSource?.duration,
        sourceRevision,
        subtitleCues,
        transcript,
        instruction,
        supplementalPrompt,
        provider,
      ]),
    [
      preparedSource?.id,
      preparedSource?.duration,
      subtitleCues,
      transcript,
      instruction,
      supplementalPrompt,
      provider,
      sourceRevision,
    ],
  );
  const cutHistoryTravelRevision = useRef(0);
  const { contextScope, setContext } = cutHistory;
  useLayoutEffect(() => {
    setContext(cutHistoryScope);
  }, [cutHistoryScope, setContext]);
  const cutHistoryBlocked =
    workspace !== "editor" ||
    !hasEditPlan ||
    !preparedSource ||
    Boolean(draftError || teaserDraftError) ||
    isAnalyzing ||
    Object.entries(draftActivities).some(([key, busy]) => busy && key.startsWith("teaser Part ")) ||
    Object.values(teaserOperations).some((op) => op.running) ||
    contextScope !== cutHistoryScope;
  function travelCutHistory(direction: "undo" | "redo") {
    const entry = direction === "undo" ? cutHistory.previous : cutHistory.next;
    if (cutHistoryBlocked || !entry) return;
    cutHistoryTravelRevision.current++;
    stopWorkspacePlayback();
    invalidateAnalysis();
    setRenderJob(null);
    // Applied-only history: invalid/pending drafts block travel. Clear only
    // projected timing drafts of affected parts, never unrelated input text.
    const suffixes = entry.partIds.flatMap((id) => [`main-${id}`, `teaser-times-${id}`, `teaser-candidate-${id}`]);
    setControls((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !suffixes.some((suffix) => key === `${sessionScope}:${suffix}`)),
      ),
    );
    setMainDraftErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => !entry.partIds.includes(Number(id)))),
    );
    setTeaserDraftErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => !entry.partIds.includes(Number(id)))),
    );
    if (entry.partIds.length)
      setActivePartIndex(
        Math.max(
          0,
          plan.parts.findIndex((p) => p.id === entry.partIds[0]),
        ),
      );
    if (direction === "undo") cutHistory.undo();
    else cutHistory.redo();
  }
  const cutHistoryAction = useRef(travelCutHistory);
  useLayoutEffect(() => {
    cutHistoryAction.current = travelCutHistory;
  }, [travelCutHistory]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.altKey ||
        (!event.metaKey && !event.ctrlKey) ||
        workspaceRef.current !== "editor"
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input,textarea,select,[role="textbox"],[role="combobox"],[role="dialog"],[role="menu"]'))
      )
        return;
      const key = event.key.toLowerCase();
      const direction =
        key === "z"
          ? event.shiftKey
            ? "redo"
            : "undo"
          : event.ctrlKey && !event.metaKey && key === "y"
            ? "redo"
            : null;
      if (!direction) return;
      event.preventDefault();
      cutHistoryAction.current(direction);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [workspaceRef]);
  return {
    cutHistoryScope,

    cutHistoryTravelRevision,
    cutHistoryBlocked,
    travelCutHistory,
    cutHistoryAction,
  };
}
