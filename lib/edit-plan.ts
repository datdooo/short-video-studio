import {EXPLANATION_INSTRUCTIONS} from './explanation-language.mjs';
import { trimPartStart } from "../worker/part-start.mjs";
import { PLAYBACK_RATE, FOREGROUND_SCALE, timelineDuration, isStillSegment } from "./render-config.mjs";
import { resolvePlanVisualStyle } from "./visual-style/normalize.mjs";
import type { VisualStyle } from "./visual-style/types";
import type { CaptionTrack } from "./subtitles.mjs";
import { transcriptCues } from "./subtitles.mjs";
export { transcriptCues };
import { presentationDuration, validateTeaser, TEASER_POLICY } from "./teaser-hooks.mjs";

export type AiProvider = "mock" | "chatgpt" | "gemini" | "muse" | "openai" | "qwen";
export type PlanSource = AiProvider | "manual" | "deterministic";

export type Segment = {
  type?: "source" | "summary_card" | "freeze";
  holdDuration?: number;
  text?: string;
  focus?: { scale: number };
  start: number;
  end: number;
  label: string;
  reason: string;
  isPadding?: boolean;
};

export type EditPart = {
  aiMainRanges?: import('./main-ranges.mjs').AiMainRanges;
  mainEdited?: boolean;
  teaserNeedsReselection?: boolean;
  customTeaser?: import("./custom-teaser.mjs").CustomTeaser;
  manualLocked?: boolean;
  teaser?: import("./teaser-hooks.mjs").Teaser;
  startTrimApplied?: boolean;
  smartCutApplied?: boolean;
  id: number;
  title: string;
  hook: string;
  hashtags: string[];
  segments: Segment[];
};

export type EditPlan = {
  hookTransition?: "rainbow-light-leak" | "vr-light-leak-v2"|"dip-black"|"flash-white"|"none";
  music?: import("./music/settings.mjs").MusicSettings;
  musicSpeech?: import("./music/settings.mjs").SpeechActivity;
  analysis?: import("./auto-cut/main-content.mjs").MainAnalysis;
  teaserPolicy?: "per-part-v1";
  visualStyle?: VisualStyle;
  subtitles?: import("./subtitles.mjs").SubtitleStyle;
  captionCues?: CaptionTrack;
  originalTitle: string;
  language: "de" | "en" | "fr" | "ja" | "ko";
  providerUsed: PlanSource;
  parts: EditPart[];
  render: {
    width: 1080;
    height: 1920;
    speed: 1.25;
    foregroundScale?: 1.25;
    preservePitch: true;
    backgroundBlur: 50;
    backgroundOpacity: 50;
  };
};

export type AnalyzeRequest = {
  originalTitle: string;
  transcript: string;
  instruction?: string;
  supplementalPrompt?: string;
  sourceDuration?: number;
  provider: AiProvider;
};

export const RENDER_PRESET = {
  width: 1080,
  height: 1920,
  speed: PLAYBACK_RATE,
  foregroundScale: FOREGROUND_SCALE,
  preservePitch: true,
  backgroundBlur: 50,
  backgroundOpacity: 50,
} as const;

export function durationOf(part: EditPart) {
  return timelineDuration(part.segments);
}

export function finalDurationOf(part: EditPart) {
  return presentationDuration(part) / RENDER_PRESET.speed;
}

export function isChronological(part: EditPart) {
  let paddingStarted = false;
  let previousEnd = 0;
  let mainCount = 0;
  return part.segments.every((segment) => {
    if (isStillSegment(segment)) return Number.isFinite(segment.start) && segment.start >= 0 && segment.end === segment.start && Number.isFinite(segment.holdDuration) && Number(segment.holdDuration) > 0;
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.start < 0 || segment.end <= segment.start) return false;
    if (segment.isPadding) { paddingStarted = true; return mainCount > 0; }
    if (paddingStarted || segment.start < previousEnd) return false;
    previousEnd = segment.end; mainCount += 1;
    return true;
  }) && mainCount > 0;
}

export function normalizePlan(plan: Omit<EditPlan, "providerUsed" | "render">, providerUsed: PlanSource): EditPlan {
  if (plan.teaserPolicy !== undefined && plan.teaserPolicy !== TEASER_POLICY) throw new Error("Invalid teaser policy.");
  let parts = plan.parts.slice(0, 2).map((part, index) => ({
    ...part,
    id: index + 1,
    hashtags: [...new Set(part.hashtags.map((tag) => `#${tag.trim().replace(/^#+/, "").replace(/\s+/g, "")}`).filter((tag) => tag.length > 1))].slice(0, 10),
    segments: [...part.segments]
      .map((segment) => ({
        ...segment,
        start: Math.max(0, Number(segment.start)),
        end: Math.max(0, Number(segment.end)),
      }))
      .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start),
  }));

  if (parts.length !== 2 || parts.some((part) => part.segments.length === 0 || !isChronological(part))) {
    throw new Error("AI returned an invalid or non-chronological edit plan.");
  }
  if (!["mock", "manual"].includes(providerUsed) && parts.some((part) => part.hashtags.length !== 10)) {
    throw new Error("AI chưa trả về đủ 10 hashtag khác nhau cho mỗi part. Hãy Generate lại.");
  }
  if (!["mock", "manual"].includes(providerUsed)) parts = parts.map(trimPartStart);
  parts.forEach((part) => validateTeaser(part));
  if (!["mock", "manual"].includes(providerUsed) && parts.some((part) => durationOf(part) / PLAYBACK_RATE <= 60)) {
    throw new Error("Mỗi part phải trên 1 phút sau bỏ 1 giây đầu và tua 1.25×: cần hơn 76 giây footage gốc. Nếu nội dung chính ngắn, yêu cầu AI chọn footage thật phù hợp và thêm segment isPadding: true ở cuối để đủ thời lượng.");
  }
  const lastPartOneEnd = parts[0].segments.filter((segment) => !segment.isPadding).at(-1)?.end ?? 0;
  const firstPartTwoStart = parts[1].segments[0]?.start ?? 0;
  if (firstPartTwoStart < lastPartOneEnd) {
    throw new Error("Part 2 phải bắt đầu sau segment cuối của Part 1 trên source timeline.");
  }

  return {
    ...(plan.hookTransition ? {hookTransition:plan.hookTransition} : {}),
    ...(plan.music ? {music:structuredClone(plan.music)} : {}),
    ...(plan.musicSpeech ? {musicSpeech:structuredClone(plan.musicSpeech)} : {}),
    ...(plan.analysis ? { analysis: structuredClone(plan.analysis) } : {}),
    ...(plan.teaserPolicy ? { teaserPolicy: plan.teaserPolicy } : {}),
    visualStyle: resolvePlanVisualStyle(plan),
    originalTitle: plan.originalTitle,
    language: plan.language,
    providerUsed,
    parts,
    render: RENDER_PRESET,
  };
}

export function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return hours > 0
    ? [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":")
    : [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function parseTimestamp(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

export function parseManualRanges(value: string) {
  const lines = value.split(/\n|,/).map((line) => line.trim()).filter(Boolean);
  const segments = lines.map((line, index) => {
    const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?|\d+(?:\.\d+)?)\s*(?:-|–|—|→)\s*(\d{1,2}:\d{2}(?::\d{2})?|\d+(?:\.\d+)?)(?:\s+(.+))?$/);
    if (!match) throw new Error(`Range ${index + 1} không đúng format: “${line}”.`);
    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    if (start === null || end === null || end <= start) throw new Error(`Range ${index + 1} có timestamp không hợp lệ.`);
    return {
      start,
      end,
      label: match[3]?.trim() || `Manual cut ${index + 1}`,
      reason: "Manual selection",
    };
  });
  if (segments.length === 0) throw new Error("Mỗi Part cần ít nhất một timestamp range.");
  if (!segments.every((segment, index) => index === 0 || segment.start >= segments[index - 1].end)) {
    throw new Error("Các range phải theo đúng thứ tự source và không được chồng nhau.");
  }
  return segments;
}

export function manualPlan(input: {
  originalTitle: string;
  part1Title: string;
  part1Ranges: string;
  part2Title: string;
  part2Ranges: string;
}): EditPlan {
  return normalizePlan(
    {
      originalTitle: input.originalTitle || "Untitled source video",
      language: "en",
      parts: [
        {
          id: 1,
          title: input.part1Title || "PART 1",
          hook: "Manual selection",
          hashtags: [],
          segments: parseManualRanges(input.part1Ranges),
        },
        {
          id: 2,
          title: input.part2Title || "PART 2",
          hook: "Manual selection",
          hashtags: [],
          segments: parseManualRanges(input.part2Ranges),
        },
      ],
    },
    "manual",
  );
}

export function mockPlan(request: AnalyzeRequest): EditPlan {
  const cues = transcriptCues(request.transcript);
  const fallback = [
    { at: 72, text: "The story begins" },
    { at: 108, text: "First important detail" },
    { at: 156, text: "The reveal" },
    { at: 232, text: "A new problem appears" },
    { at: 284, text: "The turning point" },
    { at: 342, text: "Final result" },
  ];
  const source = cues.length >= 6 ? cues : fallback;
  const chosen = [source[0], source[Math.floor(source.length * 0.2)], source[Math.floor(source.length * 0.4)], source[Math.floor(source.length * 0.55)], source[Math.floor(source.length * 0.75)], source[source.length - 1]];
  const toSegments = (partCues: Array<{ at: number; text: string }>, partEnd?: number) => partCues.map((cue, index) => {
    const desiredEnd = cue.at + 28 + (index % 3) * 7;
    const nextStart = partCues[index + 1]?.at ?? partEnd;
    return {
      start: cue.at,
      end: nextStart === undefined ? desiredEnd : Math.max(cue.at + 1, Math.min(desiredEnd, nextStart)),
      label: cue.text.slice(0, 72),
      reason: index % 3 === 0 ? "Strong hook" : index % 3 === 1 ? "Key context" : "Payoff",
    } satisfies Segment;
  });

  return normalizePlan(
    {
      originalTitle: request.originalTitle || "YOUR STORY STARTS HERE",
      language: "en",
      parts: [
        {
          id: 1,
          title: "THE MOMENT THAT MATTERS",
          hook: chosen[0].text,
          hashtags: ["#shorts", "#videoedit", "#reveal", "#story", "#viral"],
          segments: toSegments(chosen.slice(0, 3), chosen[3].at),
        },
        {
          id: 2,
          title: "SEE HOW THE STORY ENDS",
          hook: chosen[3].text,
          hashtags: ["#shorts", "#videoedit", "#transformation", "#result", "#viral"],
          segments: toSegments(chosen.slice(3, 6)),
        },
      ],
    },
    "mock",
  );
}

export const EDIT_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    originalTitle: { type: "string" },
    language: { type: "string", enum: ["de", "en", "fr", "ja", "ko"] },
    parts: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "number" },
          title: { type: "string" },
          hook: { type: "string" },
          hashtags: { type: "array", items: { type: "string" }, minItems: 10, maxItems: 10 },
          segments: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                start: { type: "number" },
                end: { type: "number" },
                label: { type: "string" },
                reason: { type: "string" },
                isPadding: { type: "boolean" },
              },
              required: ["start", "end", "label", "reason", "isPadding"],
            },
          },
        },
        required: ["id", "title", "hook", "hashtags", "segments"],
      },
    },
  },
  required: ["originalTitle", "language", "parts"],
} as const;

export function buildPrompt(request: AnalyzeRequest) {
  return `${EXPLANATION_INSTRUCTIONS}
Create a 2-part video edit plan from the complete timestamped transcript below, following the user's editing instructions.

Hard rules:
- Preserve source chronology for the MAIN content inside every part. The only exception is explicitly marked supplemental footage appended at the very end to meet the minimum duration; never insert it into the main story.
- Use source timestamps exactly; do not compensate for the final speed-up.
- Follow the user's rules for what may be cut. Do not remove slow material, travel, music, technical details, or filler unless the user permits it.
- Automatically identify and exclude credits, unrelated advertising, sponsorship/promotional passages, channel introductions, channel self-promotion, and calls to like/subscribe/follow in BOTH parts, even without an explicit user request. Explain excluded gaps in segment reasons. Preserve the main story, compelling events and natural continuity. A brand or product name alone is NOT grounds for removing substantive content (repairs, tests, reviews, results); cut only actual promotional/unrelated passages. These exclusions do not authorize shortening slow but relevant main content.
- Each part needs its own strong hook. Quote the actual transcript in the hook field.
- Titles and hashtags must use the source video's language (DE, EN, FR, JA, or KO).
- Return exactly two parts and exactly 10 distinct hashtags per part, each prefixed with # and without spaces. Include a balanced mix of content-specific tags, broader subject/category tags, and relevant trending/discovery tags in the source language and market. All tags must relate to the retained content; do not invent trends or claim verified live popularity. Avoid discarded footage and unrelated topics.
- The app removes exactly 1 source second from the beginning of each part, once, before the final 1.25x speed-up. Return the original hook timestamps; do NOT shift them yourself. Account for this cut when checking duration: retained footage must exceed 76 seconds so the FINAL exported duration stays strictly greater than 60 seconds at 1.25x.
- Segment start/end values must be seconds as numbers.
- Each part's FINAL exported duration must be strictly greater than 60 seconds at 1.25x after removing its first source second. The sum of segment durations (including supplemental footage) must therefore exceed 76 seconds per part, excluding removed gaps. First choose hooks that meet the minimum naturally. If a part or the source is too short, select a relevant real clip from anywhere in this source (prefer contextual action, visual detail, soundcheck or a recap; avoid ads/promotions) and append it at the END. You may reuse/repeat that actual clip if needed. Set isPadding: true on every appended segment; set isPadding: false on MAIN segments. Explain the choice and repetition in reason. Main segments must all precede padding segments. Do not invent speech, facts, timestamps outside the source, or fake new footage. Keep titles/hashtags factual, based on real content.
- For the two-entry-point workflow: Part 1 MAIN content spans Hook 1 to Hook 2, and Part 2 MAIN content spans Hook 2 to the source duration. Keep these ranges continuous except for explicitly permitted promotional cuts. Use multiple retained MAIN segments only around those cuts and explain each excluded gap in the adjacent segment reason. The first/last MAIN segment boundaries represent each part's source start/end; padding is appended afterwards.

Original title: ${request.originalTitle || "Untitled"}
Source duration in seconds: ${request.sourceDuration ?? "unknown; do not invent an end beyond the available source"}
User instruction: ${request.instruction || "No extra instruction"}${request.supplementalPrompt?.trim() ? `\n\nAdditional user editing requirements:\n${request.supplementalPrompt.trim()}` : ""}

Transcript:
${request.transcript}`;
}
