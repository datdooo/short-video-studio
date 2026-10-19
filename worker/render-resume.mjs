import {EXPORT_METADATA_POLICY} from './export-metadata.mjs';
import {lstat} from 'node:fs/promises';
// Reuse requires a recorded new-policy render as well as file/geometry/duration.
// Legacy/unrecorded files remain untouched and cannot acquire a clean label.
export async function verifiedRenderOutput({file,filename,record,sourceId,jobId,partId,duration,probe}) {
  try{
    if(record?.metadataPolicy!==EXPORT_METADATA_POLICY)return null;
    if(filename.includes('/')||filename.includes('\\')||!filename.endsWith('.mp4'))return null;
    const info=await lstat(file);if(!info.isFile()||info.size<1024||record&&(record.filename!==filename||record.size!==info.size))return null;
    const media=await probe(file);
    if(media.width!==1080||media.height!==1920||!media.hasAudio||!Number.isFinite(media.duration)||Math.abs(media.duration-duration)>=.25)return null;
    return{part:partId,filename,size:info.size,metadataPolicy:EXPORT_METADATA_POLICY,url:`/files/${sourceId}/outputs/${jobId}/part-${partId}/${encodeURIComponent(filename)}`};
  }catch{return null;}
}
