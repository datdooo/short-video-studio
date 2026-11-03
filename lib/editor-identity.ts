import type { EditPlan } from "./edit-plan";
import type { CaptionTrack } from "./subtitles.mjs";
export function webAiEditorSignature(
  plan: Pick<EditPlan, "originalTitle" | "parts" | "providerUsed">,
  cues: CaptionTrack["cues"],
) {
  return JSON.stringify(
    {
      version: 2,
      title: plan.originalTitle,
      providerUsed: plan.providerUsed,
      parts: plan.parts.map((part) => ({
        id: part.id,
        title: part.title,
        hook: part.hook,
        mainEdited: part.mainEdited === true,
        manualLocked: part.manualLocked === true,
        teaserEnabled: part.teaserEnabled !== false,
        segments: part.segments.map(({ start, end, isPadding, label, reason }) => ({
          start,
          end,
          isPadding: isPadding === true,
          label,
          reason,
        })),
      })),
      cues: cues.map((cue) => ({ start: cue.start, end: cue.end, text: cue.text, timing: cue.timing || "cue" })),
      manualTeasers: plan.parts.map((part) =>
        (part.teaser?.status === "selected" && part.teaser.selection === "manual") ||
        part.customTeaser?.mode === "timestamp"
          ? {
              id: part.id,
              teaser:
                part.teaser?.status === "selected" && part.teaser.selection === "manual"
                  ? { start: part.teaser.start, end: part.teaser.end, manualSourceId: part.teaser.manualSourceId }
                  : undefined,
              customTeaser: part.customTeaser?.mode === "timestamp" ? part.customTeaser : undefined,
            }
          : null,
      ),
    },
    (_key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, value[key]]),
          )
        : value,
  );
}
