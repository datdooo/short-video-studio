'use client';
import {useEffect,useRef}from'react';import type{RefObject}from'react';
// Reuse the active foreground decode as a small GPU canvas texture. No extra
// background decoder, readback, image allocation or per-pixel processing.
export function PreviewBackground({video,filter,opacity}:{video:RefObject<HTMLVideoElement|null>;filter:string;opacity:number}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=canvas.current,ctx=c?.getContext('2d');let frame=0,last:HTMLVideoElement|null=null,time=-1;
 const draw=()=>{const v=video.current;if(ctx&&v&&v.readyState>=2&&(v!==last||v.currentTime!==time)){const w=v.videoWidth,h=v.videoHeight;if(w&&h){const scale=Math.max(270/w,480/h),sw=270/scale,sh=480/scale;try{ctx.drawImage(v,(w-sw)/2,(h-sh)/2,sw,sh,0,0,270,480);last=v;time=v.currentTime;}catch{/* A decode can be released between readyState and drawImage during a deck swap. */}}}frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);},[video]);
 return <canvas ref={canvas} width={270} height={480} aria-hidden="true" className="absolute inset-0 size-full" style={{filter,opacity}}/>;
}
