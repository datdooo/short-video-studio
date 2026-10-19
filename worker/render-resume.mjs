import {lstat} from 'node:fs/promises';
// Only this immutable job's expected filename/geometry/duration may be reused.
export async function verifiedRenderOutput({file,filename,record,sourceId,jobId,partId,duration,probe}) {
  try{
    if(filename.includes('/')||filename.includes('\\')||!filename.endsWith('.mp4'))return null;
    const info=await lstat(file);if(!info.isFile()||info.size<1024||record&&(record.filename!==filename||record.size!==info.size))return null;
    const media=await probe(file);
    if(media.width!==1080||media.height!==1920||!media.hasAudio||!Number.isFinite(media.duration)||Math.abs(media.duration-duration)>=.25)return null;
    return{part:partId,filename,size:info.size,url:`/files/${sourceId}/outputs/${jobId}/part-${partId}/${encodeURIComponent(filename)}`};
  }catch{return null;}
}
