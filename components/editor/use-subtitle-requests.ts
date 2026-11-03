"use client";
import type { WorkerHealth } from "@/lib/api/worker-client";
import { workerFetch, type WorkerSource } from "@/lib/api/worker-client";
import type { SubtitleStyle } from "@/lib/subtitles.mjs";
import { isCurrentCaptionRequest, sourceCaptionTrack, type CaptionTrack } from "@/lib/subtitles.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect } from "react";
type State = {
  preparedSource: WorkerSource | null;
  restorePassive: boolean;
  restoringSource: RefObject<boolean>;
  sessionReady: boolean;
  setInterruptedTasks: Dispatch<SetStateAction<string[]>>;
  setSourceCaptions: Dispatch<SetStateAction<CaptionTrack | null>>;
  setSpeechModel: Dispatch<
    SetStateAction<{
      modelReady: boolean;
      installing: boolean;
      model?: string;
      backend?: string;
      modelId?: string;
      downloadedBytes?: number;
      totalBytes?: number;
    } | null>
  >;
  setSubtitleBusy: Dispatch<SetStateAction<boolean>>;
  setSubtitleNotice: Dispatch<SetStateAction<string>>;
  setSubtitleStartedAt: Dispatch<SetStateAction<number>>;
  sourceCaptions: CaptionTrack | null;
  sourceRequests: RefObject<Set<AbortController>>;
  sourceSelectionEpoch: RefObject<number>;
  subtitleAutoKey: RefObject<string>;
  subtitleBusy: boolean;
  subtitleController: RefObject<AbortController | null>;
  subtitleRequestSerial: RefObject<number>;
  subtitleSettings: SubtitleStyle;
  subtitleSourceRef: RefObject<string | undefined>;
  workerHealth: WorkerHealth | null;
};
export function useSubtitleRequests(state: State) {
  const {
    preparedSource,
    restorePassive,
    restoringSource,
    sessionReady,
    setInterruptedTasks,
    setSourceCaptions,
    setSpeechModel,
    setSubtitleBusy,
    setSubtitleNotice,
    setSubtitleStartedAt,
    sourceCaptions,
    sourceRequests,
    sourceSelectionEpoch,
    subtitleAutoKey: subtitleAutoKeyRef,
    subtitleBusy,
    subtitleController: subtitleControllerRef,
    subtitleRequestSerial: subtitleRequestSerialRef,
    subtitleSettings,
    subtitleSourceRef,
    workerHealth,
  } = state;
  useEffect(() => {
    if (restoringSource.current && !preparedSource) return;
    subtitleSourceRef.current = preparedSource?.id;
    subtitleRequestSerialRef.current += 1;
    subtitleAutoKeyRef.current = "";
    const sourceId = preparedSource?.id;
    queueMicrotask(() => {
      if (subtitleSourceRef.current !== sourceId) return;
      setSubtitleBusy(false);
      setSubtitleNotice("");
      setSourceCaptions((current) => (current?.sourceId === sourceId ? current : null));
    });
  }, [preparedSource?.id, restoringSource]);
  const loadSubtitles = useCallback(
    async (install = false, regenerate = false) => {
      const source = preparedSource;
      setInterruptedTasks((current) => current.filter((s) => !s.includes("phụ đề")));
      if (!source || subtitleBusy || subtitleControllerRef.current) return;
      const selectionEpoch = sourceSelectionEpoch.current;
      const requestId = ++subtitleRequestSerialRef.current;
      subtitleAutoKeyRef.current = `${source.id}:${subtitleSettings.source || "auto"}:${subtitleSettings.language || "auto"}`;
      const currentRequest = () =>
        isCurrentCaptionRequest(
          { sourceId: source.id, serial: requestId, selectionEpoch },
          {
            sourceId: subtitleSourceRef.current,
            serial: subtitleRequestSerialRef.current,
            selectionEpoch: sourceSelectionEpoch.current,
          },
        );
      const controller = new AbortController();
      subtitleControllerRef.current = controller;
      sourceRequests.current.add(controller);
      setSubtitleStartedAt(Date.now());
      setSubtitleBusy(true);
      setSubtitleNotice(install ? "Đang tải model Whisper small · 465 MiB…" : "Đang tạo phụ đề…");
      try {
        if (install) {
          const response = await workerFetch(`/api/speech/model`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          const data = (await response.json()) as { error?: string };
          if (!response.ok) throw new Error(data.error || "Không tải được model.");
        }
        if (!currentRequest() || controller.signal.aborted) return;
        const response = await workerFetch(`/api/sources/${source.id}/captions`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regenerate,
            provider: subtitleSettings.source || "auto",
            language: subtitleSettings.language || "auto",
          }),
        });
        const data = (await response.json()) as Partial<CaptionTrack> & { error?: string };
        if (!currentRequest()) return;
        if (!response.ok || !data.cues) throw new Error(data.error || "Không tạo được phụ đề.");
        const track = sourceCaptionTrack(
          { ...data, sourceId: data.sourceId || "", cues: data.cues, origin: data.origin || "" },
          source,
        );
        setSourceCaptions(track);
        setSubtitleNotice(
          `${data.cues.length} câu · ${data.origin === "youtube" ? "phụ đề YouTube" : "nhận diện local"}. Có thể sửa chữ trước khi xuất.`,
        );
      } catch (caught) {
        if (currentRequest()) setSubtitleNotice(caught instanceof Error ? caught.message : "Không tạo được phụ đề.");
      } finally {
        sourceRequests.current.delete(controller);
        if (subtitleControllerRef.current === controller) subtitleControllerRef.current = null;
        if (currentRequest()) setSubtitleBusy(false);
      }
    },
    [
      preparedSource,
      subtitleBusy,
      subtitleSettings.source,
      subtitleSettings.language,
      setInterruptedTasks,
      sourceRequests,
      sourceSelectionEpoch,
    ],
  );
  useEffect(() => {
    if (!sessionReady || restorePassive) return;
    if (!subtitleSettings.enabled) {
      subtitleAutoKeyRef.current = "";
      return;
    }
    if (
      !preparedSource ||
      subtitleBusy ||
      sourceCaptions?.sourceId === preparedSource.id ||
      subtitleAutoKeyRef.current ===
        `${preparedSource.id}:${subtitleSettings.source || "auto"}:${subtitleSettings.language || "auto"}`
    )
      return;
    void loadSubtitles();
  }, [
    sessionReady,
    restorePassive,
    preparedSource,
    subtitleSettings.enabled,
    subtitleSettings.source,
    subtitleSettings.language,
    sourceCaptions?.sourceId,
    subtitleBusy,
    loadSubtitles,
  ]);
  useEffect(() => {
    if (!workerHealth?.ok || !subtitleSettings.enabled) return;
    let disposed = false;
    const refresh = async () => {
      try {
        const data = (await (await workerFetch(`/api/speech/status`)).json()) as {
          modelReady: boolean;
          installing: boolean;
          model?: string;
          backend?: string;
          modelId?: string;
          downloadedBytes?: number;
          totalBytes?: number;
        };
        if (!disposed) setSpeechModel(data);
      } catch {
        /* Worker health already reports connection errors. */
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), subtitleBusy ? 2000 : 15000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [workerHealth?.ok, subtitleSettings.enabled, subtitleBusy]);
  return { loadSubtitles };
}
