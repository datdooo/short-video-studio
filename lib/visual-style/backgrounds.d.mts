export type BackgroundPresetId = "current" | "dark-blur" | "light-blur" | "black" | "soft-gradient" | "dark-gradient";
export type Background =
  | { presetId?: "dark-blur" | "light-blur"; mode: "source-blur"; baseColor: string; opacity: number; blur: { radius: number; passes: number; workingWidth: number; workingHeight: number } }
  | { presetId: "black"; mode: "solid"; baseColor: string }
  | { presetId: "soft-gradient" | "dark-gradient"; mode: "gradient"; gradient: { type: "linear"; angle: 180; stops: { position: number; color: string }[] } };
export const CURRENT_BACKGROUND: import("./types").DeepReadonly<Background>;
export const BACKGROUND_PRESET_IDS: readonly BackgroundPresetId[];
export function getBackgroundPreset(id?: string): { id: BackgroundPresetId; label: string; background: Background };
export function listBackgroundPresets(): ReturnType<typeof getBackgroundPreset>[];
export function normalizeBackground(value?: unknown): Background;
export function assertRenderableBackground(value?: unknown): Background;
export function backgroundCss(value?: unknown): { backgroundColor?: string; backgroundImage?: string };
export function gradientRowRgb(value: unknown, y: number, height: number): number[];
