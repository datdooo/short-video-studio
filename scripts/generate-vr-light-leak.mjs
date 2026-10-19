// Original local procedural asset. No remote/reference media is copied.
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {VR_LEAK_WIDTH as w,VR_LEAK_HEIGHT as h,VR_LEAK_FRAMES as n,vrLeakPixel} from '../lib/music/vr-light-leak.mjs';
const data=Buffer.alloc(w*h*n*3);
for(let frame=0;frame<n;frame++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const pixel=vrLeakPixel(x/w,y/h,frame/(n-1)),at=((frame*h+y)*w+x)*3;data.set(pixel,at);
}
await mkdir('public/effects',{recursive:true});
await sharp(data,{raw:{width:w,height:h*n,channels:3}}).png({compressionLevel:9}).toFile('public/effects/warm-cloud-leak-v2.png');
