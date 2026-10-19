export function createAnalysisRequestGuard():{
 begin():{serial:number;controller:AbortController};invalidate():void;
 isCurrent(ticket:{serial:number;controller:AbortController}):boolean;
 finish(ticket:{serial:number;controller:AbortController}):void;
};
