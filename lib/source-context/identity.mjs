// Source identity and stable cache key computation.
// Changing visual style (font, filter, template, background, overlay, animation, transition)
// has strictly zero effect on source identity or analysis cache keys.

import { createHash } from "node:crypto";

function sanitizeString(raw, maxLength = 256) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLength);
}

export function createSourceIdentity(input = {}) {
  const kind = input.kind === "local" ? "local" : "youtube";
  const url = typeof input.url === "string" ? sanitizeString(input.url, 1024) : undefined;
  const path = typeof input.path === "string" ? sanitizeString(input.path, 1024) : undefined;
  const title = sanitizeString(input.title, 256) || "Untitled Source";

  let durationSeconds = typeof input.durationSeconds === "number" && input.durationSeconds > 0
    ? input.durationSeconds
    : typeof input.duration === "number" && input.duration > 0
      ? input.duration
      : undefined;

  let durationMs = typeof input.durationMs === "number" && input.durationMs > 0
    ? Math.round(input.durationMs)
    : durationSeconds !== undefined
      ? Math.round(durationSeconds * 1000)
      : undefined;

  if (durationSeconds === undefined && durationMs !== undefined) {
    durationSeconds = durationMs / 1000;
  }

  // Derive stable fallback ID if not explicitly provided
  let id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : "";
  if (!id) {
    if (kind === "youtube" && input.videoId) {
      id = `yt-${input.videoId}`;
    } else if (url) {
      id = `yt-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
    } else if (path) {
      id = `loc-${createHash("sha256").update(path).digest("hex").slice(0, 16)}`;
    } else {
      id = `src-${createHash("sha256").update(`${title}:${durationSeconds || 0}`).digest("hex").slice(0, 16)}`;
    }
  }

  const identity = {
    id,
    kind,
    title,
    ...(url ? { url } : {}),
    ...(path ? { path } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(typeof input.width === "number" && input.width > 0 ? { width: input.width } : {}),
    ...(typeof input.height === "number" && input.height > 0 ? { height: input.height } : {}),
    ...(typeof input.fps === "number" && input.fps > 0 ? { fps: input.fps } : {}),
  };

  return identity;
}

export function computeSourceCacheKey(sourceOrContext, revision = 1) {
  if (!sourceOrContext || typeof sourceOrContext !== "object") {
    throw new TypeError("computeSourceCacheKey requires a valid source or sourceContext object");
  }

  // Support either full SourceContext or standalone SourceIdentity
  const source = "source" in sourceOrContext ? sourceOrContext.source : sourceOrContext;
  const metadata = "metadata" in sourceOrContext ? sourceOrContext.metadata : {};

  const kind = source.kind || "youtube";
  const dur = Math.round(source.durationSeconds || source.duration || 0);

  let primaryId = "";
  if (kind === "youtube") {
    primaryId = metadata?.videoId || source.videoId || "";
    if (!primaryId && source.url) {
      const match = source.url.match(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      primaryId = match ? match[1] : source.url;
    }
    if (!primaryId) primaryId = source.id || "unknown";
    return `youtube:${primaryId}:dur${dur}:rev${revision}`;
  }

  // Local kind
  primaryId = source.id || source.path || "unknown";
  return `local:${primaryId}:dur${dur}:rev${revision}`;
}

export function isSameSource(a, b) {
  if (!a || !b) return false;
  const keyA = computeSourceCacheKey(a, 1);
  const keyB = computeSourceCacheKey(b, 1);
  return keyA === keyB;
}
