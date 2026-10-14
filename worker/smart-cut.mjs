import { PLAYBACK_RATE } from '../lib/render-config.mjs';

export function smartCutPlan(plan, { cues = [], silences = [] }, duration) {
  const parts = structuredClone(plan.parts);
  const sentenceEnds = cues.filter((cue) => /[.!?。！？]["”’']?\s*$/u.test(cue.text)).map((cue) => cue.end);
  const sentenceStarts = cues.filter((cue, index) => index === 0 || /[.!?。！？]["”’']?\s*$/u.test(cues[index - 1].text) || cue.start - cues[index - 1].end >= 0.2).map((cue) => cue.start);
  const candidates = [...silences.map(({ start, end }) => (start + end) / 2), ...sentenceEnds, ...sentenceStarts];
  const snap = (target, low, high) => {
    if (silences.some((range) => target >= range.start && target <= range.end)) return target;
    const closest = candidates.filter((time) => time >= low && time <= high && Math.abs(time - target) <= 2.5).sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)[0];
    return closest ?? target;
  };
  for (const [index, part] of parts.entries()) {
    if (part.smartCutApplied) continue;
    const main = part.segments.filter((segment) => !segment.isPadding);
    const first = main[0], last = main.at(-1);
    const nextStart = parts[index + 1]?.segments[0]?.start ?? duration;
    const previousEnd = index ? parts[index - 1].segments.filter((segment) => !segment.isPadding).at(-1).end : 0;
    // Prefer a complete nearby utterance; never bring back footage before the AI hook.
    const start = snap(first.start, Math.max(previousEnd, first.start - 1), Math.min(first.end - 0.05, first.start + 2.5));
    const end = snap(last.end, Math.max(last.start + 0.05, last.end - 2.5), Math.min(nextStart, last.end, duration));
    const oldDuration = part.segments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
    const newDuration = oldDuration + first.start - start + end - last.end;
    // Preserve the existing >60s rule. If uncertain/too short, retain the AI window.
    if (["manual", "mock"].includes(plan.providerUsed) || newDuration / PLAYBACK_RATE > 60) { first.start = start; last.end = end; }
    part.smartCutApplied = true;
  }
  return { ...plan, parts };
}
