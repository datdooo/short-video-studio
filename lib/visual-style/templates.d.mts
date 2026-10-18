import type { VisualStyle } from "./types";
export type VisualTemplateId = "current" | "viral-shorts" | "clean-tutorial" | "farming-jp" | "korean-tutorial" | "news" | "cinematic-dark" | "bright-social";
export type VisualTemplate = { id: VisualTemplateId; label: string; description: string; category: "classic" | "social" | "tutorial" | "regional" | "information" | "cinematic"; textPresetId: import("./text-presets.mjs").TextPresetId; fontId: import("./fonts.mjs").FontId; filterPresetId: import("./filters.mjs").FilterPresetId; backgroundPresetId: import("./backgrounds.mjs").BackgroundPresetId; overlayPresetId: import("./overlays.mjs").OverlayPresetId };
export const VISUAL_TEMPLATE_IDS: readonly VisualTemplateId[];
export function getVisualTemplate(id?: string): VisualTemplate;
export function listVisualTemplates(): VisualTemplate[];
export function applyVisualTemplate(input: unknown, id: string): VisualStyle;
export function matchVisualTemplate(input?: unknown): VisualTemplateId | null;
