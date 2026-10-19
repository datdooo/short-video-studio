// Small original atlas, decoded once per preview; no per-pixel UI work.
import sharp from'sharp';import{mkdir}from'node:fs/promises';
import{TRANSITION_WIDTH as w,TRANSITION_HEIGHT as h,TRANSITION_FRAMES as n,SPRITE_IDS,TRANSITION_SPRITE,transitionPixel}from'../lib/visual-style/foreground-transitions.mjs';
const data=Buffer.alloc(w*h*n*SPRITE_IDS.length*3);
for(const[index,id]of SPRITE_IDS.entries())for(let f=0;f<n;f++)for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(transitionPixel(id,x/w,y/h,f/(n-1)),(((f*h+y)*(w*SPRITE_IDS.length))+index*w+x)*3);
await mkdir('public/effects',{recursive:true});await sharp(data,{raw:{width:w*SPRITE_IDS.length,height:h*n,channels:3}}).png({compressionLevel:9}).toFile('public'+TRANSITION_SPRITE);
