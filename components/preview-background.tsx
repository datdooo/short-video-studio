'use client';
import {useEffect,useRef}from'react';import type{RefObject}from'react';
// Reuse the active foreground decode as a small GPU canvas texture. No extra
// background decoder, readback, image allocation or per-pixel processing.
export function PreviewBackground({video,filter,opacity,suspended=false,activeDeck,sourceKey}:{suspended?:boolean;video:RefObject<HTMLVideoElement|null>;filter:string;opacity:number;activeDeck?:number;sourceKey?:string}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const enabled=!suspended&&opacity>0;
 useEffect(()=>{
  if(!enabled)return;const ctx=canvas.current?.getContext('2d'),v=video.current;
  if(!ctx||!v)return;let frame=0,videoFrame:number|undefined,time=-1,disposed=false,force=true;
  const paint=()=>{
   if(disposed||video.current!==v||v.readyState<2)return;
   if(!force&&v.currentTime===time)return;
   const w=v.videoWidth,h=v.videoHeight;if(!w||!h)return;
   const scale=Math.max(270/w,480/h),sw=270/scale,sh=480/scale;
   try{ctx.drawImage(v,(w-sw)/2,(h-sh)/2,sw,sh,0,0,270,480);time=v.currentTime;force=false;}catch{/* A handoff can release a decoded frame. */}
  };
  const next=()=>{
   if(disposed||v.paused||v.ended||video.current!==v)return;
   if(typeof v.requestVideoFrameCallback==='function'){
    if(videoFrame===undefined)videoFrame=v.requestVideoFrameCallback(()=>{videoFrame=undefined;paint();next();});
   }else if(!frame)frame=requestAnimationFrame(()=>{frame=0;paint();next();});
  };
  const refresh=()=>{force=true;if(!frame)frame=requestAnimationFrame(()=>{frame=0;paint();next();});};
  const stop=()=>{if(videoFrame!==undefined){v.cancelVideoFrameCallback(videoFrame);videoFrame=undefined;}cancelAnimationFrame(frame);frame=0;refresh();};
  const events=['loadeddata','canplay','seeked','timeupdate','playing'] as const;
  events.forEach(event=>v.addEventListener(event,refresh));v.addEventListener('pause',stop);v.addEventListener('ended',stop);refresh();
  return()=>{disposed=true;cancelAnimationFrame(frame);if(videoFrame!==undefined)v.cancelVideoFrameCallback(videoFrame);events.forEach(event=>v.removeEventListener(event,refresh));v.removeEventListener('pause',stop);v.removeEventListener('ended',stop);};
 },[video,enabled,activeDeck,sourceKey]);
 return <canvas ref={canvas} width={270} height={480} aria-hidden="true" className="absolute inset-0 size-full" style={{filter,opacity}}/>;
}
