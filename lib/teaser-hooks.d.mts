import type { EditPart, Segment } from "./edit-plan";
export type Teaser = { selectionPolicy?: "later-main-v1"; version: 1; rangeKey: string; reason: string } & ({ status: "unavailable" } | {
  status: "selected"; start: number; end: number; selection: "ai" | "fallback" | "external-import";
  relation: string; evidenceTimes: number[]; limitations: string[]; provider: string; model: string;
  promptVersion: string; inputKey: string; transition: "inherit-or-dip-black";
});
export const TEASER_POLICY: "per-part-v1";
export const HOOK_PROMPT_VERSION: string;
export const HOOK_TARGET_SECONDS: number;
export function mainRanges(part: EditPart): Segment[];
export function hookRangeKey(part: EditPart): string;
export function validateTeaser(part: EditPart, sourceDuration?: number): void;
export function fallbackTeaser(part: EditPart, reason?: string, cues?: {start:number;end:number;text:string}[], inputKey?: string): Teaser;
export function presentationSegments(part: EditPart): Segment[];
export function presentationDuration(part: EditPart): number;
export function hookTransitionId(part: EditPart, ordinary?: string, override?: import("./edit-plan").EditPlan["hookTransition"]): "none" | "dip-black" | "flash-white" | "rainbow-light-leak";
export function partTransitionWindows(part: EditPart, ordinary?: string, override?: import("./edit-plan").EditPlan["hookTransition"]): import("./visual-style/cut-transitions.mjs").CutTransitionWindow[];

export const HOOK_SELECTION_POLICY:"later-main-v1";
export const HOOK_MAIN_EXCLUSION_SECONDS:number;
export function permittedHookRanges(part:Pick<EditPart,"segments">):{start:number;end:number}[];
export function hookNeedsReselection(part:EditPart):boolean;
export function unavailableHook(part:EditPart,reason:string):Teaser;
