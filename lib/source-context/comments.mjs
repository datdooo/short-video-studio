// Bounded, deterministic YouTube comment normalization and timestamp extraction.
//
// Every comment string is untrusted inert data: it is sanitized, length-bounded
// and never executed, evaluated, or interpreted as instructions. Raw comment text
// is never sent anywhere; only bounded structured evidence leaves this module.
//
// Comment retrieval is optional and best-effort. Any retrieval or parsing failure
// degrades to a normalized "unavailable" state and never fails the caller.

import { parseTimestampToMs, formatTimestamp } from "./description-markers.mjs";
import {
  clusterCommentMentions,
  COMMENT_CLUSTER_WINDOW_MS,
  MAX_CLUSTERS,
  MAX_SUPPORTING_COMMENT_IDS,
} from "./comment-clusters.mjs";

export const MAX_COMMENTS = 200;
export const MAX_COMMENT_TEXT_LENGTH = 1000;
export const MAX_TIMESTAMP_MENTIONS_PER_COMMENT = 3;
export const MAX_COMMENTS_PER_AUTHOR = 3;
export const MAX_ENGAGEMENT_COUNT = 10_000_000;
export const COMMENT_MENTION_CONTEXT_LENGTH = 80;
export const COMMENT_FETCH_LIMIT = 200;

// yt-dlp marks every top-level comment with the literal parent sentinel "root".
// It is not a comment ID: such comments are top-level, never replies, and must
// never carry a parentId.
export const ROOT_PARENT_SENTINEL = "root";

// M:SS, MM:SS and H:MM:SS. Explicitly rejects timestamps glued to a longer digit
// run and obvious clock forms directly followed by AM/PM (e.g. "3:30 pm").
const COMMENT_TIMESTAMP_PATTERN = "(?<![\\d:])(?:(\\d{1,2}):)?([0-5]?\\d):([0-5]\\d)(?![\\d:]|\\s*[ap]\\.?\\s?m\\.?)";

export { COMMENT_CLUSTER_WINDOW_MS, MAX_CLUSTERS, MAX_SUPPORTING_COMMENT_IDS };

function sanitizeString(raw, maxLength = 1024) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLength);
}

function sanitizeCount(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.round(value), MAX_ENGAGEMENT_COUNT);
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function clampInt(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

// Deterministic, bounded engagement weight in [0, 1].
// Logarithmic compression means a comment with a billion likes cannot dominate.
export function computeEngagementWeight(raw = {}) {
  const likeTerm = Math.log10(1 + sanitizeCount(raw?.likeCount)) / 6;
  const replyTerm = Math.log10(1 + sanitizeCount(raw?.replyCount)) / 5;
  return round4(Math.min(1, Math.max(0, likeTerm * 0.8 + replyTerm * 0.2)));
}

function mentionContext(text, index, length) {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return sanitizeString(text.slice(start, end), COMMENT_MENTION_CONTEXT_LENGTH);
}

export function extractCommentTimestampMentions(text, options = {}) {
  if (typeof text !== "string" || !text) return [];

  const { durationMs = null, maxMentions = MAX_TIMESTAMP_MENTIONS_PER_COMMENT } = options;
  const boundedText = text.slice(0, MAX_COMMENT_TEXT_LENGTH);
  const limit = Number.isInteger(maxMentions) && maxMentions > 0 ? maxMentions : MAX_TIMESTAMP_MENTIONS_PER_COMMENT;
  const regex = new RegExp(COMMENT_TIMESTAMP_PATTERN, "gi");

  const mentions = [];
  let match;
  while ((match = regex.exec(boundedText)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex++;
      continue;
    }
    if (mentions.length >= limit) break;

    const timestampMs = parseTimestampToMs(match);
    if (timestampMs === null || timestampMs < 0) continue;
    if (typeof durationMs === "number" && durationMs > 0 && timestampMs > durationMs) continue;

    mentions.push({
      timestampMs,
      timestampFormatted: formatTimestamp(timestampMs),
      context: mentionContext(boundedText, match.index, match[0].length),
    });
  }
  return mentions;
}

// Bounded yt-dlp arguments for comment retrieval. Reuses the existing downloader
// invocation (this module never spawns a process or opens a network connection).
export function buildYouTubeCommentArgs(options = {}) {
  const maxComments = clampInt(options.maxComments, 1, MAX_COMMENTS, COMMENT_FETCH_LIMIT);
  return [
    "--skip-download",
    "--write-comments",
    "--extractor-args",
    `youtube:max_comments=${maxComments}`,
  ];
}

function normalizeComment(raw, index, durationMs) {
  if (!raw || typeof raw !== "object") return null;

  const text = sanitizeString(firstString(raw.text, raw.comment), MAX_COMMENT_TEXT_LENGTH);
  if (!text) return null;

  const rawParent = sanitizeString(firstString(raw.parent, raw.parent_id, raw.parentId), 128);
  // "root" is yt-dlp's top-level sentinel, not a parent comment. It wins over any
  // is_reply flag so a top-level comment is never misclassified as a reply.
  const hasRealParent = Boolean(rawParent) && rawParent !== ROOT_PARENT_SENTINEL;
  const isReply = hasRealParent || (!rawParent && (raw.is_reply === true || raw.isReply === true));
  const parentId = hasRealParent ? rawParent : undefined;
  const id = sanitizeString(firstString(raw.id, raw.comment_id, raw.commentId), 128) || `comment-${index + 1}`;
  const author = sanitizeString(firstString(raw.author, raw.author_name), 128) || undefined;
  const authorId = sanitizeString(firstString(raw.author_id, raw.authorId), 128) || undefined;

  const likeCount = sanitizeCount(typeof raw.like_count === "number" ? raw.like_count : raw.likeCount);
  const replyCount = sanitizeCount(typeof raw.reply_count === "number" ? raw.reply_count : raw.replyCount);

  return {
    id,
    ...(isReply && parentId ? { parentId } : {}),
    isReply,
    ...(author ? { author } : {}),
    ...(authorId ? { authorId } : {}),
    text,
    likeCount,
    replyCount,
    timestampMentions: extractCommentTimestampMentions(text, { durationMs }),
    engagementWeight: computeEngagementWeight({ likeCount, replyCount }),
  };
}

function collectRawComments(rawComments) {
  if (Array.isArray(rawComments)) return rawComments;
  if (rawComments && typeof rawComments === "object" && Array.isArray(rawComments.comments)) return rawComments.comments;
  return null;
}

function provenanceFor(source, extractedAt, fields = {}) {
  return { source, extractedAt, fields };
}

export function commentSignalsUnavailable(options = {}, reason = "no-comments-available", source = "comments-unavailable") {
  return {
    status: "unavailable",
    reason,
    comments: [],
    clusters: [],
    provenance: provenanceFor(source, resolveExtractedAt(options), {}),
  };
}

function resolveExtractedAt(options = {}) {
  return typeof options.extractedAt === "string" && options.extractedAt ? options.extractedAt : new Date().toISOString();
}

export function normalizeComments(rawComments, options = {}) {
  const { durationMs = null, enabled = true } = options;
  const maxComments = clampInt(options.maxComments, 1, MAX_COMMENTS, MAX_COMMENTS);
  const extractedAt = resolveExtractedAt(options);

  if (enabled === false) {
    return {
      status: "disabled",
      reason: "comments-disabled",
      comments: [],
      clusters: [],
      provenance: provenanceFor("comments-disabled", extractedAt, {}),
    };
  }

  const raw = collectRawComments(rawComments);
  if (!raw || raw.length === 0) {
    return commentSignalsUnavailable({ extractedAt }, "no-comments-available");
  }

  // Bound the scan window so a huge raw payload cannot exhaust memory or time.
  const bounded = raw.slice(0, maxComments * 5);
  const seenText = new Set();
  const perAuthor = new Map();
  const comments = [];
  let droppedDuplicates = 0;
  let droppedAuthorSpam = 0;

  for (let i = 0; i < bounded.length; i++) {
    if (comments.length >= maxComments) break;

    const comment = normalizeComment(bounded[i], i, durationMs);
    if (!comment) continue;

    // Conservative dedupe: exact case/whitespace-normalized text only. No fuzzy matching.
    const dedupeKey = comment.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (seenText.has(dedupeKey)) {
      droppedDuplicates++;
      continue;
    }

    // Same-author spam bounding: one author cannot fill the bounded comment budget.
    const authorKey = comment.authorId || comment.author;
    if (authorKey) {
      const count = perAuthor.get(authorKey) || 0;
      if (count >= MAX_COMMENTS_PER_AUTHOR) {
        droppedAuthorSpam++;
        continue;
      }
      perAuthor.set(authorKey, count + 1);
    }

    seenText.add(dedupeKey);
    comments.push(comment);
  }

  if (comments.length === 0) {
    return commentSignalsUnavailable({ extractedAt }, "no-usable-comments");
  }

  const clusters = clusterCommentMentions(comments, { windowMs: COMMENT_CLUSTER_WINDOW_MS, maxClusters: MAX_CLUSTERS });

  return {
    status: "available",
    comments,
    clusters,
    provenance: provenanceFor("yt-dlp-comments", extractedAt, {
      comments: "yt-dlp",
      timestampMentions: "parsed-comment-text",
      clusters: "derived",
      ...(droppedDuplicates ? { droppedDuplicates: String(droppedDuplicates) } : {}),
      ...(droppedAuthorSpam ? { droppedAuthorSpam: String(droppedAuthorSpam) } : {}),
    }),
  };
}

// Optional/best-effort comment retrieval wrapper: any load or normalization
// failure degrades to a normalized unavailable state instead of failing the pipeline.
export async function collectCommentSignals(load, options = {}) {
  if (options.enabled === false) {
    return normalizeComments(undefined, { ...options, enabled: false });
  }
  if (typeof load !== "function") {
    return commentSignalsUnavailable(options, "comments-disabled", "comments-disabled");
  }
  let raw;
  try {
    raw = await load();
  } catch {
    return commentSignalsUnavailable(options, "comment-retrieval-failed");
  }
  return normalizeComments(raw, options);
}
