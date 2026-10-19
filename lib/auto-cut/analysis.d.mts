import type {EditPlan,EditPart} from '../edit-plan';
import type {MainAnalysis} from './main-content.mjs';
export function invalidateEditedAnalysis(plan:Pick<EditPlan,'parts'|'analysis'>,parts:EditPart[],duration:number):MainAnalysis|undefined;
export function validateMainAnalysis(value:unknown,source:{id:string;duration:number}):void;
