export type AiProvider = "mock" | "openai" | "qwen";
export type PlanSource = AiProvider | "manual";

export type Segment = {
  start: number;
  end: number;
  label: string;
  reason: string;
};

export type EditPart = {
  id: number;
  title: string;
  hook: string;
  hashtags: string[];
  segments: Segment[];
};

export type EditPlan = {
  originalTitle: string;
  language: "de" | "en" | "fr" | "ja" | "ko";
  providerUsed: PlanSource;
  parts: EditPart[];
  render: {
    width: 1080;
    height: 1920;
    speed: 1.25;
    preservePitch: true;
    backgroundBlur: 50;
    backgroundOpacity: 50;
  };
};

export type AnalyzeRequest = {
  originalTitle: string;
  transcript: string;
  instruction?: string;
  provider: AiProvider;
};

export const RENDER_PRESET = {
  width: 1080,
  height: 1920,
  speed: 1.25,
  preservePitch: true,
  backgroundBlur: 50,
  backgroundOpacity: 50,
} as const;

export function durationOf(part: EditPart) {
  return part.segments.reduce((total, segment) => total + segment.end - segment.start, 0);
}

export function finalDurationOf(part: EditPart) {
  return durationOf(part) / RENDER_PRESET.speed;
}

export function isChronological(part: EditPart) {
  return part.segments.every((segment, index, list) => {
    if (segment.end <= segment.start) return false;
    if (index === 0) return true;
    return segment.start >= list[index - 1].end;
  });
}

export function normalizePlan(plan: Omit<EditPlan, "providerUsed" | "render">, providerUsed: PlanSource): EditPlan {
  const parts = plan.parts.slice(0, 2).map((part, index) => ({
    ...part,
    id: index + 1,
    hashtags: part.hashtags.slice(0, 7),
    segments: [...part.segments]
      .map((segment) => ({
        ...segment,
        start: Math.max(0, Number(segment.start)),
        end: Math.max(0, Number(segment.end)),
      }))
      .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start)
      .sort((a, b) => a.start - b.start),
  }));

  if (parts.length !== 2 || parts.some((part) => part.segments.length === 0 || !isChronological(part))) {
    throw new Error("AI returned an invalid or non-chronological edit plan.");
  }
  const lastPartOneEnd = parts[0].segments.at(-1)?.end ?? 0;
  const firstPartTwoStart = parts[1].segments[0]?.start ?? 0;
  if (firstPartTwoStart < lastPartOneEnd) {
    throw new Error("Part 2 phải bắt đầu sau segment cuối của Part 1 trên source timeline.");
  }

  return {
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

export function transcriptCues(transcript: string) {
  const matches = [...transcript.matchAll(/(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:\n|\s+-\s+|\s+)([^\n]+)/g)];
  return matches
    .map((match) => ({ at: parseTimestamp(match[1]), text: match[2].trim() }))
    .filter((cue): cue is { at: number; text: string } => cue.at !== null && cue.text.length > 0);
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
      originalTitle: request.originalTitle || "Untitled source video",
      language: "en",
      parts: [
        {
          id: 1,
          title: "THE DETAIL NOBODY EXPECTED",
          hook: chosen[0].text,
          hashtags: ["#shorts", "#videoedit", "#reveal", "#story", "#viral"],
          segments: toSegments(chosen.slice(0, 3), chosen[3].at),
        },
        {
          id: 2,
          title: "THEN EVERYTHING CHANGED",
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
          hashtags: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 7 },
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
              },
              required: ["start", "end", "label", "reason"],
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
  return `Create a 2-part short-video edit plan from the timestamped transcript below.

Hard rules:
- Preserve source chronology inside every part. Never reorder footage.
- Use source timestamps exactly; do not compensate for the final speed-up.
- Remove intros, channel promotion, filler, long music, travel, and unrelated material.
- Each part needs its own strong hook, coherent topic, and payoff.
- Titles and hashtags must use the source video's language (DE, EN, FR, JA, or KO).
- Return exactly two parts and 5-7 hashtags per part.
- Segment start/end values must be seconds as numbers.

Original title: ${request.originalTitle || "Untitled"}
User instruction: ${request.instruction || "No extra instruction"}

Transcript:
${request.transcript.slice(0, 60000)}`;
}
