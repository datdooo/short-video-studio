export * from "./schema";

export function createSourceIdentity(input?: Record<string, unknown>): import("./schema").SourceIdentity;
export function computeSourceCacheKey(sourceOrContext: unknown, revision?: number): string;
export function isSameSource(a: unknown, b: unknown): boolean;

export function parseTimestampToMs(match: RegExpMatchArray | null): number | null;
export function formatTimestamp(ms: number): string;
export function parseDescriptionMarkers(description: string, options?: { durationMs?: number | null; maxMarkers?: number }): import("./schema").DescriptionMarker[];

export function normalizeChapters(rawChapters: unknown[], options?: { durationMs?: number | null }): import("./schema").Chapter[];
export function chaptersFromDescriptionMarkers(markers: import("./schema").DescriptionMarker[], options?: { durationMs?: number | null }): import("./schema").Chapter[];

export function extractYouTubeMetadata(infoJson?: unknown): {
  metadata: import("./schema").SourceMetadata;
  chapters: import("./schema").Chapter[];
  descriptionMarkers: import("./schema").DescriptionMarker[];
  provenance: import("./schema").SourceProvenance;
};

export function normalizeSourceContext(input?: unknown): import("./schema").SourceContext;

export const MAX_COMMENTS: number;
export const MAX_COMMENT_TEXT_LENGTH: number;
export const MAX_TIMESTAMP_MENTIONS_PER_COMMENT: number;
export const MAX_COMMENTS_PER_AUTHOR: number;
export const MAX_ENGAGEMENT_COUNT: number;
export const COMMENT_FETCH_LIMIT: number;
export const ROOT_PARENT_SENTINEL: string;

export const COMMENT_CLUSTER_WINDOW_MS: number;
export const MAX_CLUSTERS: number;
export const MAX_SUPPORTING_COMMENT_IDS: number;
export const REPLY_WEIGHT_FACTOR: number;

export function computeEngagementWeight(raw?: { likeCount?: number; replyCount?: number }): number;
export function extractCommentTimestampMentions(text: string, options?: { durationMs?: number | null; maxMentions?: number }): import("./schema").CommentTimestampMention[];
export function buildYouTubeCommentArgs(options?: { maxComments?: number }): string[];
export function commentSignalsUnavailable(options?: { extractedAt?: string }, reason?: string, source?: string): import("./schema").CommentSignals;
export function normalizeComments(rawComments?: unknown, options?: { durationMs?: number | null; enabled?: boolean; maxComments?: number; extractedAt?: string }): import("./schema").CommentSignals;
export function collectCommentSignals(load?: (() => unknown | Promise<unknown>) | null, options?: { durationMs?: number | null; enabled?: boolean; maxComments?: number; extractedAt?: string }): Promise<import("./schema").CommentSignals>;
export function clusterCommentMentions(comments: import("./schema").SourceComment[], options?: { windowMs?: number; maxClusters?: number; maxSupportingIds?: number }): import("./schema").CommentCluster[];

export const MAX_HEATMAP_BINS: number;
export const MAX_HEATMAP_SCAN: number;
export function normalizeHeatmap(raw?: unknown, options?: { durationMs?: number | null; enabled?: boolean; source?: string; extractedAt?: string }): import('./schema').HeatmapSignals;
export function heatmapUnavailable(reason?: import('./schema').HeatmapUnavailableReason, options?: { source?: string; extractedAt?: string }): import('./schema').HeatmapSignals;
export function validateHeatmap(raw: unknown, options?: { durationMs?: number | null }): import('./schema').HeatmapSignals | undefined;
