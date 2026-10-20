import type { EditPlan, EditPart, Segment } from "./edit-plan";
export type Teaser = { selectionPolicy?: "later-main-v1" | "adaptive-editorial-v3"; version: 1; rangeKey: string; reason: string } & ({ status: "unavailable" } | {
  status: "selected"; start: number; end: number; selection: "ai" | "fallback" | "external-import" | "manual";
  candidateId?:string;kind?:string;partUnderstanding?:string;contentTypes?:string;observed?:string;startContext?:string;standalone?:boolean;complete?:boolean;endingBasis?:string;cueIds?:string[];replayUse?:string;
  heatmapEvidence?:{available:boolean;supportsSelection:boolean;peakTimes:number[];reason:string};alternatives?:import("./teaser-import.mjs").ExternalChoice[];
  ending?: string; relation: string; evidenceTimes: number[]; limitations: string[]; provider: string; model: string;
  promptVersion: string; inputKey: string; transition: "inherit-or-dip-black";
});
export const TEASER_POLICY: "per-part-v1";
export const HOOK_PROMPT_VERSION: string;
export const HOOK_PREFERRED_MIN_SECONDS: number;
export const HOOK_MAX_SECONDS: number;
export const LEGACY_HOOK_PROMPT_VERSION: string;
export const LEGACY_HOOK_SELECTION_POLICY: "later-main-v1";
export function isLaterHookPolicy(policy: unknown): boolean;
export function hookDurationLimits(playbackRate?:number): {playbackRate:number;preferredMinRenderedSeconds:number;maxRenderedSeconds:number;preferredMinSourceSeconds:number;maxSourceSeconds:number};
export function hookCandidates(part:Pick<EditPart,"segments">,cues?:{start:number;end:number;text:string}[],playbackRate?:number,signals?:object):import("./teaser-candidates.mjs").HookCandidate[];
export function mainRanges(part: EditPart): Segment[];
export function hookRangeKey(part: EditPart): string;
export function validateTeaser(part: EditPart, sourceDuration?: number): void;
export function fallbackTeaser(part: EditPart, reason?: string, cues?: {start:number;end:number;text:string}[], inputKey?: string): Teaser;
export function presentationSegments(part: EditPart): Segment[];
export function presentationDuration(part: EditPart): number;
export function hookTransitionId(part: EditPart, ordinary?: string, override?: import("./edit-plan").EditPlan["hookTransition"]): "none" | "dip-black" | "flash-white" | "rainbow-light-leak" | "vr-light-leak-v2";
export function partTransitionWindows(part: EditPart, ordinary?: string, override?: import("./edit-plan").EditPlan["hookTransition"]): import("./visual-style/cut-transitions.mjs").CutTransitionWindow[];

export const HOOK_SELECTION_POLICY:"adaptive-editorial-v3";
export const HOOK_MAIN_EXCLUSION_SECONDS:number;
export function permittedHookRanges(part:Pick<EditPart,"segments">,playbackRate?:number):{start:number;end:number}[];
export function hookNeedsReselection(part:EditPart):boolean;
export function unavailableHook(part:EditPart,reason:string):Teaser;

export function chooseTeaserAlternative(part:EditPart,index:number):EditPart;
export function adjustTeaserRange(part:EditPart,start:number,end:number,cues?:{start:number;end:number;text:string}[]):EditPart;
export function teaserReadiness(plan:Pick<EditPlan,"parts">,sourceDuration?:number,cues?:{start:number;end:number;text:string}[]):{partId:number;reason:string}[];
export function requireBothTeasers(plan:Pick<EditPlan,"parts">,sourceDuration?:number,cues?:{start:number;end:number;text:string}[]):void;
