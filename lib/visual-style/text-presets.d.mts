import type { VisualStyle, TextStyle } from "./types";
import type { SubtitleStyle } from "../subtitles.mjs";
export type TextPresetId = "current" | "clean" | "shorts-bold" | "yellow-hook" | "minimal" | "news" | "jp-clean" | "kr-clean";
export const TEXT_PRESET_IDS: readonly TextPresetId[];
export type TextPreset = { id: TextPresetId; label: string; description: string; originalTitle: TextStyle; partTitle: TextStyle; partIndicator: TextStyle; subtitle: SubtitleStyle };
export function getTextPreset(id?: string): TextPreset;
export function listTextPresets(): TextPreset[];
export function applyTextPreset(input: unknown, id: string): VisualStyle;
export function applyFontOverride(input: unknown, font: unknown): VisualStyle;
