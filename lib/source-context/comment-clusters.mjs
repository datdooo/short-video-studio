// Deterministic comment timestamp clustering.
// Mentions are grouped with a fixed window anchored on the first mention of each
// cluster, so clusters can never chain-merge and drift across the timeline.

import { formatTimestamp } from "./description-markers.mjs";

// Explicit documented window: a mention only joins a cluster when it is within
// this distance of the cluster's anchor (its earliest mention).
export const COMMENT_CLUSTER_WINDOW_MS = 30_000;
export const MAX_CLUSTERS = 50;
export const MAX_SUPPORTING_COMMENT_IDS = 20;
// Replies count towards a cluster but never as much as top-level comments, so a
// long reply thread cannot disproportionately inflate a cluster score.
export const REPLY_WEIGHT_FACTOR = 0.5;

const MENTION_SATURATION = 20;
const AUTHOR_SATURATION = 10;
const WEIGHT_SATURATION = 5;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return value > 1 ? 1 : value < 0 ? 0 : value;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function saturate(value) {
  return value > 1 ? 1 : value < 0 ? 0 : value;
}

function compareIds(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function authorKeyOf(comment) {
  return comment.authorId || comment.author || `comment:${comment.id}`;
}

// Bounded, deterministic cluster score in [0, 1].
// Log compression means huge mention/author/engagement counts saturate instead of
// dominating. Replies contribute at REPLY_WEIGHT_FACTOR, so a long reply thread
// cannot raise a cluster score as much as the same number of top-level comments.
function clusterScore(topLevelCount, replyCount, distinctAuthorCount, weightSum) {
  const effectiveMentions = topLevelCount + replyCount * REPLY_WEIGHT_FACTOR;
  const mentionTerm = saturate(Math.log10(1 + effectiveMentions) / Math.log10(1 + MENTION_SATURATION));
  const authorTerm = saturate(Math.log10(1 + distinctAuthorCount) / Math.log10(1 + AUTHOR_SATURATION));
  const weightTerm = saturate(weightSum / WEIGHT_SATURATION);
  return round4(0.45 * mentionTerm + 0.35 * authorTerm + 0.2 * weightTerm);
}

function collectMentions(comments) {
  const mentions = [];
  for (const comment of comments) {
    if (!comment || typeof comment !== "object" || !Array.isArray(comment.timestampMentions)) continue;
    const rawWeight = typeof comment.engagementWeight === "number" && Number.isFinite(comment.engagementWeight)
      ? clamp01(comment.engagementWeight)
      : 0;
    const isReply = comment.isReply === true;
    const weight = isReply ? rawWeight * REPLY_WEIGHT_FACTOR : rawWeight;
    const commentId = comment.id === undefined || comment.id === null ? "" : String(comment.id);
    const authorKey = authorKeyOf(comment);
    for (const mention of comment.timestampMentions) {
      if (!mention || typeof mention !== "object") continue;
      if (typeof mention.timestampMs !== "number" || !Number.isFinite(mention.timestampMs)) continue;
      mentions.push({
        timestampMs: Math.max(0, Math.round(mention.timestampMs)),
        commentId,
        authorKey,
        isReply,
        weight,
      });
    }
  }
  return mentions;
}

// Group mentions into windows anchored on the first mention of each group.
function groupMentions(mentions, windowMs) {
  const groups = [];
  let anchorMs = null;
  let current = null;
  for (const mention of mentions) {
    if (!current || mention.timestampMs - anchorMs > windowMs) {
      anchorMs = mention.timestampMs;
      current = [];
      groups.push(current);
    }
    current.push(mention);
  }
  return groups;
}

function summarize(group, maxSupportingIds) {
  let startMs = group[0].timestampMs;
  let endMs = group[0].timestampMs;
  let sum = 0;
  let weightSum = 0;
  let replyCount = 0;
  const commentIds = new Set();
  const authorKeys = new Set();
  for (const mention of group) {
    if (mention.timestampMs < startMs) startMs = mention.timestampMs;
    if (mention.timestampMs > endMs) endMs = mention.timestampMs;
    sum += mention.timestampMs;
    weightSum += mention.weight;
    if (mention.isReply) replyCount++;
    commentIds.add(mention.commentId);
    authorKeys.add(mention.authorKey);
  }

  const supporting = [...group]
    .sort((a, b) => b.weight - a.weight || a.timestampMs - b.timestampMs || compareIds(a.commentId, b.commentId))
    .map((mention) => mention.commentId)
    .filter((id) => id !== "");
  const supportingCommentIds = [];
  const seenSupporting = new Set();
  for (const id of supporting) {
    if (seenSupporting.has(id)) continue;
    seenSupporting.add(id);
    supportingCommentIds.push(id);
    if (supportingCommentIds.length >= maxSupportingIds) break;
  }

  const mentionCount = group.length;
  const distinctAuthorCount = authorKeys.size;
  const score = clusterScore(mentionCount - replyCount, replyCount, distinctAuthorCount, weightSum);
  const centerMs = Math.round(sum / mentionCount);

  return {
    centerMs,
    centerFormatted: formatTimestamp(centerMs),
    startMs,
    endMs,
    mentionCount,
    commentCount: commentIds.size,
    distinctAuthorCount,
    score,
    supportingCommentIds,
  };
}

export function clusterCommentMentions(comments, options = {}) {
  if (!Array.isArray(comments) || comments.length === 0) return [];

  const { windowMs = COMMENT_CLUSTER_WINDOW_MS, maxClusters = MAX_CLUSTERS, maxSupportingIds = MAX_SUPPORTING_COMMENT_IDS } = options;
  const window = typeof windowMs === "number" && Number.isFinite(windowMs) && windowMs > 0
    ? Math.round(windowMs)
    : COMMENT_CLUSTER_WINDOW_MS;
  const clusterLimit = Number.isInteger(maxClusters) && maxClusters > 0 ? maxClusters : MAX_CLUSTERS;
  const supportingLimit = Number.isInteger(maxSupportingIds) && maxSupportingIds > 0
    ? maxSupportingIds
    : MAX_SUPPORTING_COMMENT_IDS;

  const mentions = collectMentions(comments);
  if (mentions.length === 0) return [];
  mentions.sort((a, b) => a.timestampMs - b.timestampMs || compareIds(a.commentId, b.commentId));

  const clusters = groupMentions(mentions, window).map((group) => summarize(group, supportingLimit));
  clusters.sort((a, b) => b.score - a.score || a.centerMs - b.centerMs || a.startMs - b.startMs);
  return clusters.slice(0, clusterLimit);
}
