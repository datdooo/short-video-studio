import type {EditPlan} from '../edit-plan';
export function lockedParts(plan?:Partial<EditPlan>):boolean[];
export function assertMainLocks(plan:Pick<EditPlan,'parts'>,current?:Partial<EditPlan>):void;
export function restoreLockedParts<T extends Pick<EditPlan,'parts'>>(plan:T,current?:Partial<EditPlan>):T;
