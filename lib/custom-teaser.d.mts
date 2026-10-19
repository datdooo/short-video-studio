import type{EditPart}from'./edit-plan';
export type CustomTeaser={version:1;mode:'timestamp'|'description';input:string};
export function parseCustomTeaser(input:string):{mode:'auto'|'description';input:string}|{mode:'timestamp';input:string;start:number;end:number};
export function customTimestampPart(part:EditPart,input:string,cues?:{start:number;end:number;text:string}[]):EditPart;
export function validateCustomTeaser(part:EditPart):void;
