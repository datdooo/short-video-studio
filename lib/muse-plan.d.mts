import type { EditPlan } from "./edit-plan";
export type MuseSource = { id: string; title: string; duration: number; sourceUrl?: string };
export function buildMusePrompt(prompt: string, schema: { properties: object; required: readonly string[] }, source: MuseSource, options?: { requestId: string }): string;
export function parseMusePlan(raw: string, source: MuseSource, providerName?: string, options?: { requestId: string }): Omit<EditPlan, "providerUsed" | "render"> & { hookSelections?: import("./teaser-import.mjs").ExternalSelection[] };
