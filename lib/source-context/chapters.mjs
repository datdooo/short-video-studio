// Stable chapter normalization with strict ordering, duration bounding and overlap resolution.
// Malformed chapters degrade gracefully and never throw.

function sanitizeChapterTitle(raw, fallbackIndex = 1) {
  if (typeof raw !== "string") return `Chapter ${fallbackIndex}`;
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  return cleaned.slice(0, 160) || `Chapter ${fallbackIndex}`;
}

function parseSecondsOrMs(timeVal) {
  if (typeof timeVal !== "number" || Number.isNaN(timeVal)) return null;
  return Math.max(0, Math.round(timeVal * 1000));
}

export function normalizeChapters(rawChapters, options = {}) {
  if (!Array.isArray(rawChapters) || rawChapters.length === 0) {
    return [];
  }

  const { durationMs = null } = options;
  const parsed = [];

  for (let i = 0; i < rawChapters.length; i++) {
    const item = rawChapters[i];
    if (!item || typeof item !== "object") continue;

    // Support start_time / end_time (yt-dlp seconds) or startMs / endMs (direct ms)
    let startMs = null;
    if (typeof item.startMs === "number") {
      startMs = Math.max(0, Math.round(item.startMs));
    } else if (typeof item.start_time === "number") {
      startMs = parseSecondsOrMs(item.start_time);
    }

    if (startMs === null) continue;

    let endMs = null;
    if (typeof item.endMs === "number") {
      endMs = Math.max(0, Math.round(item.endMs));
    } else if (typeof item.end_time === "number") {
      endMs = parseSecondsOrMs(item.end_time);
    }

    const title = sanitizeChapterTitle(item.title, i + 1);

    parsed.push({
      title,
      startMs,
      endMs,
    });
  }

  if (parsed.length === 0) return [];

  // Sort chronologically by startMs
  parsed.sort((a, b) => a.startMs - b.startMs);

  const maxDuration = typeof durationMs === "number" && durationMs > 0 ? durationMs : null;
  // Filter out chapters whose startMs is already at or past the video end
  const inBounds = parsed.filter((c) => maxDuration === null || c.startMs < maxDuration);
  if (inBounds.length === 0) return [];

  // Validate bounds, resolve missing end times, clamp duration and remove zero-duration chapters
  const validChapters = [];

  for (let i = 0; i < inBounds.length; i++) {
    const current = inBounds[i];
    const next = inBounds[i + 1];

    let endMs = current.endMs;
    const nextStartMs = next ? next.startMs : null;

    if (nextStartMs !== null) {
      // If endMs is missing, invalid, or exceeds next chapter start, clamp to next chapter start
      if (endMs === null || endMs <= current.startMs || endMs > nextStartMs) {
        endMs = nextStartMs;
      }
    } else {
      // Last chapter
      if (endMs === null || endMs <= current.startMs) {
        endMs = maxDuration !== null ? maxDuration : current.startMs + 60_000;
      }
      if (maxDuration !== null && endMs > maxDuration) {
        endMs = maxDuration;
      }
    }

    // Only include chapters with positive duration
    if (endMs > current.startMs) {
      validChapters.push({
        title: current.title,
        startMs: current.startMs,
        endMs,
      });
    }
  }

  return validChapters;
}

export function chaptersFromDescriptionMarkers(markers, options = {}) {
  if (!Array.isArray(markers) || markers.length < 2) {
    return [];
  }

  const { durationMs = null } = options;
  const rawChapters = [];

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];
    const startMs = current.timestampMs;
    const endMs = next ? next.timestampMs : durationMs;

    rawChapters.push({
      title: current.title,
      startMs,
      endMs,
    });
  }

  return normalizeChapters(rawChapters, { durationMs });
}
