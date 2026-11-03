"use client";
import { type WorkerSource } from "@/lib/api/worker-client";
import type { AiProvider, EditPlan } from "@/lib/edit-plan";
import type { Caption } from "@/lib/subtitles.mjs";
import { assertTeaserContexts } from "@/lib/teaser-context.mjs";
import { teaserReadiness } from "@/lib/teaser-hooks.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
type State = {
  sourceRevision: number;
  activeAnalysis: RefObject<AbortController | null>;
  activeTeaserRequests: RefObject<Map<number, { controller: AbortController; identity: string }>>;
  hasEditPlan: boolean;
  instruction: string;
  invalidateAnalysis: () => void;
  mainSignature: string;
  preparedSource: WorkerSource | null;
  previewDuration: number;
  previewPlan: EditPlan;
  provider: AiProvider;
  setAnalysisNotice: Dispatch<SetStateAction<string>>;
  sourceSelectionEpoch: RefObject<number>;
  subtitleCues: Caption[];
  supplementalPrompt: string;
  transcript: string;
};
export function useAnalysisContext(state: State) {
  const {
    activeAnalysis,
    activeTeaserRequests,
    hasEditPlan,
    instruction,
    invalidateAnalysis,
    mainSignature,
    preparedSource,
    previewDuration,
    previewPlan,
    provider,
    setAnalysisNotice,
    subtitleCues,
    supplementalPrompt,
    transcript,
    sourceRevision,
  } = state;
  const basicTeaserIssues = useMemo(
    () =>
      teaserReadiness(
        { parts: previewPlan.parts },
        preparedSource?.duration || previewDuration || Infinity,
        previewPlan.captionCues?.cues || subtitleCues,
        preparedSource?.id,
      ),
    [
      previewPlan.parts,
      preparedSource?.duration,
      preparedSource?.id,
      previewDuration,
      previewPlan.captionCues?.cues,
      subtitleCues,
    ],
  );
  const [freshnessState, setFreshnessState] = useState<{ key: string; issues: { partId: number; reason: string }[] }>({
    key: "",
    issues: [],
  });
  const freshnessKey = JSON.stringify({
    source: preparedSource
      ? { id: preparedSource.id, duration: preparedSource.duration, title: preparedSource.title }
      : null,
    parts: previewPlan.parts,
    cues: subtitleCues,
    transcript: transcript || preparedSource?.transcript || "",
    instruction,
    supplementalPrompt,
  });
  useEffect(() => {
    if (!preparedSource || !hasEditPlan) return;
    let current = true;
    const source = preparedSource,
      content = transcript || source.transcript || "",
      plan = previewPlan,
      cues = subtitleCues;
    void Promise.all(
      plan.parts
        .filter(
          (p) =>
            p.teaserEnabled !== false &&
            p.teaser?.status === "selected" &&
            ["ai", "external-import"].includes(p.teaser.selection),
        )
        .map(async (part) => {
          try {
            await assertTeaserContexts(
              { ...plan, parts: plan.parts.map((p) => (p.id === part.id ? p : { ...p, teaserEnabled: false })) },
              source,
              cues,
              content,
              { instruction, supplementalPrompt },
            );
            return null;
          } catch (e) {
            return { partId: part.id, reason: e instanceof Error ? e.message : "Teaser AI đã cũ; cần chọn lại." };
          }
        }),
    ).then((values) => {
      if (current)
        setFreshnessState({
          key: freshnessKey,
          issues: values.filter((v): v is { partId: number; reason: string } => v !== null),
        });
    });
    return () => {
      current = false;
    };
    // Serialized content identity excludes visual style/music and raw custom draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshnessKey, hasEditPlan]);
  const teaserIssues = [
    ...basicTeaserIssues,
    ...(freshnessState.key === freshnessKey
      ? freshnessState.issues.filter((i) => !basicTeaserIssues.some((b) => b.partId === i.partId))
      : []),
  ];
  const latestMainSignature = useRef(mainSignature);
  useEffect(() => {
    latestMainSignature.current = mainSignature;
  }, [mainSignature]);
  const hookIdentity = JSON.stringify({
    sourceId: preparedSource?.id,
    provider,
    transcript,
    instruction,
    supplementalPrompt,
    mainSignature,
  });
  const webFlowRevision = JSON.stringify([sourceRevision, hookIdentity]);
  const currentWebRevision = useRef(webFlowRevision);
  useLayoutEffect(() => {
    currentWebRevision.current = webFlowRevision;
  }, [webFlowRevision]);
  const latestHookIdentity = useRef(hookIdentity);
  useEffect(() => {
    latestHookIdentity.current = hookIdentity;
  }, [hookIdentity]);
  const partHookIdentities = Object.fromEntries(
    previewPlan.parts.map((part) => [
      part.id,
      JSON.stringify({
        sourceId: preparedSource?.id,
        provider,
        transcript,
        instruction,
        supplementalPrompt,
        title: previewPlan.originalTitle,
        part: {
          id: part.id,
          title: part.title,
          hook: part.hook,
          segments: part.segments,
          teaserEnabled: part.teaserEnabled,
        },
        cues: subtitleCues,
      }),
    ]),
  );
  const latestPartHookIdentities = useRef(partHookIdentities);
  useLayoutEffect(() => {
    latestPartHookIdentities.current = partHookIdentities;
  }, [partHookIdentities]);
  const partHookIdentityKey = JSON.stringify(partHookIdentities);
  const priorAnalysisInput = useRef(hookIdentity);
  useEffect(() => {
    if (priorAnalysisInput.current !== hookIdentity && activeAnalysis.current) {
      invalidateAnalysis();
      setAnalysisNotice("Dữ liệu phân tích đã đổi; đã dừng lượt cũ.");
    }
    priorAnalysisInput.current = hookIdentity;
    for (const [id, request] of activeTeaserRequests.current)
      if (request.identity !== latestPartHookIdentities.current[id])
        request.controller.abort(new Error("Nguồn, main hoặc yêu cầu đã đổi; đã dừng lượt teaser cũ."));
  }, [hookIdentity, partHookIdentityKey, activeAnalysis, activeTeaserRequests, invalidateAnalysis, setAnalysisNotice]);
  return {
    basicTeaserIssues,
    freshnessState,
    setFreshnessState,
    freshnessKey,
    teaserIssues,
    latestMainSignature,
    hookIdentity,
    webFlowRevision,
    currentWebRevision,
    latestHookIdentity,
    partHookIdentities,
    latestPartHookIdentities,
    partHookIdentityKey,
    priorAnalysisInput,
  };
}
