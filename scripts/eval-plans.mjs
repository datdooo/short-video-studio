#!/usr/bin/env node
// Read-only structural evaluation of saved plans (batch history). No AI, no transcript text in output.
//   node scripts/eval-plans.mjs [dataRoot] [--json out.json]
// Metrics are structural proxies, NOT a measure of AI "quality": they show how often boundaries respect
// speech, how much the user edited the AI's main/teaser, and whether teasers meet the duration policy.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { PLAYBACK_RATE } from "../lib/render-config.mjs";
import { hookDurationLimits } from "../lib/teaser-hooks.mjs";
import { buildCutPoints } from "../lib/txt-signals.mjs";

const args = process.argv.slice(2);
const jsonIndex = args.indexOf("--json");
const jsonOut = jsonIndex >= 0 ? args.splice(jsonIndex, 2)[1] : null;
const dataRoot = args[0] || path.join(homedir(), "Library", "Application Support", "ShortCut Studio", "media");
const history = JSON.parse(readFileSync(path.join(dataRoot, "batch-history.json"), "utf8"));
const limits = hookDurationLimits(PLAYBACK_RATE);
const TOLERANCE = 0.35;

const median = (values) => (values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : null);
const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);

function cutTimes(cues) {
  const silences = [];
  const points = buildCutPoints(cues, silences);
  const ends = new Set(points.map((p) => Number(/@([\d.]+):/.exec(p)[1])));
  const starts = new Set();
  const byId = new Map(cues.map((cue) => [cue.cueId, cue]));
  for (const point of points) {
    const id = /^(.*)@/.exec(point)[1];
    const index = cues.indexOf(byId.get(id));
    if (cues[index + 1]) starts.add(cues[index + 1].start);
  }
  return { ends: [...ends], starts: [...starts] };
}
const near = (time, list) => list.some((value) => Math.abs(value - time) <= TOLERANCE);
function classify(time, cues, cuts) {
  if (near(time, cuts.ends) || near(time, cuts.starts)) return "clean";
  for (const cue of cues) if (time > cue.start + TOLERANCE && time < cue.end - TOLERANCE) return "midCue";
  return "between"; // between cues but not a flagged cut point
}
function union(ranges) {
  const sorted = ranges.filter((r) => r.end > r.start).map((r) => ({ start: r.start, end: r.end })).sort((a, b) => a.start - b.start);
  const out = [];
  for (const range of sorted) {
    if (out.length && range.start <= out.at(-1).end) out.at(-1).end = Math.max(out.at(-1).end, range.end);
    else out.push({ ...range });
  }
  return out;
}
const total = (ranges) => ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
function intersection(a, b) {
  let seconds = 0;
  for (const x of a) for (const y of b) seconds += Math.max(0, Math.min(x.end, y.end) - Math.max(x.start, y.start));
  return seconds;
}

const groups = new Map();
const group = (name) => {
  if (!groups.has(name)) groups.set(name, { jobs: 0, parts: 0, boundaries: { clean: 0, midCue: 0, between: 0 }, mainEdited: [], teaserParts: 0, teaserManual: 0, teaserBad: 0, teaserInEarlyMain: 0, coverage: [], noCues: 0 });
  return groups.get(name);
};
for (const job of history.jobs) {
  const plan = job.plan;
  if (!plan?.parts?.length) continue;
  const g = group(plan.providerUsed || "unknown");
  g.jobs += 1;
  const track = plan.captionCues && typeof plan.captionCues === "object" ? plan.captionCues : {};
  const cues = (Array.isArray(track.cues) ? track.cues : []).filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.end));
  if (!cues.length) g.noCues += 1;
  const cuts = cutTimes(cues);
  for (const part of plan.parts) {
    g.parts += 1;
    const kept = union((part.segments || []).filter((s) => !s.isPadding));
    if (cues.length)
      for (const segment of kept)
        for (const time of [segment.start, segment.end]) {
          if (time < 0.5) continue;
          g.boundaries[classify(time, cues, cuts)] += 1;
        }
    const ai = union(Array.isArray(part.aiMainRanges?.ranges) ? part.aiMainRanges.ranges : []);
    if (ai.length) {
      const overlap = intersection(ai, kept);
      const unionSeconds = total(ai) + total(kept) - overlap;
      g.mainEdited.push(unionSeconds ? 1 - overlap / unionSeconds : 0);
    }
    const teaser = part.teaser;
    if (teaser && Number.isFinite(teaser.start) && Number.isFinite(teaser.end) && teaser.status !== "unavailable") {
      g.teaserParts += 1;
      if (teaser.selection === "manual") g.teaserManual += 1;
      const rendered = (teaser.end - teaser.start) / PLAYBACK_RATE;
      if (rendered < limits.minRenderedSeconds - 1e-6 || rendered > limits.maxRenderedSeconds + 1e-6) g.teaserBad += 1;
      // Policy: the first 10 rendered main seconds are excluded from teaser sourcing.
      let rendering = 0, early = false;
      for (const segment of kept) {
        const seconds = segment.end - segment.start;
        if (teaser.start >= segment.start && teaser.start < segment.end && rendering + (teaser.start - segment.start) / PLAYBACK_RATE < 10) early = true;
        rendering += seconds / PLAYBACK_RATE;
      }
      if (early) g.teaserInEarlyMain += 1;
    }
    const duration = track.sourceDuration;
    if (duration) g.coverage.push(total(kept) / duration);
  }
}

const rows = [...groups.entries()].map(([provider, g]) => {
  const b = g.boundaries, n = b.clean + b.midCue + b.between;
  return {
    provider, jobs: g.jobs, parts: g.parts, jobsWithoutCues: g.noCues,
    boundaries: n, cleanPct: pct(b.clean, n), midCuePct: pct(b.midCue, n), betweenPct: pct(b.between, n),
    mainEditedMedianPct: g.mainEdited.length ? Math.round(1000 * median(g.mainEdited)) / 10 : null, mainEditedParts: g.mainEdited.length,
    teaserParts: g.teaserParts, teaserManualPct: pct(g.teaserManual, g.teaserParts), teaserOutOfPolicyPct: pct(g.teaserBad, g.teaserParts),
    teaserInFirst10sPct: pct(g.teaserInEarlyMain, g.teaserParts),
    mainCoverageMedianPct: g.coverage.length ? Math.round(1000 * median(g.coverage)) / 10 : null,
  };
});
const out = { tolerance: TOLERANCE, teaserLimits: { minRenderedSeconds: limits.minRenderedSeconds, maxRenderedSeconds: limits.maxRenderedSeconds }, rows };
console.log(JSON.stringify(out, null, 2));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 2));
