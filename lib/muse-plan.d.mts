import type { EditPlan } from "./edit-plan";
export type MuseSource = { id: string; title: string; duration: number };
export function buildMusePrompt(prompt: string, schema: { properties: object; required: readonly string[] }, source: MuseSource): string;
export function parseMusePlan(raw: string, source: MuseSource): Omit<EditPlan, "providerUsed" | "render">;
