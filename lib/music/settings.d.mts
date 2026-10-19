export type MusicSettings={version:1;enabled:boolean;volume:number;ducking:boolean;assetId?:string;overrides?:Record<string,string|null>};
export type SpeechActivity={version:'webrtc-vad-v1';sourceId:string;sourceKey:string;cacheKey:string;timeUnit:'source-seconds';status:'available'|'unavailable';intervals:{start:number;end:number}[];limitations:string[]};
export function normalizeMusic(raw?:unknown):MusicSettings;
export function effectiveMusic(raw:unknown,partId:number):MusicSettings;
export function validateSpeechActivity(raw:unknown,source:{id:string;duration:number}):SpeechActivity;
