// YouTube metadata extraction and untrusted text sanitization.
// Reuses the existing yt-dlp info-json format without downloading media.

import { normalizeChapters, chaptersFromDescriptionMarkers } from "./chapters.mjs";
import { parseDescriptionMarkers } from "./description-markers.mjs";

function sanitizeString(raw, maxLength = 1024) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLength);
}

function sanitizeNumber(val) {
  if (typeof val === "number" && !Number.isNaN(val) && Number.isFinite(val) && val >= 0) {
    return Math.round(val);
  }
  return undefined;
}

export function extractYouTubeMetadata(infoJson = {}) {
  if (!infoJson || typeof infoJson !== "object") {
    return {
      title: "Untitled YouTube Video",
      tags: [],
      chapters: [],
      descriptionMarkers: [],
      provenance: { source: "fallback", extractedAt: new Date().toISOString(), fields: {} },
    };
  }

  const videoId = typeof infoJson.id === "string" ? sanitizeString(infoJson.id, 64) : undefined;
  const canonicalUrl = typeof infoJson.webpage_url === "string"
    ? sanitizeString(infoJson.webpage_url, 1024)
    : typeof infoJson.original_url === "string"
      ? sanitizeString(infoJson.original_url, 1024)
      : videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : undefined;

  const rawTitle = infoJson.title || "Untitled Video";
  const title = sanitizeString(rawTitle, 256) || "Untitled Video";

  // Descriptions can be lengthy; bound to 50,000 characters to prevent memory exhaustion
  const description = typeof infoJson.description === "string"
    ? sanitizeString(infoJson.description, 50_000)
    : undefined;

  const uploader = typeof infoJson.uploader === "string"
    ? sanitizeString(infoJson.uploader, 256)
    : typeof infoJson.channel === "string"
      ? sanitizeString(infoJson.channel, 256)
      : undefined;

  const channelId = typeof infoJson.channel_id === "string"
    ? sanitizeString(infoJson.channel_id, 128)
    : typeof infoJson.uploader_id === "string"
      ? sanitizeString(infoJson.uploader_id, 128)
      : undefined;

  const channelUrl = typeof infoJson.channel_url === "string"
    ? sanitizeString(infoJson.channel_url, 1024)
    : typeof infoJson.uploader_url === "string"
      ? sanitizeString(infoJson.uploader_url, 1024)
      : undefined;

  const uploadDate = typeof infoJson.upload_date === "string"
    ? sanitizeString(infoJson.upload_date, 32)
    : undefined;

  let durationSeconds = typeof infoJson.duration === "number" && infoJson.duration > 0
    ? Number(infoJson.duration)
    : undefined;

  const durationMs = durationSeconds !== undefined ? Math.round(durationSeconds * 1000) : null;

  // Process tags: array of strings, max 50 tags, max 80 chars each
  let tags = [];
  if (Array.isArray(infoJson.tags)) {
    tags = infoJson.tags
      .filter((t) => typeof t === "string")
      .map((t) => sanitizeString(t, 80))
      .filter(Boolean)
      .slice(0, 50);
  }

  const viewCount = sanitizeNumber(infoJson.view_count);
  const likeCount = sanitizeNumber(infoJson.like_count);
  const commentCount = sanitizeNumber(infoJson.comment_count);

  // Parse description markers
  const descriptionMarkers = description
    ? parseDescriptionMarkers(description, { durationMs })
    : [];

  // Extract and normalize chapters
  let chapters = normalizeChapters(infoJson.chapters, { durationMs });

  // If no official chapters were provided by yt-dlp, synthesize chapters from description markers
  if (chapters.length === 0 && descriptionMarkers.length >= 2) {
    chapters = chaptersFromDescriptionMarkers(descriptionMarkers, { durationMs });
  }

  const fields = {};
  if (videoId) fields.videoId = "yt-dlp";
  if (canonicalUrl) fields.canonicalUrl = "yt-dlp";
  if (title) fields.title = "yt-dlp";
  if (description) fields.description = "yt-dlp";
  if (uploader) fields.uploader = "yt-dlp";
  if (uploadDate) fields.uploadDate = "yt-dlp";
  if (durationSeconds) fields.durationSeconds = "yt-dlp";
  if (tags.length) fields.tags = "yt-dlp";
  if (viewCount !== undefined) fields.viewCount = "yt-dlp";
  if (likeCount !== undefined) fields.likeCount = "yt-dlp";
  if (commentCount !== undefined) fields.commentCount = "yt-dlp";
  if (chapters.length) {
    fields.chapters = Array.isArray(infoJson.chapters) && infoJson.chapters.length ? "yt-dlp" : "parsed-description";
  }
  if (descriptionMarkers.length) fields.descriptionMarkers = "parsed-description";

  const metadata = {
    ...(videoId ? { videoId } : {}),
    ...(canonicalUrl ? { canonicalUrl } : {}),
    title,
    ...(description !== undefined ? { description } : {}),
    ...(uploader ? { uploader } : {}),
    ...(channelId ? { channelId } : {}),
    ...(channelUrl ? { channelUrl } : {}),
    ...(uploadDate ? { uploadDate } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    tags,
    ...(viewCount !== undefined ? { viewCount } : {}),
    ...(likeCount !== undefined ? { likeCount } : {}),
    ...(commentCount !== undefined ? { commentCount } : {}),
  };

  return {
    metadata,
    chapters,
    descriptionMarkers,
    provenance: {
      source: "yt-dlp",
      extractedAt: new Date().toISOString(),
      fields,
    },
  };
}
