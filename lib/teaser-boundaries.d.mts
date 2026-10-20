type Caption={start:number;end:number;text:string};
type Range={start:number;end:number};
export const SPEECH_TAIL_SECONDS:number;
export function speechEndingOptions(cues:Caption[],ranges:Range[],silences?:Range[]):{lastCueStart:number;lastCueEnd:number;suggestedEnd:number;text:string;nextSpeechStart:number|null;measuredSilence?:Range;limitation:string}[];
export function hookSpeechBoundaryWarning(value:Range,cues?:Caption[]):string;
export function checkHookSpeechBoundaries<T extends Range>(value:T,cues?:Caption[],options?:{silences?:Range[]}):T;
