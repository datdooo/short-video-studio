"use client";
import { workerFetch, type WorkerSource } from "@/lib/api/worker-client";
import type { SubtitleStyle } from "@/lib/subtitles.mjs";
import { type CaptionTrack } from "@/lib/subtitles.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
type State = {
  captionState: { track: CaptionTrack | undefined; error: string };
  preparedSource: WorkerSource | null;
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
  setSubtitleSettings: (update: SubtitleStyle | ((current: SubtitleStyle) => SubtitleStyle)) => void;
  setSubtitleStartedAt: Dispatch<SetStateAction<number>>;
  sourceSelectionEpoch: RefObject<number>;
  speechModel: {
    modelReady: boolean;
    installing: boolean;
    model?: string;
    backend?: string;
    modelId?: string;
    downloadedBytes?: number;
    totalBytes?: number;
  } | null;
  subtitleAutoKey: RefObject<string>;
  subtitleBusy: boolean;
  subtitleController: RefObject<AbortController | null>;
  subtitleRequestSerial: RefObject<number>;
  subtitleSettings: SubtitleStyle;
};
/** Pure action factory. State is read only when an action is invoked, after render. */
export function createSubtitleActions(read: () => State) {
  function chooseSubtitleSource(source: "youtube" | "whisper") {
    const {
      setSourceCaptions,
      setSubtitleBusy,
      setSubtitleNotice,
      setSubtitleSettings,
      subtitleAutoKey,
      subtitleController,
      subtitleRequestSerial,
      subtitleSettings,
    } = read();

    if (source === subtitleSettings.source) return;
    subtitleRequestSerial.current += 1;
    subtitleController.current?.abort();
    subtitleController.current = null;
    setSubtitleBusy(false);
    subtitleAutoKey.current = "";
    setSourceCaptions(null);
    setSubtitleNotice("");
    setSubtitleSettings((current) => ({ ...current, source }));
  }
  function chooseSubtitleLanguage(value: string) {
    const {
      preparedSource,
      setSubtitleBusy,
      setSubtitleNotice,
      setSubtitleSettings,
      subtitleAutoKey,
      subtitleController,
      subtitleRequestSerial,
      subtitleSettings,
    } = read();

    const language = value.toLowerCase();
    if (language === (subtitleSettings.language || "auto")) return;
    subtitleRequestSerial.current++;
    subtitleController.current?.abort();
    subtitleController.current = null;
    setSubtitleBusy(false);
    // Do not auto-run ASR for each partially typed language or erase edited cues.
    subtitleAutoKey.current = preparedSource
      ? `${preparedSource.id}:${subtitleSettings.source || "auto"}:${language || "auto"}`
      : "";
    setSubtitleSettings((current) => ({ ...current, language }));
    setSubtitleNotice("Ngôn ngữ đã đổi; phụ đề hiện tại được giữ. Bấm tạo lại để áp dụng.");
  }
  async function installWhisperModel() {
    const {
      setSpeechModel,
      setSubtitleBusy,
      setSubtitleNotice,
      setSubtitleStartedAt,
      sourceSelectionEpoch,
      speechModel,
      subtitleAutoKey,
      subtitleBusy,
      subtitleRequestSerial,
    } = read();

    if (subtitleBusy) return;
    const epoch = sourceSelectionEpoch.current,
      requestId = ++subtitleRequestSerial.current;
    const current = () => epoch === sourceSelectionEpoch.current && requestId === subtitleRequestSerial.current;
    setSubtitleStartedAt(Date.now());
    setSubtitleBusy(true);
    setSubtitleNotice("Đang tải Whisper small · 465 MiB…");
    try {
      if (speechModel?.modelId !== "ggml-small.bin")
        throw new Error(
          "Worker đang chạy chưa cấu hình Whisper small. Khi job kết thúc, mở lại bản Beta mới; không tải/nhận base là small.",
        );
      const response = await workerFetch(`/api/speech/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as {
        modelReady: boolean;
        installing: boolean;
        model?: string;
        backend?: string;
        modelId?: string;
        downloadedBytes?: number;
        totalBytes?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Không tải được model.");
      if (data.modelId !== "ggml-small.bin") throw new Error("Worker trả model khác small; chưa xác nhận nâng model.");
      if (!current()) return;
      setSpeechModel(data);
      setSubtitleNotice(
        data.modelReady
          ? "Whisper small đã sẵn sàng."
          : "Model small chưa sẵn sàng; kiểm tra tải/checksum, không dùng base thay thế.",
      );
      subtitleAutoKey.current = "";
    } catch (caught) {
      if (current()) setSubtitleNotice(caught instanceof Error ? caught.message : "Không tải được model.");
    } finally {
      if (current()) setSubtitleBusy(false);
    }
  }
  function cancelSubtitles() {
    const { setSubtitleBusy, setSubtitleNotice, subtitleController, subtitleRequestSerial } = read();

    subtitleController.current?.abort();
    subtitleController.current = null;
    subtitleRequestSerial.current++;
    setSubtitleBusy(false);
    setSubtitleNotice("Đã dừng lấy phụ đề; bản đang dùng được giữ.");
  }
  function editCaption(index: number, text: string) {
    const {
      captionState,
      setSourceCaptions,
      setSubtitleBusy,
      setSubtitleNotice,
      subtitleController,
      subtitleRequestSerial,
    } = read();

    subtitleRequestSerial.current++;
    subtitleController.current?.abort();
    subtitleController.current = null;
    setSubtitleBusy(false);
    setSubtitleNotice("");
    setSourceCaptions((current) => {
      const track = current || captionState.track;
      return track
        ? {
            ...track,
            origin: "user-edited",
            cues: track.cues.map((item, itemIndex) => (itemIndex === index ? { ...item, text } : item)),
          }
        : null;
    });
  }
  return { chooseSubtitleSource, chooseSubtitleLanguage, installWhisperModel, cancelSubtitles, editCaption };
}

/** Event handlers read the latest committed reader, never refs during render. */
export function useSubtitleActions(read: () => State) {
  const readerRef = useRef(read);
  useLayoutEffect(() => {
    readerRef.current = read;
  }, [read]);
  const chooseSubtitleSource = useCallback(
    (...args: Parameters<ReturnType<typeof createSubtitleActions>["chooseSubtitleSource"]>) =>
      createSubtitleActions(readerRef.current).chooseSubtitleSource(...args),
    [],
  );
  const chooseSubtitleLanguage = useCallback(
    (...args: Parameters<ReturnType<typeof createSubtitleActions>["chooseSubtitleLanguage"]>) =>
      createSubtitleActions(readerRef.current).chooseSubtitleLanguage(...args),
    [],
  );
  const installWhisperModel = useCallback(
    (...args: Parameters<ReturnType<typeof createSubtitleActions>["installWhisperModel"]>) =>
      createSubtitleActions(readerRef.current).installWhisperModel(...args),
    [],
  );
  const cancelSubtitles = useCallback(
    (...args: Parameters<ReturnType<typeof createSubtitleActions>["cancelSubtitles"]>) =>
      createSubtitleActions(readerRef.current).cancelSubtitles(...args),
    [],
  );
  const editCaption = useCallback(
    (...args: Parameters<ReturnType<typeof createSubtitleActions>["editCaption"]>) =>
      createSubtitleActions(readerRef.current).editCaption(...args),
    [],
  );
  return useMemo(
    () => ({ chooseSubtitleSource, chooseSubtitleLanguage, installWhisperModel, cancelSubtitles, editCaption }),
    [chooseSubtitleSource, chooseSubtitleLanguage, installWhisperModel, cancelSubtitles, editCaption],
  );
}
