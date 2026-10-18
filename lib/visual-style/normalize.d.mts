import type { StylePlan, VisualStyle } from "./types";
import type { SubtitleStyle } from "../subtitles.mjs";
export function normalizeVisualStyle(value?: unknown): VisualStyle;
export function resolvePlanVisualStyle(plan?: StylePlan): VisualStyle;
export function snapshotPlanVisualStyle<T extends StylePlan>(plan: T): T & { visualStyle: VisualStyle; subtitles: SubtitleStyle };
export function assertRenderableVisualStyle(style?: unknown): VisualStyle;
export function serializeVisualStyle(style?: unknown): string;
export function deserializeVisualStyle(json: string): VisualStyle;
