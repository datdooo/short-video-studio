import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,mkdtemp,readFile,writeFile,lstat,stat,link,rm} from 'node:fs/promises';
import path from 'node:path';
import {createSharedOperations} from './shared-operation.mjs';
import {requireDiskSpace} from './analysis-cache.mjs';

export const WEB_AI_VIDEO_LIMIT=512*1024*1024;
const TARGET_BYTES=480*1024*1024;
export const WEB_AI_VIDEO_VERSION='full-source-mp4-review-v2';
const error=(code,message)=>Object.assign(Error(message),{code});
const finite=value=>typeof value==='number'&&Number.isFinite(value);

// Only a delivery derivative. Never publish into sources, change mediaPath or
// reuse this lower-quality input in the editor, ASR, preview or final export.
export function createWebAiVideo({root,youtube,ffmpeg,run,probeMedia,fingerprint,isLocked=()=>false}){
 const shared=createSharedOperations(),identities=createSharedOperations(),busy=new Map();
 function retain(sourceId){if(isLocked(sourceId))throw error('SOURCE_BUSY','Nguồn đang ở Thùng rác hoặc đang di chuyển.');busy.set(sourceId,(busy.get(sourceId)||0)+1);return()=>{const n=busy.get(sourceId)||0;if(n<=1)busy.delete(sourceId);else busy.set(sourceId,n-1);};}
 function spanCheck(original,review){
  // Two encodes can add AAC priming/container rounding. These small tolerances
  // validate alignment; they never trim, change endpoints or repair timestamps.
  const epsilon=.25;
  if(!finite(review.duration)||Math.abs(review.duration-original.duration)>epsilon||Boolean(review.hasAudio)!==Boolean(original.hasAudio))throw error('WEB_VIDEO_TIMELINE','Bản video nhẹ không giữ đủ thời lượng hoặc âm thanh nguồn.');
  for(const key of ['videoStart','audioStart','audioEnd'])if(finite(original[key])&&(!finite(review[key])||Math.abs(review[key]-original[key])>epsilon))throw error('WEB_VIDEO_TIMELINE','Mốc âm thanh/hình ảnh của bản nhẹ lệch nguồn; chưa gửi.');
  if(finite(original.videoDuration)&&(!finite(review.videoDuration)||Math.abs(review.videoDuration-original.videoDuration)>epsilon))throw error('WEB_VIDEO_TIMELINE','Video nhẹ chưa chứng minh đủ khoảng hình ảnh nguồn.');
  if(!review.width||!review.height||Math.abs(review.width-original.width*review.height/original.height)>2.1)throw error('WEB_VIDEO_GEOMETRY','Tỉ lệ khung hình bản nhẹ không khớp nguồn.');
 }
 async function originalIdentity(source,signal){
  const info=await stat(source.mediaPath);signal?.throwIfAborted();
  if(!info.isFile())throw error('WEB_VIDEO_SOURCE','Không đọc được video nguồn.');
  const statKey=JSON.stringify([source.id,info.size,info.mtimeMs,info.dev,info.ino]);
  const needsDerivative=info.size>WEB_AI_VIDEO_LIMIT||path.extname(source.mediaPath).toLowerCase()!=='.mp4';
  const sourceHash=needsDerivative&&fingerprint?await identities(statKey,async active=>{const releaseHash=retain(source.id);try{return await fingerprint(source,active);}finally{releaseHash();}},signal):undefined;signal?.throwIfAborted();
  const signature={sourceHash,version:WEB_AI_VIDEO_VERSION,sourceId:source.id,kind:source.kind,sourceUrl:source.sourceUrl,bytes:info.size,mtimeMs:info.mtimeMs,dev:info.dev,ino:info.ino,duration:source.duration,sourceStart:source.sourceStart,videoStart:source.videoStart,videoDuration:source.videoDuration,audioStart:source.audioStart,audioEnd:source.audioEnd,hasAudio:source.hasAudio,width:source.width,height:source.height,maxBytes:WEB_AI_VIDEO_LIMIT};
  const key=createHash('sha256').update(JSON.stringify(signature)).digest('hex');
  return{info,key,signature};
 }
 function descriptor(source,file,bytes,{method='original',width=source.width,height=source.height,key,deliveryHash,originalBytes=bytes}={}){
  return{file,manifest:{id:`source-video-${source.id}`,sourceId:source.id,filename:`source-${source.id}.mp4`,bytes,duration:source.duration,clock:'source-seconds',playbackRate:1,coverage:[0,source.duration],width,height,representation:method==='original'?'original':'lower-resolution',preparation:method,originalBytes,variantKey:deliveryHash?createHash('sha256').update(JSON.stringify([key,deliveryHash])).digest('hex'):key,delivery:'website-file-input',providerReceipt:'not-verified',...(method==='youtube-lower-resolution'?{limitation:'Cùng YouTube ID và kiểm tra timeline/âm thanh; không chứng minh độc lập mọi cảnh không thay đổi trên máy chủ YouTube.'}:{})}};
 }
 async function cached(source,key,originalBytes){
  try{
   const metaPath=path.join(root,key+'.json'),metaInfo=await lstat(metaPath);
   if(!metaInfo.isFile()||metaInfo.isSymbolicLink()||metaInfo.size>65536)return null;
   const meta=JSON.parse(await readFile(metaPath,'utf8')),file=path.join(root,key+'.mp4'),info=await lstat(file);
   if(!meta||typeof meta!=='object'||Array.isArray(meta)||!meta.probe||typeof meta.probe!=='object'||!['youtube-lower-resolution','local-lower-resolution'].includes(meta.method)||typeof meta.deliveryHash!=='string'||!/^[a-f0-9]{64}$/.test(meta.deliveryHash)||meta.version!==WEB_AI_VIDEO_VERSION||meta.key!==key||meta.sourceId!==source.id||!info.isFile()||info.isSymbolicLink()||info.size!==meta.bytes||info.mtimeMs!==meta.mtimeMs||info.size>WEB_AI_VIDEO_LIMIT||info.size<1000)return null;
   spanCheck(source,meta.probe);
   return descriptor(source,file,info.size,{method:meta.method,width:meta.probe.width,height:meta.probe.height,key,deliveryHash:meta.deliveryHash,originalBytes});
  }catch(e){if(['ENOENT','ENOTDIR'].includes(e.code)||e instanceof SyntaxError||e.code?.startsWith('WEB_VIDEO_'))return null;throw e;}
 }
 async function prepare(source,key,info,signal){
  await mkdir(root,{recursive:true,mode:0o700});const rootInfo=await lstat(root);if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())throw error('WEB_VIDEO_CACHE','Cache video web không an toàn.');
  const previous=await cached(source,key,info.size);if(previous)return previous;
  await requireDiskSpace(root,WEB_AI_VIDEO_LIMIT*3);
  const directory=await mkdtemp(path.join(root,'prepare-')),operationId=randomUUID(),output=path.join(directory,'review.mp4');
  let method,probe;
  try{
   await writeFile(path.join(directory,'owner.json'),JSON.stringify({version:WEB_AI_VIDEO_VERSION,operationId,key,sourceId:source.id}),{flag:'wx',mode:0o600});
   // One lower-rendition acquisition, never a second full-size source import.
   // Its selector may choose 720/480/360 according to the byte budget.
   if(info.size>WEB_AI_VIDEO_LIMIT&&source.kind==='youtube'&&source.sourceUrl&&youtube?.downloadReview){
    try{
     await youtube.downloadReview(source.sourceUrl,{maxHeight:source.height>720?720:source.height>480?480:360,maxBytes:TARGET_BYTES},async value=>{
      signal.throwIfAborted();spanCheck(source,value.media);
      const downloaded=await stat(value.mediaPath);
      if(downloaded.size>TARGET_BYTES||value.media.height>=source.height&&value.media.width>=source.width)throw error('WEB_VIDEO_RENDITION','Không có bản tải nhỏ hơn phù hợp.');
      // Keep the managed original audio and its relative timing. Remote video
      // identity is structural (same ID/timeline), not a claim of frame equality.
      const args=['-hide_banner','-loglevel','error','-y','-copyts','-start_at_zero','-i',value.mediaPath,'-i',source.mediaPath,'-map','0:v:0',...(source.hasAudio?['-map','1:a:0']:['-an']),'-c:v','copy',...(source.hasAudio?['-c:a','aac','-b:a','96k']:[]),'-map_metadata','-1','-map_chapters','-1','-movflags','+faststart',output];
      await run(ffmpeg,args,{signal});probe=await probeMedia(output,signal);spanCheck(source,probe);
      if((await stat(output)).size>WEB_AI_VIDEO_LIMIT)throw error('WEB_VIDEO_TOO_LARGE','Bản tải nhẹ vẫn vượt giới hạn gửi web.');
      method='youtube-lower-resolution';
     },signal);
    }catch(e){signal.throwIfAborted();await rm(output,{force:true});if(e.code==='ENOSPC')throw e;}
   }
   if(!method){
    if(!ffmpeg)throw error('WEB_VIDEO_ENCODER','Thiếu FFmpeg để chuẩn bị bản gửi web nhẹ hơn.');
    const budget=Math.floor(TARGET_BYTES*8/(source.duration+.5));
    const audioRate=source.hasAudio?96000:0;
    if(!finite(source.duration)||source.duration<=0||budget-audioRate<150000)throw error('WEB_VIDEO_TOO_LONG','Video quá dài để tạo bản đủ nội dung trong 512 MiB; chưa gửi hoặc cắt bớt.');
    for(const [maxEdge,ceiling]of [[1280,2500000],[854,1400000],[640,900000]]){
     signal.throwIfAborted();const factor=Math.min(.75,maxEdge/Math.max(source.width,source.height));
     const width=Math.max(2,Math.floor(source.width*factor/2)*2),height=Math.max(2,Math.floor(source.height*factor/2)*2),rate=Math.min(ceiling,budget-audioRate);
     await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-copyts','-start_at_zero','-i',source.mediaPath,'-map','0:v:0',...(source.hasAudio?['-map','0:a:0']:['-an']),'-vf',`scale=${width}:${height}:flags=bicubic,setsar=1`,'-c:v','libx264','-threads','2','-preset','veryfast','-b:v',String(rate),'-maxrate',String(rate),'-bufsize',String(rate*2),'-pix_fmt','yuv420p','-fps_mode:v','passthrough','-enc_time_base:v','filter',...(source.hasAudio?['-c:a','aac','-b:a','96k']:[]),'-map_metadata','-1','-map_chapters','-1','-movflags','+faststart',output],{signal});
     probe=await probeMedia(output,signal);spanCheck(source,probe);
     if((await stat(output)).size<=WEB_AI_VIDEO_LIMIT){method='local-lower-resolution';break;}
    }
    if(!method)throw error('WEB_VIDEO_TOO_LARGE','Không tạo được video đầy đủ dưới 512 MiB. Nguồn và plan được giữ nguyên.');
   }
   signal.throwIfAborted();
   const unchanged=await originalIdentity(source,signal);if(unchanged.key!==key)throw error('WEB_VIDEO_SOURCE_CHANGED','Nguồn đã đổi trong lúc chuẩn bị video nhẹ. Chưa gửi.');
   const finalFile=path.join(root,key+'.mp4'),finalMeta=path.join(root,key+'.json'),outInfo=await lstat(output);
   // No overwrite of an unknown/corrupt cached artifact. Cleanup on publication
   // failure removes only our proven inode; original source is never touched.
   const hash=createHash('sha256');for await(const chunk of createReadStream(output)){signal.throwIfAborted();hash.update(chunk);}const deliveryHash=hash.digest('hex');
   const temporaryMeta=path.join(directory,'manifest.json');
   await writeFile(temporaryMeta,JSON.stringify({version:WEB_AI_VIDEO_VERSION,key,sourceId:source.id,method,bytes:outInfo.size,mtimeMs:outInfo.mtimeMs,probe,deliveryHash}),{flag:'wx',mode:0o600});
   signal.throwIfAborted();
   try{await link(output,finalFile);}catch(e){if(e.code==='EEXIST'){const winner=await cached(source,key,info.size);if(winner)return winner;throw error('WEB_VIDEO_CACHE_CONFLICT','Bản gửi web trong cache chưa xác minh được; giữ nguyên dữ liệu, chưa gửi.');}throw e;}
   try{await link(temporaryMeta,finalMeta);}catch(e){try{const current=await lstat(finalFile);if(outInfo.ino!==0&&current.dev===outInfo.dev&&current.ino===outInfo.ino)await rm(finalFile);}catch{/* Preserve ambiguity. */}throw e;}
   return descriptor(source,finalFile,outInfo.size,{method,width:probe.width,height:probe.height,key,deliveryHash,originalBytes:info.size});
  }finally{
   // directory is created by this operation only; never scan/remove old cache,
   // source files, exports, backups or another operation's temporary directory.
   await rm(directory,{recursive:true,force:true});
  }
 }
 async function ensure(source,signal){
  const release=retain(source.id);
  try{
   const {info,key}=await originalIdentity(source,signal);
   // The web workflow attaches a real MP4, not another container renamed to
   // .mp4. Reuse the bounded, full-duration local review path for other formats;
   // the managed source and final export remain untouched.
   if(info.size<=WEB_AI_VIDEO_LIMIT&&path.extname(source.mediaPath).toLowerCase()==='.mp4')return descriptor(source,source.mediaPath,info.size,{key});
   return await shared(key,async active=>{
    const releaseWork=retain(source.id);
    try{
      const stable=await originalIdentity(source,active);if(stable.key!==key)throw error('WEB_VIDEO_SOURCE_CHANGED','Nguồn đã đổi trước khi chuẩn bị video nhẹ.');
      return await prepare(source,key,info,AbortSignal.any([active,AbortSignal.timeout(20*60_000)]));
    }finally{releaseWork();}
   },signal);
  }finally{release();}
 }
 return{ensure,isBusy:sourceId=>(busy.get(sourceId)||0)>0,async using(source,signal,work){const release=retain(source.id);try{return await work(await ensure(source,signal));}finally{release();}}};
}
