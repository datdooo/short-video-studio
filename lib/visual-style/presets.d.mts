import type { VisualStyle } from "./types";
export function getVisualPreset(id?: string): VisualStyle;
export function listVisualPresets(): { id: "current"; name: string }[];
