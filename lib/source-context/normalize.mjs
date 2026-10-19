// Canonical SourceContext normalization and creation.
// Ensures fresh copies, strict fallback guarantees, and clean separation between YouTube and local files.

import { SOURCE_CONTEXT_VERSION } from "./schema.mjs";
import { createSourceIdentity } from "./identity.mjs";
import { extractYouTubeMetadata } from "./youtube-metadata.mjs";
import { normalizeChapters, chaptersFromDescriptionMarkers } from "./chapters.mjs";
import { parseDescriptionMarkers } from "./description-markers.mjs";
import { normalizeHeatmap, validateHeatmap } from "./heatmap.mjs";
import { normalizeComments, MAX_COMMENTS, MAX_COMMENT_TEXT_LENGTH, MAX_TIMESTAMP_MENTIONS_PER_COMMENT, MAX_CLUSTERS, MAX_SUPPORTING_COMMENT_IDS, MAX_ENGAGEMENT_COUNT } from "./comments.mjs";

// Future signals are preserved; comments and heatmap have validated contracts.
const OPTIONAL_SIGNAL_KEYS = ["transcript", "comments", "heatmap", "visualSignals", "audioSignals"];

function sanitizeString(raw, maxLength = 1024) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLength);
}

function collectOptionalSignals(input) {
  const signals = {};
  for (const key of OPTIONAL_SIGNAL_KEYS) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    signals[key] = value;
  }
  return signals;
}

// `context.comments` is typed as CommentSignals, so a preserved value that does
// not match that shape must never survive into the context. Conforming signals
// round-trip without semantic loss (as fresh copies); anything else degrades to
// the same normalized state the source kind produces when comments are absent.
const COMMENT_SIGNAL_STATUSES = new Set(["available", "unavailable", "disabled"]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isTimestampMention(value) {
  return isPlainObject(value)
    && isFiniteNumber(value.timestampMs) && value.timestampMs >= 0
    && typeof value.timestampFormatted === "string"
    && typeof value.context === "string";
}

function isSourceComment(value) {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (typeof value.isReply !== "boolean") return false;
  if (value.parentId !== undefined && typeof value.parentId !== "string") return false;
  if (value.author !== undefined && typeof value.author !== "string") return false;
  if (value.authorId !== undefined && typeof value.authorId !== "string") return false;
  if (typeof value.text !== "string" || value.text.length > MAX_COMMENT_TEXT_LENGTH) return false;
  if (![value.likeCount, value.replyCount].every(n => Number.isInteger(n) && n >= 0 && n <= MAX_ENGAGEMENT_COUNT)) return false;
  if (!isFiniteNumber(value.engagementWeight) || value.engagementWeight < 0 || value.engagementWeight > 1) return false;
  return Array.isArray(value.timestampMentions) && value.timestampMentions.length <= MAX_TIMESTAMP_MENTIONS_PER_COMMENT && value.timestampMentions.every(isTimestampMention);
}

function isCommentCluster(value) {
  if (!isPlainObject(value) || typeof value.centerFormatted !== "string") return false;
  if (!Array.isArray(value.supportingCommentIds) || value.supportingCommentIds.length > MAX_SUPPORTING_COMMENT_IDS) return false;
  if (!value.supportingCommentIds.every((id) => typeof id === "string")) return false;
  if (value.score < 0 || value.score > 1 || value.startMs < 0 || value.endMs < value.startMs || value.centerMs < value.startMs || value.centerMs > value.endMs) return false;
  return ["centerMs", "startMs", "endMs", "mentionCount", "commentCount", "distinctAuthorCount", "score"]
    .every((key) => isFiniteNumber(value[key]));
}

function isSourceProvenance(value) {
  if (!isPlainObject(value)) return false;
  if (typeof value.source !== "string" || typeof value.extractedAt !== "string") return false;
  return isPlainObject(value.fields) && Object.values(value.fields).every((entry) => typeof entry === "string");
}

function validateCommentSignals(value, durationMs) {
  if (!isPlainObject(value) || !COMMENT_SIGNAL_STATUSES.has(value.status)) return null;
  if (value.reason !== undefined && typeof value.reason !== "string") return null;
  if (!Array.isArray(value.comments) || value.comments.length > MAX_COMMENTS || !value.comments.every(isSourceComment)) return null;
  if (!Array.isArray(value.clusters) || value.clusters.length > MAX_CLUSTERS || !value.clusters.every(isCommentCluster)) return null;
  if (!isSourceProvenance(value.provenance)) return null;
  if (durationMs > 0 && (value.comments.some(c => c.timestampMentions.some(m => m.timestampMs > durationMs))
    || value.clusters.some(c => c.endMs > durationMs))) return null;
  return cloneCommentSignals(value);
}

// Rebuild only known fields so unknown extras never leak through and fresh copies
// are guaranteed even for exotic input values.
function cloneCommentSignals(value) {
  return {
    status: value.status,
    ...(value.reason !== undefined ? { reason: value.reason } : {}),
    comments: value.comments.map((comment) => ({
      id: comment.id,
      ...(comment.parentId !== undefined ? { parentId: comment.parentId } : {}),
      isReply: comment.isReply,
      ...(comment.author !== undefined ? { author: comment.author } : {}),
      ...(comment.authorId !== undefined ? { authorId: comment.authorId } : {}),
      text: comment.text,
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      timestampMentions: comment.timestampMentions.map((mention) => ({
        timestampMs: mention.timestampMs,
        timestampFormatted: mention.timestampFormatted,
        context: mention.context,
      })),
      engagementWeight: comment.engagementWeight,
    })),
    clusters: value.clusters.map((cluster) => ({
      centerMs: cluster.centerMs,
      centerFormatted: cluster.centerFormatted,
      startMs: cluster.startMs,
      endMs: cluster.endMs,
      mentionCount: cluster.mentionCount,
      commentCount: cluster.commentCount,
      distinctAuthorCount: cluster.distinctAuthorCount,
      score: cluster.score,
      supportingCommentIds: [...cluster.supportingCommentIds],
    })),
    provenance: {
      source: value.provenance.source,
      extractedAt: value.provenance.extractedAt,
      fields: { ...value.provenance.fields },
    },
  };
}

function resolvePreservedComments(value, { kind, durationMs, extractedAt }) {
  const validated = validateCommentSignals(value, durationMs);
  if (validated) return validated;
  return kind === "local"
    ? normalizeComments(undefined, { enabled: false, extractedAt })
    : normalizeComments(undefined, { durationMs, extractedAt });
}

function resolveComments(input, { kind, rawInfo, durationMs, extractedAt }) {
  const bounds = { kind, durationMs, extractedAt };
  if (kind === "local") {
    // Local sources carry no comment signal; report a clean disabled state.
    if (input.comments !== undefined && input.comments !== null) return resolvePreservedComments(input.comments, bounds);
    return normalizeComments(undefined, { enabled: false, extractedAt });
  }
  const rawComments = rawInfo?.comments;
  if (rawComments !== undefined && rawComments !== null) {
    return normalizeComments(rawComments, { durationMs, extractedAt });
  }
  if (input.comments !== undefined && input.comments !== null) return resolvePreservedComments(input.comments, bounds);
  return normalizeComments(undefined, { durationMs, extractedAt });
}

export function normalizeSourceContext(input = {}) {
  if (!input || typeof input !== "object") {
    input = {};
  }

  // If input is already a valid SourceContext, create a fresh deep copy
  if (input.version === SOURCE_CONTEXT_VERSION && input.source && input.metadata) {
    const preserved = collectOptionalSignals(input);
    const context = {
      version: SOURCE_CONTEXT_VERSION,
      source: createSourceIdentity(input.source),
      metadata: extractYouTubeMetadata({ id: input.metadata.videoId, webpage_url: input.metadata.canonicalUrl,
        title: input.metadata.title, description: input.metadata.description, uploader: input.metadata.uploader,
        channel_id: input.metadata.channelId, channel_url: input.metadata.channelUrl, upload_date: input.metadata.uploadDate,
        duration: input.metadata.durationSeconds, tags: input.metadata.tags, view_count: input.metadata.viewCount,
        like_count: input.metadata.likeCount, comment_count: input.metadata.commentCount }).metadata,
      chapters: normalizeChapters(input.chapters, { durationMs: input.source.durationMs }),
      descriptionMarkers: Array.isArray(input.descriptionMarkers) ? input.descriptionMarkers.filter(m => isPlainObject(m)
        && Number.isFinite(m.timestampMs) && m.timestampMs >= 0 && typeof m.title === 'string' && typeof m.timestampFormatted === 'string').slice(0, 200) : [],
      ...preserved,
      provenance: isSourceProvenance(input.provenance) ? input.provenance : {
        source: "normalized",
        extractedAt: new Date().toISOString(),
        fields: {},
      },
    };
    // A preserved value that is not a conforming CommentSignals must not survive.
    if (preserved.comments !== undefined) {
      context.comments = resolvePreservedComments(preserved.comments, {
        kind: input.source.kind === "local" ? "local" : "youtube",
        durationMs: Number.isFinite(input.metadata.durationSeconds) && input.metadata.durationSeconds > 0
          ? Math.round(input.metadata.durationSeconds * 1000)
          : null,
        extractedAt: input.provenance?.extractedAt,
      });
    }
    if (Object.hasOwn(input, 'heatmap')) context.heatmap = input.source.kind === 'local'
      ? normalizeHeatmap(undefined, { enabled: false })
      : validateHeatmap(input.heatmap, { durationMs: context.source.durationMs });
    return structuredClone(context);
  }

  const kind = input.kind === "local" || (typeof input.path === "string" && !input.url) ? "local" : "youtube";

  let metadata;
  let chapters = [];
  let descriptionMarkers = [];
  let provenance;
  let rawInfo = null;

  if (kind === "youtube") {
    // If raw yt-dlp info is supplied in input or input.info
    rawInfo = input.info || input.infoJson || (input.webpage_url || input.id ? input : {});
    const extracted = extractYouTubeMetadata(rawInfo);

    metadata = extracted.metadata;
    chapters = extracted.chapters;
    descriptionMarkers = extracted.descriptionMarkers;
    provenance = extracted.provenance;

    // Allow top-level overrides from input if specified
    if (input.title && !rawInfo.title) metadata.title = sanitizeString(input.title, 256);
    if (Number.isFinite(input.durationSeconds) && input.durationSeconds > 0 && !rawInfo.duration) metadata.durationSeconds = input.durationSeconds;
    if (input.description && !rawInfo.description) {
      metadata.description = sanitizeString(input.description, 50_000);
      descriptionMarkers = parseDescriptionMarkers(metadata.description);
      if (chapters.length === 0 && descriptionMarkers.length >= 2) {
        chapters = normalizeChapters(descriptionMarkers);
      }
    }
  } else {
    // Local file representation
    const title = sanitizeString(input.title || input.filename || "Local Video", 256);
    const durationSeconds = Number.isFinite(input.durationSeconds) && input.durationSeconds > 0
      ? input.durationSeconds
      : Number.isFinite(input.duration) && input.duration > 0
        ? input.duration
        : undefined;

    const durationMs = durationSeconds !== undefined ? Math.round(durationSeconds * 1000) : null;
    const description = typeof input.description === "string" ? sanitizeString(input.description, 50_000) : undefined;
    const tags = Array.isArray(input.tags)
      ? input.tags.filter((t) => typeof t === "string").map((t) => sanitizeString(t, 80)).slice(0, 50)
      : [];

    descriptionMarkers = description ? parseDescriptionMarkers(description, { durationMs }) : [];
    chapters = normalizeChapters(input.chapters, { durationMs });
    if (chapters.length === 0 && descriptionMarkers.length >= 2) {
      chapters = chaptersFromDescriptionMarkers(descriptionMarkers, { durationMs });
    }

    metadata = {
      title,
      ...(description !== undefined ? { description } : {}),
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      tags,
    };

    provenance = {
      source: "local-file",
      extractedAt: new Date().toISOString(),
      fields: {
        title: "local",
        ...(durationSeconds ? { durationSeconds: "local" } : {}),
        ...(description ? { description: "local" } : {}),
      },
    };
  }

  // Build clean SourceIdentity
  const source = createSourceIdentity({
    id: input.sourceId || input.id,
    kind,
    url: input.url || metadata.canonicalUrl,
    path: input.path || input.filePath || input.mediaPath,
    title: metadata.title,
    durationSeconds: metadata.durationSeconds,
    videoId: metadata.videoId,
    width: input.width,
    height: input.height,
    fps: input.fps,
  });

  const videoDurationMs = Number.isFinite(metadata.durationSeconds) && metadata.durationSeconds > 0
    ? Math.round(metadata.durationSeconds * 1000)
    : null;

  // Comments (and other optional signals) are preserved/degraded, never required.
  // Source cache identity is computed from `source` alone and is unaffected.
  const preserved = collectOptionalSignals(input);
  const context = {
    version: SOURCE_CONTEXT_VERSION,
    source,
    metadata,
    chapters,
    descriptionMarkers,
    comments: structuredClone(resolveComments(input, {
      kind,
      rawInfo,
      durationMs: videoDurationMs,
      extractedAt: provenance?.extractedAt,
    })),
    heatmap: kind === 'local' ? normalizeHeatmap(undefined, { enabled: false, extractedAt: provenance.extractedAt })
      : Object.hasOwn(input, 'heatmap') ? validateHeatmap(input.heatmap, { durationMs: videoDurationMs })
      : normalizeHeatmap(rawInfo?.heatmap, { durationMs: videoDurationMs, extractedAt: provenance.extractedAt }),
    provenance,
  };

  for (const key of OPTIONAL_SIGNAL_KEYS) {
    if (key === "comments" || key === "heatmap" || preserved[key] === undefined) continue;
    context[key] = structuredClone(preserved[key]);
  }

  return context;
}
