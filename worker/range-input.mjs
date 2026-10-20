import {mkdtemp,writeFile,open,rm,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {requireDiskSpace} from './analysis-cache.mjs';
// Packet concat is a sequential demuxer: only one source range is read at a
// time, even when a late teaser precedes early main content. It is NOT a concat
// filter over simultaneous trim branches. Non-keyframe preroll is rejected by
// select=concatdec_select in the single downstream video decoder.
function quoted(file){if(/[\r\n\0]/.test(file))throw Error('Invalid media path');return "'"+file.replace(/'/g,"'\\''")+"'";}
export async function prepareRangeInput({source,segments,directory,ffmpeg,run,signal,video=true}){
 signal?.throwIfAborted();
 if(!segments.length||segments.some(s=>!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start||s.end>source.duration+.001))throw Error('Invalid retained source ranges');
 const duration=segments.reduce((n,s)=>n+s.end-s.start,0),bytes=segments.reduce((n,s)=>n+Math.round((s.end-s.start)*48000)*8,0);
 // Lossless PCM uses 384kB/s of RETAINED footage, never the excluded source gap.
 // One part at a time; no video intermediate or duplicate downloaded source.
 await requireDiskSpace(directory,256*1024*1024+bytes+Math.max(...segments.map(s=>Math.round((s.end-s.start)*48000)*8))+8*1024*1024);
 const root=await mkdtemp(path.join(directory,'.range-input-')),audio=path.join(root,'audio.f32le'),list=path.join(root,'video.ffconcat');
 try{
  if(video)await writeFile(list,'ffconcat version 1.0\n'+segments.map(s=>`file ${quoted(source.mediaPath)}\ninpoint ${s.start}\noutpoint ${s.end}\nduration ${s.end-s.start}\n`).join(''),{mode:0o600});
  const output=await open(audio,'wx',0o600);
  try{
   for(const [index,s]of segments.entries()){
    signal?.throwIfAborted();const samples=Math.round((s.end-s.start)*48000),expected=samples*8;
    if(source.hasAudio){
     const chunk=path.join(root,`audio-${index}.pcm`);
     try{
      // Accurate input seek discards decoder preroll; trim is sample-based after
      // resampling. Independent seeks include the teaser's original audio twice.
      await run(ffmpeg,['-v','error','-y','-ss',String(s.start),'-t',String((samples+4800)/48000),'-i',source.mediaPath,'-map','0:a:0','-vn','-sn','-dn','-af',`asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,atrim=end_sample=${samples}`,'-c:a','pcm_f32le','-f','f32le',chunk],{signal});
      const size=(await stat(chunk)).size;
      if(size!==expected)throw Error('Audio range thiếu/thừa sample; đã dừng để tránh lệch tiếng. Không tự chèn padding hoặc cắt main.');
      for await(const buffer of createReadStream(chunk,{highWaterMark:65536})){signal?.throwIfAborted();let offset=0;while(offset<buffer.length){const {bytesWritten}=await output.write(buffer,offset,buffer.length-offset);if(!bytesWritten)throw Error('Không ghi được audio range');offset+=bytesWritten;}}
     }finally{await rm(chunk,{force:true});}
    }else{
     // No source audio: bounded zero blocks instead of an infinite lavfi input.
     const silence=Buffer.alloc(65536);for(let remaining=expected;remaining>0;){signal?.throwIfAborted();const length=Math.min(remaining,silence.length);let offset=0;while(offset<length){const {bytesWritten}=await output.write(silence,offset,length-offset);if(!bytesWritten)throw Error('Không ghi được silence');offset+=bytesWritten;}remaining-=length;}
    }
   }
  }finally{await output.close();}
  return{list,audio,duration,dispose:()=>rm(root,{recursive:true,force:true})};
 }catch(error){await rm(root,{recursive:true,force:true});throw error;}
}
