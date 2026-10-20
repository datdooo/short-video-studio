export type HookCandidate={id:string;start:number;end:number;renderedSeconds:number;text:string;cueIds:string[];kind:string;boundaryEvidence:string;editorialVerified:boolean;proposalSignals?:{time:number;basis:string}[];boundaryOptions?:{start:number;end:number;text:string;cueIds:string[]}[];before:{cueId:string;start:number;end:number;text:string}[];after:{cueId:string;start:number;end:number;text:string}[];supporting:object};
export function diverseExcerpts<T extends {start:number;end:number}>(candidates:T[],limit?:number):T[];
export function buildHookCandidates(ranges:{start:number;end:number}[],cues:{start:number;end:number;text:string}[],rate:number,maxSourceSeconds:number,signals?:object):HookCandidate[];
export function partContextWindows(ranges:{start:number;end:number}[],cues:{start:number;end:number;text:string}[]):{cueId:string;start:number;end:number;text:string}[][];
export function candidateFrameTimes(candidates:HookCandidate[]):{time:number;candidateId:string}[];
