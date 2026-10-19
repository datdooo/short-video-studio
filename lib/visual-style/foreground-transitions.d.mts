import type{CutTransitionWindow}from'./cut-transitions.mjs';
export {foregroundLeakClip}from'../music/vr-light-leak.mjs';
export const TRANSITION_SPRITE:string,TRANSITION_WIDTH:number,TRANSITION_HEIGHT:number,TRANSITION_FRAMES:number;
export const SPRITE_IDS:readonly string[];
export function transitionFrame(w:CutTransitionWindow,seconds:number):number;
export function transitionPixel(id:string,x:number,y:number,p:number):number[];
export function foregroundTransitionFilters(input:string,output:string,windows:CutTransitionWindow[],spriteInput:number,width?:number,height?:number,clockRate?:number):string[];
