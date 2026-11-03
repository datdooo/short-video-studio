// Manual-web TXT v24 helpers: compact numeric series, safe cut points and a fused time map.
// Pure functions over already-collected evidence; no I/O, no content is invented.
export const TXT_SIGNALS_VERSION = "txt-signals-v1";

const finite = (value) => Number.isFinite(value);
const round = (value, digits) => Number(Number(value).toFixed(digits));

/**
 * Columnar encoding of evenly stepped [{start,end,<key>}] rows. Rows that are not contiguous
 * (local signals sample only part of a long source) become separate runs, so coverage gaps stay
 * visible instead of being filled. Returns null when the step is not constant.
 */
export function compactSeries(rows, key, { digits = 3 } = {}) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const step = rows[0].end - rows[0].start;
  if (!(step > 0) || !finite(step)) return null;
  const runs = [];
  let run = null;
  for (const row of rows) {
    if (![row.start, row.end, row[key]].every(finite) || Math.abs(row.end - row.start - step) > 1e-3) return null;
    if (!run || Math.abs(row.start - (run.start + run.values.length * step)) > 1e-2) {
      run = { start: round(row.start, 3), values: [] };
      runs.push(run);
    }
    run.values.push(round(row[key], digits));
  }
  return { key, step: round(step, 3), runs };
}

/** Inverse of compactSeries for tests and callers that need the original rows. */
export function expandSeries(series) {
  return series.runs.flatMap((run) =>
    run.values.map((value, index) => ({
      start: round(run.start + index * series.step, 3),
      end: round(run.start + (index + 1) * series.step, 3),
      [series.key]: value,
    })),
  );
}

const SENTENCE_END = /[.!?…。！？]["'”’)\]]*\s*$/u;

/**
 * Places where a cut does not split speech: a cue that ends a sentence (S), a real pause before the
 * next cue (P) or a cue end inside measured silence (Q). Auto captions often have no punctuation,
 * so pauses and silences matter more than commas. Encoded as "cue-41@123.4:SP" to stay small.
 */
export function buildCutPoints(cues, silences = [], { minGap = 0.5 } = {}) {
  const points = [];
  const quiet = (time) => silences.some((silence) => finite(silence.start) && finite(silence.end) && time >= silence.start - 0.05 && time <= silence.end + 0.05);
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index], next = cues[index + 1];
    if (!finite(cue.end)) continue;
    let kinds = "";
    if (SENTENCE_END.test(String(cue.text || ""))) kinds += "S";
    if (next && finite(next.start) && next.start - cue.end >= minGap) kinds += "P";
    if (quiet(cue.end)) kinds += "Q";
    if (kinds) points.push(`${cue.cueId}@${round(cue.end, 1)}:${kinds}`);
  }
  return points;
}

/**
 * One row per time bin, fused from the channels that are actually present. Missing channels are
 * omitted (never zero-filled) so absence is not read as a low score.
 */
export function buildTimeMap({ duration, cues = [], audioActivity = [], silences = [], visualActivity = [], commentTimes = [], replayBins = [], binSeconds }) {
  if (!finite(duration) || duration <= 0) return null;
  const bin = binSeconds || (duration <= 600 ? 5 : duration <= 2400 ? 10 : 20);
  const count = Math.ceil(duration / bin);
  const rows = Array.from({ length: count }, () => ({ speech: 0, quiet: 0, audio: [], visual: [], comments: 0 }));
  const at = (time) => Math.min(count - 1, Math.max(0, Math.floor(time / bin)));
  for (const cue of cues) {
    if (!finite(cue.start) || !finite(cue.end)) continue;
    const length = String(cue.text || "").replace(/\s+/g, "").length;
    const span = Math.max(0.001, cue.end - cue.start);
    for (let index = at(cue.start); index <= at(cue.end - 1e-6); index += 1) {
      const overlap = Math.min(cue.end, (index + 1) * bin) - Math.max(cue.start, index * bin);
      if (overlap > 0) rows[index].speech += (length * overlap) / span;
    }
  }
  for (const silence of silences) {
    if (!finite(silence.start) || !finite(silence.end)) continue;
    for (let index = at(silence.start); index <= at(silence.end - 1e-6); index += 1)
      rows[index].quiet += Math.max(0, Math.min(silence.end, (index + 1) * bin) - Math.max(silence.start, index * bin));
  }
  for (const row of audioActivity) if (finite(row.start) && finite(row.activity)) rows[at(row.start)].audio.push(row.activity);
  for (const row of visualActivity) if (finite(row.start) && finite(row.change)) rows[at(row.start)].visual.push(row.change);
  for (const time of commentTimes) if (finite(time) && time >= 0 && time < duration) rows[at(time)].comments += 1;
  const hasAudio = audioActivity.length > 0, hasVisual = visualActivity.length > 0;
  const replayAt = (time) => replayBins.find((b) => finite(b.start) && finite(b.end) && time >= b.start && time < b.end);
  const map = {
    version: TXT_SIGNALS_VERSION,
    binSeconds: bin,
    // Parallel arrays: index i covers [i*binSeconds, (i+1)*binSeconds).
    speechCharsPerSecond: rows.map((row) => round(row.speech / bin, 1)),
    // Measured only where audio was actually sampled; unsampled bins are null, never zero.
    ...(hasAudio ? { quietRatio: rows.map((row) => (row.audio.length ? round(Math.min(1, row.quiet / bin), 2) : null)) } : {}),
    ...(hasAudio ? { audioActivity: rows.map((row) => (row.audio.length ? round(row.audio.reduce((a, b) => a + b, 0) / row.audio.length, 2) : null)) } : {}),
    ...(hasVisual ? { sceneChange: rows.map((row) => (row.visual.length ? round(row.visual.reduce((a, b) => a + b, 0), 2) : null)) } : {}),
    ...(commentTimes.length ? { commentTimestampMentions: rows.map((row) => row.comments) } : {}),
    ...(replayBins.length ? { replayIntensity: rows.map((_, index) => { const hit = replayAt(index * bin + bin / 2); return hit ? round(hit.intensity ?? 0, 2) : null; }) } : {}),
  };
  return map;
}

/** Plain statement of which channels exist for this source, so absence is never read as a score. */
export function availabilityNote(channels) {
  const present = [], missing = [];
  for (const [name, has] of Object.entries(channels)) (has ? present : missing).push(name);
  return { present, missing, policy: "Missing channels are unavailable data, not low scores or negative evidence." };
}

const seconds = (ms) => (finite(ms) ? ms / 1000 : NaN);

/**
 * Applies the v24 TXT shape to a collected evidence object: lossless columnar replay samples,
 * 3-decimal numeric series, cut points, a fused time map and an availability note.
 * Original cue text, ids and timestamps are never changed.
 */
export function compactTxtEvidence(evidence, { duration }) {
  const out = structuredClone(evidence);
  const notes = [];
  const audio = out.audio?.data, visual = out.visual?.data;
  const audioRows = Array.isArray(audio?.activity) ? audio.activity : [];
  const visualRows = Array.isArray(visual?.activity) ? visual.activity : [];
  const silences = Array.isArray(audio?.silences) ? audio.silences : [];
  const cues = Array.isArray(out.transcript?.cues) ? out.transcript.cues : [];
  const replay = out.replay;
  const replayBins = Array.isArray(replay?.bins)
    ? replay.bins.map((bin) => ({ start: seconds(bin.startMs), end: seconds(bin.endMs), intensity: bin.intensity })).filter((bin) => finite(bin.start) && finite(bin.end))
    : [];
  const commentTimes = (out.comments?.items || []).flatMap((item) =>
    (item.timestampMentions || []).map((mention) => (finite(mention) ? mention : finite(mention?.seconds) ? mention.seconds : seconds(mention?.timestampMs ?? mention?.ms))),
  );
  const timeMap = buildTimeMap({ duration, cues, audioActivity: audioRows, silences, visualActivity: visualRows, commentTimes, replayBins });
  const cutPoints = buildCutPoints(cues, silences);
  for (const [data, key, name] of [[audio, "activity", "audio.data.activity"], [visual, "change", "visual.data.activity"]]) {
    const series = data && compactSeries(data.activity, key);
    if (series) {
      data.activity = series;
      notes.push(`${name}: columnar {key, step, runs:[{start, values[]}]}; each run is contiguous, value i covers [start+i*step, start+(i+1)*step); gaps between runs are NOT sampled (local signals cover only part of long sources); values rounded to 3 decimals.`);
    }
  }
  if (Array.isArray(replay?.sourceSamples) && replay.sourceSamples.length) {
    const rows = replay.sourceSamples;
    const index = (sample) => replayBins.findIndex((bin) => Math.round(bin.start * 1000) === sample.binStartMs);
    replay.sourceSamples = {
      sourceTime: rows.map((sample) => sample.sourceTime),
      intensity: rows.map((sample) => sample.intensity),
      binIndex: rows.map(index),
    };
    notes.push("replay.sourceSamples: columnar {sourceTime[], intensity[], binIndex[]}; binIndex points into replay.bins (-1 = no bin), lossless.");
  }
  out.cutPoints = cutPoints;
  if (timeMap) out.timeMap = timeMap;
  out.signalAvailability = availabilityNote({
    captions: cues.length > 0, audioSignals: audioRows.length > 0, visualSignals: visualRows.length > 0,
    comments: (out.comments?.items || []).length > 0, mostReplayed: replayBins.length > 0, chapters: (out.chapters || []).length > 0,
  });
  out.txtFormat = {
    version: TXT_SIGNALS_VERSION,
    notes,
    cutPoints: "Strings \"cueId@endSecond:flags\"; flags S = cue ends a sentence, P = pause of at least 0.5 s follows, Q = cue ends inside measured silence. Prefer them for main and teaser boundaries; a boundary elsewhere must be justified by the cited cues.",
    timeMap: "Parallel arrays per time bin; null/omitted means the channel is unavailable, not low.",
  };
  return out;
}
