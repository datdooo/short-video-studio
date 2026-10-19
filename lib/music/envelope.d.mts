import type{EditPart}from'../edit-plan';import type{MusicSettings,SpeechActivity}from'./settings.mjs';
export const DUCK_GAIN:number,PRE_ROLL:number,ATTACK:number,HOLD:number,RECOVERY:number;
export function mapSpeechIntervals(part:EditPart,activity?:SpeechActivity):{start:number;end:number}[];
export function duckWindows(intervals:{start:number;end:number}[],duration:number):{start:number;end:number}[];
export function musicGainAt(t:number,duration:number,settings:MusicSettings,windows:{start:number;end:number}[]):number;
export function duckGainAt(t:number,windows:{start:number;end:number}[]):number;
export function duckExpression(windows:{start:number;end:number}[]):string;
export function mixSample(source:number,music:number):number;
