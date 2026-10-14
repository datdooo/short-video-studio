import type { EditPlan } from "./edit-plan";
export type PartTime = { start: string; end: string };
export function timeInput(seconds: number): string;
export function partTimes(plan: EditPlan): PartTime[];
export function applyPartTimes(plan: EditPlan, times: PartTime[], sourceDuration?: number): EditPlan;
