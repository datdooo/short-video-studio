export type TextEffectId = "none" | "soft-shadow" | "heavy-shadow" | "current-title-glow" | "current-title-glow-shine";
export type EffectLayer = { id: string; color: string; opacity: number; x: number; y: number; svgY?: number; blur: number };
export const TEXT_EFFECT_IDS: readonly TextEffectId[];
export function textEffectLayers(id: string): EffectLayer[];
export function textShadowCss(id: string): string;
