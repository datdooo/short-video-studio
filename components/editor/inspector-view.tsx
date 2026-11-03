"use client";
import { CopyButton } from "@/components/copy-button";
import { EditorInspector } from "@/components/editor-workspace";
import { MusicPanel } from "@/components/music-panel";
import { TaskProgress } from "@/components/task-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VisualCustomizePanel } from "@/components/visual-customize-panel";
import { VisualTemplatePanel } from "@/components/visual-template-panel";
import { WORKER_ORIGIN, type WorkerHealth, type WorkerSource } from "@/lib/api/worker-client";
import type { EditPart } from "@/lib/edit-plan";
import { EditPlan, formatTime } from "@/lib/edit-plan";
import type { Caption } from "@/lib/subtitles.mjs";
import { type SubtitleStyle } from "@/lib/subtitles.mjs";
import { listFonts } from "@/lib/visual-style/fonts.mjs";
import { resolvePlanVisualStyle } from "@/lib/visual-style/normalize.mjs";
import { applyVisualTemplate } from "@/lib/visual-style/templates.mjs";
import type { VisualStyle } from "@/lib/visual-style/types";
import { Loader2 } from "lucide-react";
import type { Dispatch, JSX, RefObject, SetStateAction } from "react";

type Props = {
  onEditCaption: (index: number, text: string) => void;
  onCancelSubtitles: () => void;
  activePart: EditPart;
  chooseSubtitleLanguage: (value: string) => void;
  chooseSubtitleSource: (source: "youtube" | "whisper") => void;
  hasEditPlan: boolean;
  inspectorTab: "appearance" | "text" | "music";
  installWhisperModel: () => Promise<void>;
  isPreviewPlaying: boolean;
  loadSubtitles: (install?: boolean, regenerate?: boolean) => Promise<void>;
  musicIntent: boolean;
  plan: EditPlan;
  preparedSource: WorkerSource | null;
  previewBuffering: boolean;
  previewCurrentTime: number;
  previewPlan: EditPlan;
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  previewVisualStyle: VisualStyle;
  registerMusicPlayback: (handle: { play: () => void; pause: () => void } | null) => void;
  restorePassive: boolean;
  sessionReady: boolean;
  setInspectorTab: Dispatch<SetStateAction<"appearance" | "text" | "music">>;
  setMusicIntent: Dispatch<SetStateAction<boolean>>;
  setPlan: (update: SetStateAction<EditPlan>) => void;
  setSubtitleSettings: (update: SubtitleStyle | ((current: SubtitleStyle) => SubtitleStyle)) => void;
  speechModel: {
    modelReady: boolean;
    installing: boolean;
    model?: string;
    backend?: string;
    modelId?: string;
    downloadedBytes?: number;
    totalBytes?: number;
  } | null;
  stopWorkspacePlayback: (exceptTeaser?: number) => void;
  subtitleBusy: boolean;
  subtitleController: RefObject<AbortController | null>;
  subtitleCues: Caption[];
  subtitleNotice: string;
  subtitleSettings: SubtitleStyle;
  subtitleStartedAt: number;
  timelineDuration: number;
  updatePartTitle: (title: string) => void;
  visualControls: {
    overlay: JSX.Element;
    background: JSX.Element;
    filter: JSX.Element;
    animation: JSX.Element;
    transition: JSX.Element;
    text: JSX.Element;
    font: JSX.Element;
  };
  whisperSmallReady: boolean;
  workerHealth: WorkerHealth | null;
  workspace: "editor" | "batch" | "storage";
};
export function InspectorView({ model }: { model: Props }) {
  const {
    onEditCaption,
    onCancelSubtitles,
    activePart,
    chooseSubtitleLanguage,
    chooseSubtitleSource,
    hasEditPlan,
    inspectorTab,
    installWhisperModel,
    isPreviewPlaying,
    loadSubtitles,
    musicIntent,
    plan,
    preparedSource,
    previewBuffering,
    previewCurrentTime,
    previewPlan,
    previewVideoRef,
    previewVisualStyle,
    registerMusicPlayback,
    restorePassive,
    sessionReady,
    setInspectorTab,
    setMusicIntent,
    setPlan,
    setSubtitleSettings,
    speechModel,
    stopWorkspacePlayback,
    subtitleBusy,
    subtitleController,
    subtitleCues,
    subtitleNotice,
    subtitleSettings,
    subtitleStartedAt,
    timelineDuration,
    updatePartTitle,
    visualControls,
    whisperSmallReady,
    workerHealth,
    workspace,
  } = model;

  return (
    <EditorInspector
      tab={inspectorTab}
      onTab={(value) => setInspectorTab(value as typeof inspectorTab)}
      appearance={
        <>
          <VisualTemplatePanel
            style={previewVisualStyle}
            onTemplate={(id) =>
              setPlan((current) => {
                const visualStyle = applyVisualTemplate(resolvePlanVisualStyle(current), id);
                return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
              })
            }
          />
          <VisualCustomizePanel
            style={previewVisualStyle}
            include={["filter", "background", "overlay", "transition"]}
            controls={visualControls}
          />
        </>
      }
      text={
        <>
          <VisualCustomizePanel
            style={previewVisualStyle}
            include={["text", "font", "animation"]}
            controls={visualControls}
          />

          <details className="studio-disclosure mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Auto Subtitle · {subtitleSettings.enabled ? "Bật" : "Tắt"}
            </summary>
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input
                aria-label="Bật phụ đề tự động"
                type="checkbox"
                checked={subtitleSettings.enabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setSubtitleSettings((current) => ({ ...current, enabled }));
                }}
              />{" "}
              Ghép phụ đề vào video xuất
            </label>
            {subtitleSettings.enabled && (
              <div className="mt-3 space-y-3">
                <label className="block text-xs">
                  Ngôn ngữ lời nói
                  <input
                    aria-label="Ngôn ngữ lời nói cho phụ đề"
                    className="studio-input mt-1 w-full"
                    value={subtitleSettings.language || "auto"}
                    placeholder="auto / de / vi / ja"
                    onChange={(event) => chooseSubtitleLanguage(event.target.value)}
                  />
                </label>
                {preparedSource?.captionWarning && (
                  <p className="studio-muted text-xs">{preparedSource.captionWarning}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={subtitleSettings.source !== "whisper"}
                    disabled={subtitleBusy}
                    onClick={() => chooseSubtitleSource("youtube")}
                    className={`rounded-lg border px-2 py-2 text-xs disabled:opacity-50 ${subtitleSettings.source !== "whisper" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-zinc-400"}`}
                  >
                    Dùng phụ đề YouTube
                  </button>
                  <button
                    type="button"
                    aria-pressed={subtitleSettings.source === "whisper"}
                    disabled={subtitleBusy}
                    onClick={() => chooseSubtitleSource("whisper")}
                    className={`rounded-lg border px-2 py-2 text-xs disabled:opacity-50 ${subtitleSettings.source === "whisper" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-zinc-400"}`}
                  >
                    Dùng phụ đề Whisper
                  </button>
                </div>
                <p className="text-xs leading-5 text-zinc-500">
                  {speechModel?.model || "Whisper small đa ngôn ngữ · 465 MiB"} · xử lý trên máy.{" "}
                  {whisperSmallReady
                    ? "Model small đã sẵn sàng."
                    : speechModel?.installing
                      ? `Đang tải ${Math.round(((speechModel.downloadedBytes || 0) / (speechModel.totalBytes || 1)) * 100)}%.`
                      : "Cần tải model một lần."}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label>
                    Font
                    <select
                      aria-label="Font phụ đề"
                      value={subtitleSettings.font}
                      onChange={(event) => setSubtitleSettings((current) => ({ ...current, font: event.target.value }))}
                      className="studio-input mt-1 w-full"
                    >
                      {listFonts().map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Vị trí
                    <select
                      aria-label="Vị trí phụ đề"
                      value={subtitleSettings.position}
                      onChange={(event) =>
                        setSubtitleSettings((current) => ({ ...current, position: event.target.value }))
                      }
                      className="studio-input mt-1 w-full"
                    >
                      <option value="bottom">Dưới khung video</option>
                      <option value="center">Giữa khung video</option>
                      <option value="top">Trên khung video</option>
                    </select>
                  </label>
                  <label>
                    Cỡ chữ
                    <Input
                      aria-label="Cỡ chữ phụ đề"
                      type="number"
                      min={28}
                      max={72}
                      value={subtitleSettings.size}
                      onChange={(event) =>
                        setSubtitleSettings((current) => ({
                          ...current,
                          size: Math.max(28, Math.min(72, Number(event.target.value) || 48)),
                        }))
                      }
                      className="studio-input mt-1 w-full"
                    />
                  </label>
                  <label>
                    Độ dày viền
                    <Input
                      aria-label="Độ dày viền phụ đề"
                      type="number"
                      min={0}
                      max={8}
                      value={subtitleSettings.outline}
                      onChange={(event) =>
                        setSubtitleSettings((current) => ({
                          ...current,
                          outline: Math.max(0, Math.min(8, Number(event.target.value) || 0)),
                        }))
                      }
                      className="studio-input mt-1 w-full"
                    />
                  </label>
                  <label>
                    Màu chữ
                    <Input
                      aria-label="Màu chữ phụ đề"
                      type="color"
                      value={subtitleSettings.color}
                      onChange={(event) =>
                        setSubtitleSettings((current) => ({ ...current, color: event.target.value }))
                      }
                      className="studio-input mt-1 w-full"
                    />
                  </label>
                  <label>
                    Màu viền
                    <Input
                      aria-label="Màu viền phụ đề"
                      type="color"
                      value={subtitleSettings.outlineColor}
                      onChange={(event) =>
                        setSubtitleSettings((current) => ({ ...current, outlineColor: event.target.value }))
                      }
                      className="studio-input mt-1 w-full"
                    />
                  </label>
                </div>
                <Button
                  onClick={() => void loadSubtitles(false, true)}
                  disabled={subtitleBusy || !preparedSource}
                  variant="outline"
                  className="w-full text-xs"
                >
                  {subtitleBusy && <Loader2 className="animate-spin" />} Tạo lại / lấy phụ đề
                </Button>
                <Button
                  onClick={() => void installWhisperModel()}
                  disabled={subtitleBusy || whisperSmallReady || !speechModel || !workerHealth?.ok}
                  variant="outline"
                  className="w-full text-xs"
                >
                  {whisperSmallReady ? "Whisper small đã tải" : "Tải model Whisper small · 465 MiB"}
                </Button>
                {subtitleBusy ? (
                  <TaskProgress
                    label={speechModel?.installing ? "Tải model Whisper" : "Chuẩn bị phụ đề"}
                    startedAt={subtitleStartedAt}
                    percent={
                      speechModel?.installing && speechModel.totalBytes
                        ? (Number(speechModel.downloadedBytes || 0) / speechModel.totalBytes) * 100
                        : null
                    }
                    detail={
                      speechModel?.installing
                        ? "Tiến độ tải model; còn bước kiểm tra checksum."
                        : "ASR hiện chưa cung cấp thời lượng đã xử lý."
                    }
                  />
                ) : (
                  subtitleNotice && (
                    <p role="status" className="text-xs leading-5 text-zinc-400">
                      {subtitleNotice}
                    </p>
                  )
                )}
                {subtitleBusy && subtitleController.current && (
                  <button type="button" className="studio-ghost" onClick={onCancelSubtitles}>
                    Dừng lấy phụ đề
                  </button>
                )}
                {subtitleCues.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs text-zinc-400">
                      Xem / sửa phụ đề · {subtitleCues.length} câu
                    </summary>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                      {subtitleCues.map((cue, index) => (
                        <label key={index} className="block text-xs text-zinc-500">
                          {formatTime(cue.start)} – {formatTime(cue.end)}
                          <Textarea
                            aria-label={`Câu phụ đề ${index + 1}`}
                            value={cue.text}
                            onChange={(event) => onEditCaption(index, event.target.value)}
                            className="studio-textarea mt-1 min-h-[48px] text-xs"
                          />
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </details>

          <div className="mt-5">
            <label htmlFor="part-title" className="field-label">
              Tiêu đề Part
            </label>
            <Textarea
              id="part-title"
              value={activePart.title}
              onChange={(event) => updatePartTitle(event.target.value.toUpperCase())}
              className="studio-textarea mt-2 min-h-[72px] text-base font-bold leading-5"
            />
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
            <div className="studio-field-header flex items-center justify-between gap-3">
              <label htmlFor="final-title" className="field-label">
                TITLE SAU CÙNG
              </label>
              <CopyButton
                text={`${plan.originalTitle} | ${activePart.title} (${activePart.id}/${plan.parts.length})\n\n${activePart.hashtags.join(" ")}`}
                className="py-1.5"
              />
            </div>
            <Textarea
              id="final-title"
              readOnly
              value={`${plan.originalTitle} | ${activePart.title} (${activePart.id}/${plan.parts.length})`}
              className="studio-textarea mt-2 min-h-[64px] text-sm leading-6"
            />

            <p className="mt-4 text-xs font-semibold text-zinc-300">
              Hashtag của Part {activePart.id} · {activePart.hashtags.length}/10
            </p>
            {activePart.hashtags.length > 0 ? (
              <Textarea
                aria-label={`Hashtag Part ${activePart.id}`}
                readOnly
                value={activePart.hashtags.join(" ")}
                className="studio-textarea mt-2 min-h-[88px] text-sm leading-6 [overflow-wrap:anywhere]"
              />
            ) : (
              <p className="mt-2 text-xs leading-6 text-zinc-500">Chưa có hashtag.</p>
            )}
            {activePart.hashtags.length > 0 && activePart.hashtags.length < 10 && (
              <p className="mt-2 text-xs leading-5 text-zinc-500">Plan này có dưới 10 hashtag.</p>
            )}
          </div>
        </>
      }
      music={
        <>
          <MusicPanel
            suspended={workspace !== "editor"}
            autoPrepare={sessionReady && (!restorePassive || musicIntent)}
            previewReady={hasEditPlan}
            onPlayback={registerMusicPlayback}
            plan={previewPlan}
            worker={WORKER_ORIGIN}
            settings={previewPlan.music}
            activity={previewPlan.musicSpeech}
            source={preparedSource}
            part={activePart}
            duration={timelineDuration}
            time={previewCurrentTime}
            playing={workspace === "editor" && isPreviewPlaying && !previewBuffering}
            video={previewVideoRef}
            onChange={(music) => {
              setMusicIntent(true);
              setPlan((current) => ({ ...current, music }));
            }}
            onSpeech={(musicSpeech) => setPlan((current) => ({ ...current, musicSpeech }))}
            onAudition={() => stopWorkspacePlayback()}
          />{" "}
        </>
      }
    />
  );
}
