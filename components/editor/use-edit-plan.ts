"use client";
import { useCutHistory } from "@/components/use-cut-history";
import { AiProvider, EditPlan, mockPlan } from "@/lib/edit-plan";
import { DEFAULT_REQUEST } from "@/lib/editor-defaults";
import { captureAiMainRanges } from "@/lib/main-ranges.mjs";
import { type SubtitleStyle } from "@/lib/subtitles.mjs";
import { resolvePlanVisualStyle, snapshotPlanVisualStyle } from "@/lib/visual-style/normalize.mjs";
import { useCallback, useMemo, useState } from "react";
export function useEditPlan() {
  const [editMode, setEditMode] = useState<"ai" | "manual">("ai");
  const [provider, setProvider] = useState<AiProvider>("chatgpt");
  const [hasEditPlan, setHasEditPlan] = useState(false);
  const [instruction, setInstruction] = useState(DEFAULT_REQUEST.instruction || "");
  const [supplementalPrompt, setSupplementalPrompt] = useState("");
  const [teaserDraftErrors, setTeaserDraftErrors] = useState<
    Record<number, { sourceKey: string; key: string; message: string }>
  >({});
  const [mainDraftErrors, setMainDraftErrors] = useState<
    Record<number, { sourceKey: string; key: string; invalid: boolean }>
  >({});
  const cutHistory = useCutHistory(() => mockPlan(DEFAULT_REQUEST));
  const { plan, setPlan, setCutPlan } = cutHistory;
  const subtitleSettings = useMemo(() => resolvePlanVisualStyle(plan).subtitle, [plan]);
  const setSubtitleSettings = useCallback(
    (update: SubtitleStyle | ((current: SubtitleStyle) => SubtitleStyle)) => {
      setPlan((current) => {
        const subtitle = resolvePlanVisualStyle(current).subtitle;
        const visualStyle = resolvePlanVisualStyle({
          ...current,
          subtitles: typeof update === "function" ? update(subtitle) : update,
        });
        return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
      });
    },
    [setPlan],
  );
  const replacePlan = useCallback(
    (next: EditPlan) => {
      setPlan((current) => {
        const style = resolvePlanVisualStyle(current);
        return snapshotPlanVisualStyle({
          ...captureAiMainRanges(next),
          music: current.music,
          musicSpeech: current.musicSpeech,
          visualStyle: style,
          subtitles: style.subtitle,
          hookTransition: current.hookTransition ?? next.hookTransition,
        });
      });
    },
    [setPlan],
  );
  return {
    editMode,
    setEditMode,
    provider,
    setProvider,
    hasEditPlan,
    setHasEditPlan,
    instruction,
    setInstruction,
    supplementalPrompt,
    setSupplementalPrompt,
    teaserDraftErrors,
    setTeaserDraftErrors,
    mainDraftErrors,
    setMainDraftErrors,
    cutHistory,
    plan,
    setPlan,
    setCutPlan,
    subtitleSettings,
    setSubtitleSettings,
    replacePlan,
  };
}
