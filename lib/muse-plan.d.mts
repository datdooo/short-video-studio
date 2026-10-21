import type { EditPlan } from "./edit-plan";
export type MuseSource = { id: string; title: string; duration: number; sourceUrl?: string };
export function buildMusePrompt(prompt: string, schema: { properties: object; required: readonly string[] }, source: MuseSource, options?: { requestId: string; analysisKey?:string; lockedPlan?:EditPlan; context?:Record<string,unknown> }): string;
export function parseMusePlan(raw: string, source: MuseSource, providerName?: string, options?: { requestId: string; analysisKey?:string; lockedPlan?:EditPlan }): Omit<EditPlan, "providerUsed" | "render"> & { hookSelections?: import("./teaser-import.mjs").ExternalSelection[] };

export const WEB_AI_PROMPT_VERSION:'external-editing-text-v1';
export function splitWebAiPrompt(prompt:string):string[];
