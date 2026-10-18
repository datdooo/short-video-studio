import type { EditPlan } from "./edit-plan";
export type PartTime = { start: string; end: string };
export function timeInput(seconds: number): string;
export function partTimes(plan: EditPlan): PartTime[];
export function applyPartTimes<T extends Pick<EditPlan, "parts" | "providerUsed">>(plan: T, times: PartTime[], sourceDuration?: number): T;
