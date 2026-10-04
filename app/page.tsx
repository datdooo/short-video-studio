"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clapperboard,
  Clock3,
  Download,
  FileJson,
  Film,
  Link2,
  Loader2,
  Play,
  RotateCcw,
  Scissors,
  Settings2,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AiProvider,
  AnalyzeRequest,
  EditPlan,
  durationOf,
  finalDurationOf,
  formatTime,
  isChronological,
  manualPlan,
  mockPlan,
} from "@/lib/edit-plan";
import { buildRenderManifest, fontStackFor } from "@/lib/render-spec";

const DEMO_TRANSCRIPT = `00:00 Willkommen zurück auf dem Kanal.
00:38 Heute schauen wir uns diesen völlig verrückten Audi A2 an.
01:12 Beim ersten Start klingt alles noch ganz normal.
01:46 Dann öffnen wir die Motorhaube und sehen den Umbau.
02:25 Niemand erwartet, was hier eingebaut wurde.
03:18 Der Motor startet sofort und die erste Reaktion sagt alles.
04:07 Jetzt zeigen wir den kompletten Motorraum.
05:26 Dieses kleine Detail macht den ganzen Umbau besonders.
06:22 Bei der Probefahrt taucht plötzlich ein Problem auf.
07:14 Wir finden die Ursache und ändern den Plan.
08:41 Nach dem Fix läuft das Auto endlich sauber.
09:36 Das Ergebnis ist besser als erwartet.`;

const DEFAULT_REQUEST: AnalyzeRequest = {
  originalTitle: "Umbau völlig ESKALIERT — Audi A2 1.9 TDI",
  transcript: DEMO_TRANSCRIPT,
  instruction: "Intro ngắn, vào thẳng phần mở nắp capo. Part 2 bắt đầu bằng sự cố.",
  provider: "mock",
};

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [editMode, setEditMode] = useState<"ai" | "manual">("ai");
  const [provider, setProvider] = useState<AiProvider>("mock");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState(DEFAULT_REQUEST.originalTitle);
  const [transcript, setTranscript] = useState(DEMO_TRANSCRIPT);
  const [instruction, setInstruction] = useState(DEFAULT_REQUEST.instruction || "");
  const [plan, setPlan] = useState<EditPlan>(() => mockPlan(DEFAULT_REQUEST));
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [localVideoUrl, setLocalVideoUrl] = useState("");
  const [localFileName, setLocalFileName] = useState("");
  const [manualPart1Title, setManualPart1Title] = useState("THE DETAIL NOBODY EXPECTED");
  const [manualPart2Title, setManualPart2Title] = useState("THEN EVERYTHING CHANGED");
  const [manualPart1Ranges, setManualPart1Ranges] = useState("01:12 - 01:46 First reaction\n02:25 - 03:18 Engine reveal");
  const [manualPart2Ranges, setManualPart2Ranges] = useState("06:22 - 07:14 The problem\n08:41 - 09:36 Final result");

  const activePart = plan.parts[activePartIndex];
  const fontStack = useMemo(
    () => fontStackFor(`${plan.originalTitle} ${activePart.title}`),
    [activePart.title, plan.originalTitle],
  );

  useEffect(() => () => {
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
  }, [localVideoUrl]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool(
      {
        name: "apply_manual_edit_plan",
        title: "Apply manual edit plan",
        description: "Apply chronological timestamp ranges for two video parts without using AI, and update the visible edit plan.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            originalTitle: { type: "string" },
            part1Title: { type: "string" },
            part1Ranges: { type: "string", description: "One timestamp range per line, for example 00:10 - 00:25 Hook" },
            part2Title: { type: "string" },
            part2Ranges: { type: "string", description: "One timestamp range per line" },
          },
          required: ["originalTitle", "part1Title", "part1Ranges", "part2Title", "part2Ranges"],
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const values = input as {
            originalTitle: string;
            part1Title: string;
            part1Ranges: string;
            part2Title: string;
            part2Ranges: string;
          };
          if (!values || Object.values(values).some((value) => typeof value !== "string")) {
            throw new Error("All manual edit-plan fields must be strings.");
          }
          const nextPlan = manualPlan(values);
          setSourceTitle(values.originalTitle);
          setManualPart1Title(values.part1Title);
          setManualPart1Ranges(values.part1Ranges);
          setManualPart2Title(values.part2Title);
          setManualPart2Ranges(values.part2Ranges);
          setPlan(nextPlan);
          setEditMode("manual");
          setActivePartIndex(0);
          setError("");
          return {
            source: "manual",
            partCount: nextPlan.parts.length,
            sourceDurations: nextPlan.parts.map((part) => durationOf(part)),
            finalSpeed: nextPlan.render.speed,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  async function analyze() {
    setError("");
    if (!transcript.trim()) {
      setError("Hãy paste transcript có timestamp trước.");
      return;
    }
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          originalTitle: sourceTitle,
          transcript,
          instruction,
        } satisfies AnalyzeRequest),
      });
      const data = (await response.json()) as EditPlan | { error: string };
      if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "Không thể tạo edit plan.");
      setPlan(data);
      setActivePartIndex(0);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể tạo edit plan.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function applyManualPlan() {
    setError("");
    try {
      const nextPlan = manualPlan({
        originalTitle: sourceTitle,
        part1Title: manualPart1Title,
        part1Ranges: manualPart1Ranges,
        part2Title: manualPart2Title,
        part2Ranges: manualPart2Ranges,
      });
      setPlan(nextPlan);
      setActivePartIndex(0);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Timestamp không hợp lệ.");
    }
  }

  function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    setLocalVideoUrl(URL.createObjectURL(file));
    setLocalFileName(file.name);
    if (!sourceTitle.trim()) setSourceTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  function updatePartTitle(title: string) {
    setPlan((current) => ({
      ...current,
      parts: current.parts.map((part, index) => index === activePartIndex ? { ...part, title } : part),
    }));
  }

  function downloadRenderConfig() {
    const manifests = plan.parts.map((part) => buildRenderManifest({
      sourcePath: localFileName || "source.mp4",
      outputPath: `part-${part.id}.mp4`,
      originalTitle: plan.originalTitle,
      part,
      totalParts: plan.parts.length,
    }));
    downloadJson("render-manifest.json", { editPlan: plan, manifests });
  }

  return (
    <main className="min-h-screen bg-[#090a0c] text-white">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/8 bg-[#090a0c]/92 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-[#ff4d2e] shadow-[0_0_24px_rgba(255,77,46,.26)]">
            <Clapperboard className="size-[18px]" strokeWidth={2.3} />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-[-0.02em]">ShortCut Studio</p>
            <p className="text-[11px] text-zinc-500">personal vertical video editor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden border-white/10 bg-white/[.03] text-zinc-400 sm:flex">1080 × 1920</Badge>
          <Badge className="border-[#ff4d2e]/25 bg-[#ff4d2e]/10 text-[#ff806a]">1.25× final</Badge>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 xl:grid-cols-[340px_minmax(430px,1fr)_390px]">
        <aside className="border-b border-white/8 bg-[#0d0e11] p-5 xl:border-b-0 xl:border-r xl:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">01 / SOURCE</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Create the cut</h1>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[.03] text-zinc-500">
              {editMode === "ai" ? "AI plan" : "Manual cut"}
            </Badge>
          </div>

          <Tabs defaultValue="youtube" className="mt-6">
            <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-white/[.045] p-1">
              <TabsTrigger value="youtube" className="rounded-lg text-xs">YouTube</TabsTrigger>
              <TabsTrigger value="local" className="rounded-lg text-xs">Local video</TabsTrigger>
            </TabsList>
            <TabsContent value="youtube" className="pt-3">
              <label htmlFor="youtube-url" className="field-label">YouTube URL</label>
              <div className="relative mt-2">
                <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                <Input id="youtube-url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="youtube.com/watch?v=..." className="studio-input pl-10" />
              </div>
              <p className="mt-2 text-[11px] leading-5 text-zinc-600">URL import hook is ready; direct download needs a separate local media worker.</p>
            </TabsContent>
            <TabsContent value="local" className="pt-3">
              <label className="flex h-[84px] cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-white/12 bg-white/[.02] text-sm text-zinc-400 transition hover:border-[#ff4d2e]/40 hover:bg-[#ff4d2e]/5 hover:text-white">
                <Upload className="size-4" />
                <span className="max-w-[220px] truncate">{localFileName || "Choose MP4, MOV or WebM"}</span>
                <input className="sr-only" type="file" accept="video/*" onChange={handleVideoUpload} />
              </label>
            </TabsContent>
          </Tabs>

          <div className="mt-5">
            <label htmlFor="source-title" className="field-label">Original title</label>
            <Input id="source-title" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} className="studio-input mt-2" />
          </div>

          <Tabs value={editMode} onValueChange={(value) => { setEditMode(value as "ai" | "manual"); setError(""); }} className="mt-5">
            <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-white/[.045] p-1">
              <TabsTrigger value="ai" className="rounded-lg text-xs"><Sparkles /> AI plan</TabsTrigger>
              <TabsTrigger value="manual" className="rounded-lg text-xs"><Scissors /> Manual cut</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="space-y-4 pt-4">
              <div>
                <label className="field-label">AI provider</label>
                <Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
                  <SelectTrigger aria-label="AI provider" className="studio-input mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#17181d] text-zinc-200">
                    <SelectItem value="mock">Mock · fast</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="qwen">Qwen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="transcript" className="field-label">Timestamped transcript</label>
                  <span className="text-[10px] text-zinc-600">{transcript.length.toLocaleString()} chars</span>
                </div>
                <Textarea id="transcript" value={transcript} onChange={(event) => setTranscript(event.target.value)} className="studio-textarea mt-2 min-h-[180px] font-mono text-[12px] leading-5" placeholder="00:00 Transcript..." />
              </div>
              <div>
                <label htmlFor="instruction" className="field-label">Your instruction</label>
                <Textarea id="instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} className="studio-textarea mt-2 min-h-[72px]" placeholder="Ví dụ: bỏ intro, Part 2 mở bằng sự cố..." />
              </div>
              <Button onClick={analyze} disabled={isAnalyzing} className="h-12 w-full rounded-xl bg-[#ff4d2e] font-bold text-white shadow-[0_12px_30px_rgba(255,77,46,.18)] hover:bg-[#ff6247]">
                {isAnalyzing ? <><Loader2 className="animate-spin" /> Building edit plan…</> : <><WandSparkles /> Generate 2-part plan</>}
              </Button>
              <p className="text-center text-[10px] leading-5 text-zinc-600">No key? OpenAI/Qwen falls back to mock mode.</p>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 pt-4">
              <div className="rounded-xl border border-[#ff4d2e]/15 bg-[#ff4d2e]/5 px-3 py-2 text-[11px] leading-5 text-[#ff9a88]">
                Không gọi AI, không cần transcript. Mỗi dòng: <strong>start - end tên đoạn</strong>.
              </div>
              <div>
                <label htmlFor="manual-title-1" className="field-label">Part 1 title</label>
                <Input id="manual-title-1" value={manualPart1Title} onChange={(event) => setManualPart1Title(event.target.value.toUpperCase())} className="studio-input mt-2" />
                <Textarea aria-label="Part 1 timestamp ranges" value={manualPart1Ranges} onChange={(event) => setManualPart1Ranges(event.target.value)} className="studio-textarea mt-2 min-h-[88px] font-mono text-[12px] leading-5" />
              </div>
              <div>
                <label htmlFor="manual-title-2" className="field-label">Part 2 title</label>
                <Input id="manual-title-2" value={manualPart2Title} onChange={(event) => setManualPart2Title(event.target.value.toUpperCase())} className="studio-input mt-2" />
                <Textarea aria-label="Part 2 timestamp ranges" value={manualPart2Ranges} onChange={(event) => setManualPart2Ranges(event.target.value)} className="studio-textarea mt-2 min-h-[88px] font-mono text-[12px] leading-5" />
              </div>
              <Button onClick={applyManualPlan} className="h-12 w-full rounded-xl bg-[#ff4d2e] font-bold text-white shadow-[0_12px_30px_rgba(255,77,46,.18)] hover:bg-[#ff6247]">
                <Scissors /> Apply manual timestamps
              </Button>
              <p className="text-center text-[10px] leading-5 text-zinc-600">Accepted: MM:SS, HH:MM:SS, seconds · ranges must be chronological.</p>
            </TabsContent>
          </Tabs>

          {error && <p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs leading-5 text-red-300">{error}</p>}
        </aside>

        <section className="relative flex min-h-[820px] flex-col items-center overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_50%_38%,rgba(255,77,46,.11),transparent_36%)] px-4 py-7 xl:border-b-0 xl:border-r xl:px-8">
          <div className="mb-5 flex w-full max-w-[520px] items-center justify-between">
            <div>
              <p className="eyebrow">02 / PORTRAIT PREVIEW</p>
              <p className="mt-1 text-xs text-zinc-500">Text safe width 86% · center crop</p>
            </div>
            <div className="flex rounded-xl border border-white/8 bg-black/25 p-1">
              {plan.parts.map((part, index) => (
                <button key={part.id} onClick={() => setActivePartIndex(index)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activePartIndex === index ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}>Part {part.id}</button>
              ))}
            </div>
          </div>

          <div className="relative aspect-[9/16] h-[690px] max-h-[calc(100vh-180px)] max-w-full overflow-hidden rounded-[34px] border border-white/12 bg-[#17191e] shadow-[0_38px_100px_rgba(0,0,0,.55)]">
            {localVideoUrl ? (
              <video className="absolute inset-0 size-full object-cover opacity-50 blur-[22px]" src={localVideoUrl} muted autoPlay loop playsInline />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_46%,#6c3422,transparent_28%),linear-gradient(145deg,#101114_10%,#292024_48%,#0d0e11_80%)]" />
            )}
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-x-[7%] top-[5%] z-10 text-center">
              <p className="social-copy text-[clamp(14px,2.4vh,20px)] leading-[1.12]">{plan.originalTitle.toUpperCase()}</p>
            </div>
            <div className="absolute inset-x-0 top-[24%] z-10 h-[43%] overflow-hidden border-y border-white/15 bg-[#22242a]">
              {localVideoUrl ? (
                <video className="size-full object-cover" src={localVideoUrl} controls playsInline />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(125deg,#111_0%,#572317_42%,#ef6b32_43%,#241716_47%,#0b0c0f_100%)]" />
              )}
              {!localVideoUrl && <button aria-label="Play preview" className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/40 backdrop-blur-md"><Play className="ml-0.5 size-5 fill-white" /></button>}
              <div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[9px] font-bold tracking-[.08em] text-white backdrop-blur-md">COVER · CENTER CROP</div>
            </div>
            <div className="absolute inset-x-[7%] bottom-[11.5%] z-10 text-center">
              <p className="social-copy social-copy-main text-[clamp(24px,4vh,34px)] leading-[1.02]">{activePart.title}</p>
            </div>
            <div className="absolute inset-x-0 bottom-[4.2%] z-10 text-center"><span className="social-copy text-[clamp(17px,2.7vh,23px)]">{activePart.id}/{plan.parts.length}</span></div>
            <div className="absolute bottom-2.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/65" />
          </div>

          <div className="mt-5 grid w-full max-w-[520px] grid-cols-3 gap-2">
            <div className="preview-stat"><span>Source cut</span><strong>{formatTime(durationOf(activePart))}</strong></div>
            <div className="preview-stat accent"><span>After 1.25×</span><strong>{formatTime(finalDurationOf(activePart))}</strong></div>
            <div className="preview-stat"><span>Font preset</span><strong>{fontStack[0]}</strong></div>
          </div>
        </section>

        <aside className="bg-[#0d0e11] p-5 xl:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">03 / EDIT PLAN</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Part {activePart.id}</h2>
            </div>
            <Badge variant="outline" className="border-emerald-400/20 bg-emerald-400/8 text-emerald-300"><Check /> Timeline valid</Badge>
          </div>

          <div className="mt-5">
            <label htmlFor="part-title" className="field-label">New part title</label>
            <Textarea id="part-title" value={activePart.title} onChange={(event) => updatePartTitle(event.target.value.toUpperCase())} className="studio-textarea mt-2 min-h-[72px] text-base font-bold leading-5" />
            <p className="mt-2 text-[11px] leading-5 text-zinc-600">Main hook text · max 3–4 lines · auto wrapped in preview</p>
          </div>

          <div className="mt-5 space-y-2">
            {activePart.segments.map((segment, index) => (
              <article key={`${segment.start}-${segment.end}`} className="group rounded-2xl border border-white/8 bg-white/[.025] p-4 transition hover:border-white/15 hover:bg-white/[.045]">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#ff4d2e]/10 text-xs font-bold text-[#ff6b50]">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-200">{segment.label}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600"><Clock3 className="size-3" /> {formatTime(segment.start)} — {formatTime(segment.end)}</div>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">{segment.reason}</span>
                  <ChevronRight className="size-4 text-zinc-700" />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 bg-[#15161a] p-4">
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-zinc-400"><Scissors className="size-3.5" /> Source-timestamp duration</span><strong>{formatTime(durationOf(activePart))}</strong></div>
            <div className="my-3 h-px bg-white/8" />
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-zinc-400"><Sparkles className="size-3.5 text-[#ff6b50]" /> Final duration at 1.25×</span><strong className="text-[#ff806a]">{formatTime(finalDurationOf(activePart))}</strong></div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-300"><Settings2 className="size-3.5" /> Pipeline</span>
              <Badge variant="outline" className="border-white/10 text-zinc-500">{plan.providerUsed}</Badge>
            </div>
            <ol className="mt-3 space-y-2 text-[11px] text-zinc-500">
              {["Cut source ranges", "Concatenate chronologically", "Build 1080×1920 layout", "Add titles + part number", "Apply video + audio 1.25×"].map((step, index) => (
                <li key={step} className="flex items-center gap-2"><span className="grid size-4 place-items-center rounded-full bg-white/5 text-[9px] text-zinc-600">{index + 1}</span>{step}</li>
              ))}
            </ol>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => downloadJson("edit-plan.json", plan)} className="h-11 rounded-xl border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"><FileJson /> Edit plan</Button>
            <Button onClick={downloadRenderConfig} className="h-11 rounded-xl bg-white font-semibold text-black hover:bg-zinc-200"><Download /> Render config</Button>
          </div>
          <button onClick={() => setPlan(mockPlan({ ...DEFAULT_REQUEST, originalTitle: sourceTitle, transcript, instruction }))} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-xs text-zinc-600 transition hover:text-zinc-300"><RotateCcw className="size-3.5" /> Reset demo plan</button>
          {!isChronological(activePart) && <p className="mt-3 text-xs text-red-300">Timeline is invalid. Regenerate this plan.</p>}
          <p className="mt-3 text-center text-[10px] leading-5 text-zinc-600">The browser exports a complete render manifest. Actual MP4 rendering is handled by the FFmpeg worker.</p>
        </aside>
      </div>
    </main>
  );
}
