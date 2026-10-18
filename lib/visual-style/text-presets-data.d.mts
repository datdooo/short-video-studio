import type { TextPreset, TextPresetId } from "./text-presets.mjs";
export const TEXT_PRESET_IDS: readonly TextPresetId[];
export function textPresetDefinition(id: string): TextPreset;
