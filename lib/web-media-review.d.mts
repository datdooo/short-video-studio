import type {EditPart} from './edit-plan';
import type {ExternalSelection} from './teaser-import.mjs';
export type WebMediaReview={
 version:'manual-media-review-v1';sourceId:string;duration:number|null;reviewDepth:'standard'|'deep';depthReason:string;
 video:{mode:'continuous'|'sampled'|'unavailable'|'unknown';reviewedRanges:[number,number][];gaps:[number,number][];sampleIntervalSeconds:number|null};
 audio:{mode:'listened'|'transcript-only'|'partial'|'unavailable'|'unknown';reviewedRanges:[number,number][]};
 model:string;reasoningMode:string;
 checkpoints:{id:string;status:'reviewed'|'partial'|'unavailable';at:number|null;note:string}[];
 focusChecks:{partId:number;choiceIndex:number;start:number;end:number;video:'continuous'|'sampled'|'unavailable'|'unknown';audio:'listened'|'transcript-only'|'unavailable'|'unknown';note:string}[];
 limitations:string[];
};
export const WEB_MEDIA_REVIEW_VERSION:'manual-media-review-v1';
export const WEB_MEDIA_REVIEW_INSTRUCTIONS:string;
export function webMediaReviewPlan(source:{id:string;duration:number}):Record<string,unknown>;
export function webMediaReviewSchema(source:{id:string;duration:number}):Record<string,unknown>;
export function validateWebMediaReview(value:unknown,source:{id:string;duration:number},parts:EditPart[],selections:ExternalSelection[]):WebMediaReview;
