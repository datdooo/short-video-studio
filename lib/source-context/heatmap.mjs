// yt-dlp start_time/end_time are source seconds; value is already relative 0..1.
// No min/max rescaling, interpolation, viewer-count or retention inference.
export const MAX_HEATMAP_BINS = 2000;
export const MAX_HEATMAP_SCAN = 4000;
const reasons = new Set(['not-provided', 'empty', 'malformed', 'unknown-duration', 'unsupported-source', 'provider-unsupported', 'retrieval-timeout', 'extraction-failed', 'invalid-serialized']);
const durationValid = n => Number.isSafeInteger(n) && n > 0;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const intervalValid = (v, durationMs) => object(v) && Number.isSafeInteger(v.startMs) && Number.isSafeInteger(v.endMs)
  && v.startMs >= 0 && v.endMs > v.startMs && v.endMs <= durationMs && Number.isFinite(v.intensity) && v.intensity >= 0 && v.intensity <= 1;
function envelope(status, bins, options, reason, fields = {}) {
  return { status, ...(reason ? { reason } : {}), timeline: 'source', timeUnit: 'ms', intensitySemantics: 'relative-replay-interest', bins,
    provenance: { source: options.source || 'yt-dlp-heatmap', extractedAt: options.extractedAt || new Date().toISOString(), fields } };
}
export function heatmapUnavailable(reason = 'not-provided', options = {}) {
  return envelope(reason === 'unsupported-source' ? 'disabled' : 'unavailable', [], options, reasons.has(reason) ? reason : 'extraction-failed');
}
export function normalizeHeatmap(raw, options = {}) {
  if (options.enabled === false) return heatmapUnavailable('unsupported-source', options);
  if (raw === undefined || raw === null) return heatmapUnavailable('not-provided', options);
  if (!Array.isArray(raw)) return heatmapUnavailable('malformed', options);
  if (!durationValid(options.durationMs)) return heatmapUnavailable('unknown-duration', options);
  if (!raw.length) return heatmapUnavailable('empty', options);
  let dropped = 0, clipped = 0, duplicates = 0, overlaps = 0;
  const candidates = [];
  for (const item of raw.slice(0, MAX_HEATMAP_SCAN)) {
    if (!object(item) || !Number.isFinite(item.start_time) || !Number.isFinite(item.end_time) || !Number.isFinite(item.value)
      || item.start_time < 0 || item.end_time <= item.start_time || item.value < 0 || item.value > 1) { dropped++; continue; }
    const startMs = Math.round(item.start_time * 1000), rawEnd = Math.round(item.end_time * 1000);
    const endMs = Math.min(rawEnd, options.durationMs), bin = { startMs, endMs, intensity: item.value };
    if (!Number.isSafeInteger(rawEnd) || !intervalValid(bin, options.durationMs)) { dropped++; continue; }
    if (rawEnd > endMs) clipped++;
    candidates.push(bin);
  }
  // Exact interval duplicates keep their strongest reported relative value.
  candidates.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || b.intensity - a.intensity);
  const bins = [];
  for (const bin of candidates) {
    const previous = bins.at(-1);
    if (previous && previous.startMs === bin.startMs && previous.endMs === bin.endMs) { duplicates++; continue; }
    // Keep the first chronological non-overlapping bin; never manufacture merged intervals.
    if (previous && bin.startMs < previous.endMs) { overlaps++; continue; }
    if (bins.length === MAX_HEATMAP_BINS) break;
    bins.push(bin);
  }
  const fields = { intervals: 'yt-dlp-seconds-to-source-ms', intensity: 'yt-dlp-value-unscaled',
    dropped: String(dropped), clipped: String(clipped), duplicates: String(duplicates), overlaps: String(overlaps),
    bounded: String(raw.length > MAX_HEATMAP_SCAN || candidates.length > MAX_HEATMAP_BINS) };
  return envelope(bins.length ? 'available' : 'unavailable', bins, options, bins.length ? undefined : 'malformed', fields);
}

// Serialized SourceContext is a trust boundary too. Invalid data is unavailable,
// not an arbitrary object carried into consumers. Missing old fields stay missing.
export function validateHeatmap(value, options = {}) {
  if (value === undefined) return undefined;
  const invalid = () => heatmapUnavailable('invalid-serialized', options);
  if (!object(value) || !['available', 'unavailable', 'disabled'].includes(value.status)
    || value.timeline !== 'source' || value.timeUnit !== 'ms' || value.intensitySemantics !== 'relative-replay-interest'
    || !Array.isArray(value.bins) || value.bins.length > MAX_HEATMAP_BINS) return invalid();
  if (value.reason !== undefined && !reasons.has(value.reason)) return invalid();
  if (value.status === 'available' ? !value.bins.length || value.reason !== undefined : value.bins.length || !value.reason) return invalid();
  const p = value.provenance;
  if (!object(p) || typeof p.source !== 'string' || p.source.length > 128 || typeof p.extractedAt !== 'string' || p.extractedAt.length > 64
    || !object(p.fields) || Object.keys(p.fields).length > 32 || !Object.entries(p.fields).every(([k, v]) => k.length <= 128 && typeof v === 'string' && v.length <= 256)) return invalid();
  if (value.status === 'available' && !durationValid(options.durationMs)) return invalid();
  let previousEnd = 0;
  for (const bin of value.bins) {
    if (!intervalValid(bin, options.durationMs) || bin.startMs < previousEnd) return invalid();
    previousEnd = bin.endMs;
  }
  return { status: value.status, ...(value.reason ? { reason: value.reason } : {}), timeline: 'source', timeUnit: 'ms', intensitySemantics: 'relative-replay-interest',
    bins: value.bins.map(({ startMs, endMs, intensity }) => ({ startMs, endMs, intensity })),
    provenance: { source: p.source, extractedAt: p.extractedAt, fields: { ...p.fields } } };
}
