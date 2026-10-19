import type { EditPlan } from "./edit-plan";
export type MuseSource = { id: string; title: string; duration: number; sourceUrl?: string };
export function buildMusePrompt(prompt: string, schema: { properties: object; required: readonly string[] }, source: MuseSource, options?: { requestId: string; analysisKey?:string; lockedPlan?:EditPlan }): string;
export function parseMusePlan(raw: string, source: MuseSource, providerName?: string, options?: { requestId: string; analysisKey?:string; lockedPlan?:EditPlan }): Omit<EditPlan, "providerUsed" | "render"> & { hookSelections?: import("./teaser-import.mjs").ExternalSelection[] };
