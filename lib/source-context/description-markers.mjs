// Deterministic description timestamp and section marker parser.
// Untrusted text is strictly sanitized and never evaluated or executed.

const TIMESTAMP_MATCH_REGEX = /(?:^|[\s\(\[\{\"'`~<|,\.\-—–])(?:(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d))\b/;
const DIGITS_ONLY_REGEX = /(?:(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d))/;

const HIGHLIGHT_PATTERNS = [
  /\b(?:final\s+results?|end\s+results?)\b/i,
  /\b(?:before\s*(?:and|\/|-)\s*after)\b/i,
  /\b(?:reveal|big\s+reveal|finished\s+(?:product|look|result))\b/i,
  /\b(?:highlight|highlights|outcome|conclusion|verdict)\b/i,
];

const NUMBERED_PATTERNS = [
  /^(?:step|part|chapter|section|phase|mục|bước|단계|파트|パート|章)\s*#?\s*\d+/i,
  /^\d+\s*[\.\-\)]\s*$/,
  /^\d+\s*[\.\-\)]\s+/,
];

function sanitizeText(raw, maxLength = 200) {
  if (typeof raw !== "string") return "";
  // Strip null bytes and non-printable control characters, but preserve newlines
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  return cleaned.slice(0, maxLength);
}

export function parseTimestampToMs(match) {
  if (!match) return null;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  if (Number.isNaN(minutes) || Number.isNaN(seconds) || Number.isNaN(hours)) return null;
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

export function formatTimestamp(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function parseDescriptionMarkers(description, options = {}) {
  if (typeof description !== "string" || !description.trim()) {
    return [];
  }

  const { durationMs = null, maxMarkers = 150 } = options;
  // Bounded description length to prevent regex DOS
  const boundedText = description.slice(0, 50_000);
  const lines = boundedText.split(/\r?\n/);
  const rawMarkers = [];

  for (const rawLine of lines) {
    // Strip control characters first so regex sees clean boundary characters
    const trimmed = sanitizeText(rawLine, 500);
    if (!trimmed) continue;

    const match = trimmed.match(TIMESTAMP_MATCH_REGEX);
    if (!match) continue;

    const digitsMatch = match[0].match(DIGITS_ONLY_REGEX);
    if (!digitsMatch) continue;

    const timestampMs = parseTimestampToMs(digitsMatch);
    if (timestampMs === null || timestampMs < 0) continue;
    if (typeof durationMs === "number" && durationMs > 0 && timestampMs > durationMs) continue;

    const digits = digitsMatch[0];
    const idx = trimmed.indexOf(digits);
    const before = trimmed.slice(0, idx).replace(/[\[\(\{\s\-\:\.\–—|]+$/, "").replace(/^[\[\(\{\s\-\:\.\–—|]+/, "").trim();
    const after = trimmed.slice(idx + digits.length).replace(/^[\]\)\}\s\-\:\.\–—|]+/, "").replace(/[\]\)\}\s\-\:\.\–—|]+$/, "").trim();

    let title = "";
    const isStepOrPart = Boolean(before && NUMBERED_PATTERNS.some((pat) => pat.test(before)));
    if (after) {
      if (before && isStepOrPart) {
        title = `${before} ${after}`;
      } else {
        title = after;
      }
    } else if (before) {
      title = before;
    } else {
      title = `Marker ${formatTimestamp(timestampMs)}`;
    }

    const cleanTitle = sanitizeText(title, 160) || `Marker ${formatTimestamp(timestampMs)}`;

    // Detect highlight and numbered section indicators
    const isHighlight = HIGHLIGHT_PATTERNS.some((pat) => pat.test(cleanTitle));
    const isNumbered = isStepOrPart || NUMBERED_PATTERNS.some((pat) => pat.test(cleanTitle));

    let kind = "timestamp";
    if (isHighlight) {
      kind = "highlight";
    } else if (isNumbered) {
      kind = "numbered";
    }

    rawMarkers.push({
      title: cleanTitle,
      timestampMs,
      timestampFormatted: formatTimestamp(timestampMs),
      isHighlight,
      kind,
    });
  }

  // Sort chronologically and deduplicate by timestampMs
  rawMarkers.sort((a, b) => a.timestampMs - b.timestampMs);

  const seenTimestamps = new Set();
  const markers = [];
  for (const marker of rawMarkers) {
    if (seenTimestamps.has(marker.timestampMs)) continue;
    seenTimestamps.add(marker.timestampMs);
    markers.push(marker);
    if (markers.length >= maxMarkers) break;
  }

  return markers;
}
