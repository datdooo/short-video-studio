export const VIDEO_TEXT_VERSION:string;
export const VIDEO_TEXT_INSTRUCTIONS:string;
export function canonicalVideoInput(input:unknown,options?:{enforceLimit?:boolean}):{value:unknown;counts:Record<string,number>;availability:Record<string,string>;encoded:boolean;characters:number};
