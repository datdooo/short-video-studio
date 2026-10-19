export interface LocalSignals {
 version:'ffmpeg-local-v1'; sourceKey:string; timeUnit:'source-seconds'; cacheKey?:string;
 sampledRanges:{start:number;end:number}[];
 visual:{status:'available'|'unavailable'|'disabled';reason?:string;boundaries:{time:number;change:number}[];activity:{start:number;end:number;change:number}[]};
 audio:{status:'available'|'unavailable'|'disabled';reason?:string;silences:{start:number;end:number}[];activity:{start:number;end:number;activity:number}[]};
}
export const LOCAL_SIGNAL_VERSION:'ffmpeg-local-v1';
export const MAX_LOCAL_ENTRIES:number;
export function normalizeLocalSignals(value:unknown,options:{duration:number;sourceKey:string}):LocalSignals;
