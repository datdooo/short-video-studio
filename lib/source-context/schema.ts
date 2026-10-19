export const SOURCE_CONTEXT_VERSION = 1 as const;

export type SourceKind = "youtube" | "local";

export interface SourceIdentity {
  id: string;
  kind: SourceKind;
  url?: string;
  path?: string;
  title: string;
  durationSeconds?: number;
  durationMs?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export interface SourceMetadata {
  videoId?: string;
  canonicalUrl?: string;
  title: string;
  description?: string;
  uploader?: string;
  channelId?: string;
  channelUrl?: string;
  uploadDate?: string;
  durationSeconds?: number;
  tags?: string[];
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export interface Chapter {
  title: string;
  startMs: number;
  endMs: number;
}

export type DescriptionMarkerKind = "timestamp" | "numbered" | "highlight" | "chapter";

export interface DescriptionMarker {
  title: string;
  timestampMs: number;
  timestampFormatted: string;
  isHighlight?: boolean;
  kind?: DescriptionMarkerKind;
}

export interface SourceProvenance {
  source: string;
  extractedAt: string;
  fields: Record<string, string>;
}

export type CommentStatus = "available" | "unavailable" | "disabled";

export interface CommentTimestampMention {
  timestampMs: number;
  timestampFormatted: string;
  context: string;
}

export interface SourceComment {
  id: string;
  parentId?: string;
  isReply: boolean;
  author?: string;
  authorId?: string;
  text: string;
  likeCount: number;
  replyCount: number;
  timestampMentions: CommentTimestampMention[];
  engagementWeight: number;
}

export interface CommentCluster {
  centerMs: number;
  centerFormatted: string;
  startMs: number;
  endMs: number;
  mentionCount: number;
  commentCount: number;
  distinctAuthorCount: number;
  score: number;
  supportingCommentIds: string[];
}

export interface CommentSignals {
  status: CommentStatus;
  reason?: string;
  comments: SourceComment[];
  clusters: CommentCluster[];
  provenance: SourceProvenance;
}

export type HeatmapUnavailableReason = 'not-provided' | 'empty' | 'malformed' | 'unknown-duration'
  | 'unsupported-source' | 'provider-unsupported' | 'retrieval-timeout' | 'extraction-failed' | 'invalid-serialized';
export interface HeatmapSignals {
  status: 'available' | 'unavailable' | 'disabled';
  reason?: HeatmapUnavailableReason;
  timeline: 'source';
  timeUnit: 'ms';
  intensitySemantics: 'relative-replay-interest';
  bins: { startMs: number; endMs: number; intensity: number }[];
  provenance: SourceProvenance;
}

export interface SourceContext {
  version: typeof SOURCE_CONTEXT_VERSION;
  source: SourceIdentity;
  metadata: SourceMetadata;
  chapters: Chapter[];
  descriptionMarkers: DescriptionMarker[];
  transcript?: unknown;
  comments?: CommentSignals;
  heatmap?: HeatmapSignals;
  visualSignals?: unknown;
  audioSignals?: unknown;
  provenance: SourceProvenance;
}
