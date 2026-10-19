import type {CutTransitionWindow} from '../visual-style/cut-transitions.mjs';
export const VR_LEAK_ID:'vr-light-leak-v2';
export const VR_LEAK_SPRITE:string;
export const VR_LEAK_WIDTH:number,VR_LEAK_HEIGHT:number,VR_LEAK_FRAMES:number;
export function vrLeakPixel(x:number,y:number,p:number):number[];
export function vrLeakFrame(window:CutTransitionWindow,seconds:number):number;
export function foregroundLeakClip(width:number,height:number):{x:number;y:number;width:number;height:number};
export function vrLeakForegroundFilters(input:string,output:string,windows:CutTransitionWindow[],spriteInput:number,width?:number,height?:number):string[];
