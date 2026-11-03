"use client";
import { Button } from "@/components/ui/button";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import { AiOperationStatus } from "@/components/ai-operation-status";
import { MainRangesEditor } from "@/components/main-ranges-editor";
import { TeaserEditor } from "@/components/teaser-editor";
import { useCutHistory } from "@/components/use-cut-history";
import { type AiDiagnostics } from "@/lib/ai-progress";
import { WORKER_ORIGIN, type RenderJob, type WorkerSource } from "@/lib/api/worker-client";
import type { EditPart } from "@/lib/edit-plan";
import { AiProvider, EditPlan } from "@/lib/edit-plan";
import type { MainRangeRow } from "@/lib/main-ranges.mjs";
import { applyMainRanges, restoreAiMainRanges } from "@/lib/main-ranges.mjs";
import { PREVIEW_RATE } from "@/lib/preview-config.mjs";
import { timelineTimeForSegment } from "@/lib/preview-timeline.mjs";
import type { Caption } from "@/lib/subtitles.mjs";
import { sourceCaptionTrack, type CaptionTrack } from "@/lib/subtitles.mjs";
import { assertTeaserContexts } from "@/lib/teaser-context.mjs";
import { TEASER_POLICY, hookRangeKey, presentationSegments, validateTeaser } from "@/lib/teaser-hooks.mjs";
import { externalHooksCurrent } from "@/lib/teaser-import.mjs";
import { effectiveCutPlan } from "@/worker/part-start.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";

type Props = {
  activePart: EditPart;
  activePartIndex: number;
  activeTeaserRequests: RefObject<Map<number, { controller: AbortController; identity: string }>>;
  cutHistory: ReturnType<typeof useCutHistory>;
  cutHistoryBlocked: boolean;
  cutHistoryTravelRevision: RefObject<number>;
  decks: RefObject<{
    clock: () => number;
    pause: () => void;
    play: () => Promise<void>;
    tick: () => void;
    seek: (seconds: number) => void;
    dispose: () => void;
  } | null>;
  hasEditPlan: boolean;
  instruction: string;
  invalidateAnalysis: () => void;
  isAnalyzing: boolean;
  latestPartHookIdentities: RefObject<{ [k: string]: string }>;
  mainEditorSourceKey: string;
  musicPlaybackControl: RefObject<{ play: () => void; pause: () => void } | null>;
  preparedSource: WorkerSource | null;
  previewDuration: number;
  previewPlan: EditPlan;
  previewPlayingRef: RefObject<boolean>;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  previewVideoUrl: string;
  provider: AiProvider;
  registerTeaserAudition: (id: number, stop: (() => void) | null) => void;
  resolveCustomTeaser: (
    partId: number,
    input: string,
    signal: AbortSignal,
    previousRanges?: { start: number; end: number }[],
  ) => Promise<{
    teaser: {
      selectionPolicy?: "later-main-v1" | "adaptive-editorial-v3";
      version: 1;
      rangeKey: string;
      reason: string;
    } & {
      status: "selected";
      start: number;
      end: number;
      selection: "ai" | "fallback" | "external-import" | "manual";
      manualSourceId?: string;
      candidateId?: string;
      kind?: string;
      partUnderstanding?: string;
      contentTypes?: string;
      observed?: string;
      startContext?: string;
      standalone?: boolean;
      complete?: boolean;
      endingBasis?: string;
      cueIds?: string[];
      replayUse?: string;
      heatmapEvidence?: { available: boolean; supportsSelection: boolean; peakTimes: number[]; reason: string };
      alternatives?: import("@/lib/teaser-import.mjs").ExternalChoice[];
      editedFrom?: {
        selection: "ai" | "external-import" | "fallback";
        provider: string;
        model: string;
        promptVersion: string;
        inputKey: string;
        start: number;
        end: number;
      };
      binding?: import("@/lib/teaser-context.mjs").TeaserBinding;
      ending?: string;
      relation: string;
      evidenceTimes: number[];
      limitations: string[];
      provider: string;
      model: string;
      promptVersion: string;
      inputKey: string;
      transition: "inherit-or-dip-black";
    };
    captionTrack: CaptionTrack | undefined;
  }>;
  reviewTarget: HTMLDivElement | null;
  reviewVisible: boolean;
  seekPreview: (value: number) => void;
  sessionReady: boolean;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setCutPlan: (update: SetStateAction<EditPlan>, label: string, group?: string) => void;
  setError: Dispatch<SetStateAction<string>>;
  setIsPreviewPlaying: Dispatch<SetStateAction<boolean>>;
  setMainDraftErrors: Dispatch<SetStateAction<Record<number, { sourceKey: string; key: string; invalid: boolean }>>>;
  setPlan: (update: SetStateAction<EditPlan>) => void;
  setRenderJob: Dispatch<SetStateAction<RenderJob | null>>;
  setSourceCaptions: Dispatch<SetStateAction<CaptionTrack | null>>;
  setTeaserDraftErrors: Dispatch<SetStateAction<Record<number, { sourceKey: string; key: string; message: string }>>>;
  sourceSelectionEpoch: RefObject<number>;
  stopTeaserAuditions: (except?: number) => void;
  stopWorkspacePlayback: (exceptTeaser?: number) => void;
  subtitleCues: Caption[];
  supplementalPrompt: string;
  teaserIssues: { partId: number; reason: string }[];
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
  timelineStatusTarget: HTMLDivElement | null;
  transcript: string;
  travelCutHistory: (direction: "undo" | "redo") => void;
  workspace: "editor" | "batch" | "storage";
};
export function TimelineView({ model }: { model: Props }) {
  const {
    activePart,
    activePartIndex,
    activeTeaserRequests,
    cutHistory,
    cutHistoryBlocked,
    cutHistoryTravelRevision,
    decks,
    hasEditPlan,
    instruction,
    invalidateAnalysis,
    isAnalyzing,
    latestPartHookIdentities,
    mainEditorSourceKey,
    musicPlaybackControl,
    preparedSource,
    previewDuration,
    previewPlan,
    previewPlayingRef,
    previewVideoRef,
    previewVideoUrl,
    provider,
    registerTeaserAudition,
    resolveCustomTeaser,
    reviewTarget,
    reviewVisible,
    seekPreview,
    sessionReady,
    setActivePartIndex,
    setCutPlan,
    setError,
    setIsPreviewPlaying,
    setMainDraftErrors,
    setPlan,
    setRenderJob,
    setSourceCaptions,
    setTeaserDraftErrors,
    sourceSelectionEpoch,
    stopTeaserAuditions,
    stopWorkspacePlayback,
    subtitleCues,
    supplementalPrompt,
    teaserIssues,
    teaserOperations,
    timelineStatusTarget,
    transcript,
    travelCutHistory,
    workspace,
  } = model;

  return (
    <>
      {hasEditPlan && (
        <div className="min-w-0 rounded-xl border border-white/8 bg-white/[.025] p-3">
          <div className="studio-cut-history-toolbar">
            <h3 className="text-sm font-semibold">
              Timeline · Part {activePart.id}
              {teaserIssues
                .filter((issue) => issue.partId !== activePart.id)
                .map((issue) => (
                  <span key={issue.partId} className="studio-other-part-status">
                    Part {issue.partId} cần sửa
                  </span>
                ))}
            </h3>
            <div role="group" aria-label="Lịch sử chỉnh cut">
              <Button variant="secondary" size="md"
                type="button"
                className="studio-control"
                disabled={cutHistoryBlocked || !cutHistory.previous}
                title={
                  cutHistory.previous
                    ? `Hoàn tác: ${cutHistory.previous.label} · ⌘/Ctrl+Z`
                    : "Chưa có chỉnh cut để hoàn tác"
                }
                onClick={() => travelCutHistory("undo")}
              >
                Hoàn tác
              </Button>
              <Button variant="secondary" size="md"
                type="button"
                className="studio-control"
                disabled={cutHistoryBlocked || !cutHistory.next}
                title={
                  cutHistory.next
                    ? `Làm lại: ${cutHistory.next.label} · ⌘/Ctrl+Shift+Z hoặc Ctrl+Y`
                    : "Chưa có chỉnh cut để làm lại"
                }
                onClick={() => travelCutHistory("redo")}
              >
                Làm lại
              </Button>
            </div>
          </div>
          {previewPlan.parts.map((part, index) => (
            <MainRangesEditor
              key={`${preparedSource?.id || previewVideoUrl}:${part.id}`}
              statusTarget={timelineStatusTarget}
              active={workspace === "editor" && index === activePartIndex}
              plan={previewPlan}
              part={part}
              duration={preparedSource?.duration || previewDuration || Infinity}
              onSeek={(rangeIndex) => {
                const main = part.segments.filter((s) => !s.isPadding)[rangeIndex],
                  segments = presentationSegments(part);
                if (main) {
                  const index = segments.indexOf(main);
                  if (index >= 0) seekPreview(timelineTimeForSegment(segments, index, main.start, PREVIEW_RATE));
                }
              }}
              onInvalidate={() => {
                invalidateAnalysis();
                activeTeaserRequests.current
                  .get(part.id)
                  ?.controller.abort(new Error("Mốc main đang được sửa; đã dừng lựa chọn teaser cũ."));
                setRenderJob(null);
              }}
              onDraft={(id, key, invalid) =>
                setMainDraftErrors((current) =>
                  current[id]?.sourceKey === mainEditorSourceKey &&
                  current[id]?.key === key &&
                  current[id]?.invalid === invalid
                    ? current
                    : { ...current, [id]: { sourceKey: mainEditorSourceKey, key, invalid } },
                )
              }
              onHistoryBoundary={cutHistory.boundary}
              onEdit={(id, rows: MainRangeRow[], expectedKey, group) => {
                invalidateAnalysis();
                setRenderJob(null);
                setCutPlan(
                  (current) => {
                    const base = effectiveCutPlan(current),
                      target = base.parts.find((p) => p.id === id);
                    if (!target || hookRangeKey(target) !== expectedKey) return current;
                    try {
                      return applyMainRanges(base, id, rows, preparedSource?.duration || previewDuration || Infinity);
                    } catch {
                      return current;
                    }
                  },
                  `Chỉnh Main Part ${id}`,
                  group,
                );
              }}
              onRestore={(id) => {
                invalidateAnalysis();
                setRenderJob(null);
                try {
                  const next = restoreAiMainRanges(
                    previewPlan,
                    id,
                    preparedSource?.duration || previewDuration || Infinity,
                  );
                  setCutPlan(next, `Khôi phục Main AI Part ${id}`);
                  setMainDraftErrors((current) => ({
                    ...current,
                    [id]: {
                      sourceKey: mainEditorSourceKey,
                      key: hookRangeKey(next.parts.find((p) => p.id === id)!),
                      invalid: false,
                    },
                  }));
                  setError("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              <TeaserEditor
                statusTarget={timelineStatusTarget}
                sourceId={preparedSource?.id || ""}
                sourceDuration={preparedSource?.duration || previewDuration}
                issues={teaserIssues.filter((issue) => issue.partId === part.id).map((issue) => issue.reason)}
                reviewTarget={reviewTarget}
                reviewVisible={reviewVisible}
                reviewSourceKey={
                  sessionReady && preparedSource ? `${WORKER_ORIGIN}/api/sources/${preparedSource.id}/media` : ""
                }
                reviewRequest={JSON.stringify([transcript, instruction, supplementalPrompt, provider])}
                onAuditionControl={registerTeaserAudition}
                onDraft={(id, key, message) =>
                  setTeaserDraftErrors((current) =>
                    current[id]?.sourceKey === mainEditorSourceKey &&
                    current[id]?.key === key &&
                    current[id]?.message === message
                      ? current
                      : { ...current, [id]: { sourceKey: mainEditorSourceKey, key, message } },
                  )
                }
                suspended={workspace !== "editor"}
                aiBusy={isAnalyzing}
                progress={teaserOperations[part.id] && <AiOperationStatus {...teaserOperations[part.id]} />}
                part={part}
                sourceUrl={previewVideoUrl}
                active={workspace === "editor" && part.id === activePart.id}
                cues={previewPlan.captionCues?.cues || subtitleCues}
                transition={
                  <label className="mt-3 block min-w-0 space-y-1 text-xs">
                    <span className="block font-semibold leading-5">
                      Hook → Main <span className="font-normal text-zinc-500">· cả 2 Part</span>
                    </span>
                    <Select
                      value={previewPlan.hookTransition || "legacy"}
                      onValueChange={(value) =>
                        setPlan((current) => ({
                          ...current,
                          hookTransition: value === "legacy" ? undefined : (value as EditPlan["hookTransition"]),
                        }))
                      }
                    >
                      <SelectTrigger
                        aria-label="Transition Hook → Main"
                        className="studio-input block w-full min-w-0 max-w-full border px-2 pr-7 text-xs leading-normal"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="legacy">Theo lựa chọn đã lưu</SelectItem>
                        <SelectItem value="vr-light-leak-v2">Warm Light Leak</SelectItem>
                        <SelectItem value="rainbow-light-leak">Legacy Rainbow Wash</SelectItem>
                        <SelectItem value="dip-black">Dip Black</SelectItem>
                        <SelectItem value="flash-white">Flash White</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                }
                onResolve={(input, signal, previousRanges) =>
                  resolveCustomTeaser(part.id, input, signal, previousRanges)
                }
                onToggle={(enabled) => {
                  stopTeaserAuditions();
                  previewPlayingRef.current = false;
                  setIsPreviewPlaying(false);
                  decks.current?.pause();
                  previewVideoRef.current?.pause();
                  musicPlaybackControl.current?.pause();
                  invalidateAnalysis();
                  setCutPlan(
                    (current) => ({
                      ...current,
                      parts: current.parts.map((p) => (p.id === part.id ? { ...p, teaserEnabled: enabled } : p)),
                    }),
                    `Bật/tắt Teaser Part ${part.id}`,
                  );
                }}
                onAudition={() => {
                  stopWorkspacePlayback(part.id);
                  setActivePartIndex(index);
                }}
                onChange={async (next, proposalTrack) => {
                  const source = preparedSource;
                  if (!source) throw Error("Chuẩn bị đúng nguồn trước khi áp dụng teaser.");
                  const epoch = sourceSelectionEpoch.current,
                    identity = latestPartHookIdentities.current[next.id],
                    historyRevision = cutHistoryTravelRevision.current;
                  const captionCues = proposalTrack
                    ? sourceCaptionTrack(proposalTrack, source)
                    : previewPlan.captionCues;
                  if (
                    proposalTrack &&
                    previewPlan.captionCues?.origin === "user-edited" &&
                    JSON.stringify(captionCues?.cues) !== JSON.stringify(previewPlan.captionCues.cues)
                  )
                    throw Error("Ứng viên dùng phụ đề khác bản chỉnh tay; chọn lại với phụ đề hiện tại.");
                  const selected = {
                    ...previewPlan,
                    ...(captionCues ? { captionCues } : {}),
                    parts: previewPlan.parts.map((p) =>
                      p.id === next.id
                        ? {
                            ...p,
                            teaser: next.teaser,
                            customTeaser: next.customTeaser,
                            teaserNeedsReselection: false,
                          }
                        : { ...p, teaserEnabled: false },
                    ),
                  };
                  const target = selected.parts.find((p) => p.id === next.id)!;
                  validateTeaser(target, source.duration, source.id);
                  await assertTeaserContexts(
                    selected,
                    source,
                    captionCues?.cues || subtitleCues,
                    transcript || source.transcript || "",
                    { instruction, supplementalPrompt },
                  );
                  if (!(await externalHooksCurrent(selected, source, transcript || source.transcript || "")))
                    throw Error("Ứng viên import đã cũ; tạo prompt lại.");
                  if (
                    epoch !== sourceSelectionEpoch.current ||
                    identity !== latestPartHookIdentities.current[next.id] ||
                    historyRevision !== cutHistoryTravelRevision.current
                  )
                    throw Error("Nguồn/main hoặc lịch sử cut đã đổi; ứng viên chưa được áp dụng.");
                  if (proposalTrack && captionCues) setSourceCaptions(captionCues);
                  invalidateAnalysis();
                  setCutPlan((current) => {
                    try {
                      const base = effectiveCutPlan(current);
                      const effective = base;
                      const target = effective.parts.find((p) => p.id === next.id);
                      if (!target || hookRangeKey(target) !== hookRangeKey(next)) return current;
                      return {
                        ...current,
                        ...(captionCues ? { captionCues } : {}),
                        teaserPolicy: TEASER_POLICY,
                        parts: current.parts.map((p) =>
                          p.id === next.id
                            ? {
                                ...p,
                                teaser: next.teaser,
                                customTeaser: next.customTeaser,
                                teaserNeedsReselection: false,
                              }
                            : p,
                        ),
                      };
                    } catch {
                      return current;
                    }
                  }, `Áp dụng Teaser Part ${next.id}`);
                }}
              />
            </MainRangesEditor>
          ))}
        </div>
      )}
      {!hasEditPlan && <p className="studio-muted text-xs">Chưa có bản cắt.</p>}
    </>
  );
}
