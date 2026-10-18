import type { SubtitleStyle } from "../subtitles.mjs";

export type StyleFont = import("./fonts.mjs").FontId;
export type TextSizePolicy =
  | { mode: "auto-fit"; min: number; max: number; maxLines: number; maxWidth: number; lineSpacing: number }
  | { mode: "fixed"; value: number };
export type TextStyle = {
  font: StyleFont;
  fontWeight: 400 | 500 | 600 | 700 | 800 | 900;
  size: TextSizePolicy;
  color: string;
  outlineColor: string;
  outline: number;
  alignment: "left" | "center" | "right";
  opacity: number;
  effect: import("./effects.mjs").TextEffectId;
  layout: "original-title-zone" | "part-title-zone" | "part-indicator";
};
export type OverlayStyle = import("./overlays.mjs").SceneOverlay | {
  id: string;
  type: "image";
  assetId: string;
  opacity: number;
  blendMode: "normal" | "screen" | "multiply";
  position: { x: number; y: number };
  scale: number;
};
export type VisualStyle = {
  version: 1;
  presetId: "current";
  titleAnimation?: import("./animations.mjs").TitleAnimationId;
  cutTransition?: import("./cut-transitions.mjs").CutTransitionId;
  textPresetId?: import("./text-presets.mjs").TextPresetId;
  originalTitle: TextStyle;
  partTitle: TextStyle;
  partIndicator: TextStyle;
  // Exactly the existing normalized subtitle representation, not a second model.
  subtitle: SubtitleStyle;
  foreground: { layout: "native-center-crop-pad"; scale: number; position: "center" };
  background: import("./backgrounds.mjs").Background;
  filter: import("./filters.mjs").VideoFilter;
  overlays: OverlayStyle[];
};
export type StylePlan = { visualStyle?: unknown; subtitles?: unknown };
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
