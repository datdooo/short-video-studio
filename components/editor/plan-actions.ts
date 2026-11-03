"use client";
import { type WorkerSource } from "@/lib/api/worker-client";
import type { EditPlan } from "@/lib/edit-plan";
import { manualPlan } from "@/lib/edit-plan";
import { captureAiMainRanges } from "@/lib/main-ranges.mjs";
import { resolvePlanVisualStyle, snapshotPlanVisualStyle } from "@/lib/visual-style/normalize.mjs";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
type State = {
  activePartIndex: number;
  hasEditPlan: boolean;
  invalidateAnalysis: () => void;
  manualPart1Ranges: string;
  manualPart1Title: string;
  manualPart2Ranges: string;
  manualPart2Title: string;
  preparedSource: WorkerSource | null;
  replacePlan: (next: EditPlan) => void;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setCutPlan: (update: SetStateAction<EditPlan>, label: string, group?: string) => void;
  setError: Dispatch<SetStateAction<string>>;
  setHasEditPlan: Dispatch<SetStateAction<boolean>>;
  setPlan: (update: SetStateAction<EditPlan>) => void;
  sourceTitle: string;
};
/** Pure action factory. State is read only when an action is invoked, after render. */
export function createPlanActions(read: () => State) {
  function applyManualPlan() {
    const {
      hasEditPlan,
      manualPart1Ranges,
      manualPart1Title,
      manualPart2Ranges,
      manualPart2Title,
      preparedSource,
      replacePlan,
      setActivePartIndex,
      setCutPlan,
      setError,
      setHasEditPlan,
      sourceTitle,
    } = read();

    setError("");
    try {
      const nextPlan = manualPlan({
        language: preparedSource?.language,
        originalTitle: sourceTitle,
        part1Title: manualPart1Title,
        part1Ranges: manualPart1Ranges,
        part2Title: manualPart2Title,
        part2Ranges: manualPart2Ranges,
      });
      if (hasEditPlan) {
        setCutPlan((current) => {
          const style = resolvePlanVisualStyle(current);
          return snapshotPlanVisualStyle({
            ...captureAiMainRanges(nextPlan),
            music: current.music,
            musicSpeech: current.musicSpeech,
            visualStyle: style,
            subtitles: style.subtitle,
            hookTransition: current.hookTransition ?? nextPlan.hookTransition,
          });
        }, "Áp dụng Manual cut");
      } else replacePlan(nextPlan);
      setHasEditPlan(true);
      setActivePartIndex(0);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Timestamp không hợp lệ.");
    }
  }
  function updatePartTitle(title: string) {
    const { activePartIndex, invalidateAnalysis, setPlan } = read();

    invalidateAnalysis();
    setPlan((current) => ({
      ...current,
      parts: current.parts.map((part, index) => (index === activePartIndex ? { ...part, title } : part)),
    }));
  }
  return { applyManualPlan, updatePartTitle };
}

/** Event handlers read the latest committed reader, never refs during render. */
export function usePlanActions(read: () => State) {
  const readerRef = useRef(read);
  useLayoutEffect(() => {
    readerRef.current = read;
  }, [read]);
  const applyManualPlan = useCallback(
    (...args: Parameters<ReturnType<typeof createPlanActions>["applyManualPlan"]>) =>
      createPlanActions(readerRef.current).applyManualPlan(...args),
    [],
  );
  const updatePartTitle = useCallback(
    (...args: Parameters<ReturnType<typeof createPlanActions>["updatePartTitle"]>) =>
      createPlanActions(readerRef.current).updatePartTitle(...args),
    [],
  );
  return useMemo(() => ({ applyManualPlan, updatePartTitle }), [applyManualPlan, updatePartTitle]);
}
