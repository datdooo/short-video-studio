import type { EditPart, EditPlan } from "../lib/edit-plan";
export function effectiveCutPlan<T extends Pick<EditPlan,'parts'|'providerUsed'>>(plan: T): T;
export const PART_START_TRIM_SECONDS: 1;
export function trimPartStart(part: EditPart): EditPart;
