import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,mkdtemp,readFile,writeFile,lstat,stat,link,rm} from 'node:fs/promises';
import path from 'node:path';
import {createSharedOperations} from './shared-operation.mjs';
import {requireDiskSpace} from './analysis-cache.mjs';

export const WEB_AI_VIDEO_LIMIT=512*1024*1024;
export const WEB_AI_VIDEO_VERSION='full-source-mp4-review-1080-source-quality-v4';
export const WEB_AI_VIDEO_POLICY=Object.freeze({videoCodec:'h264',crf:23,preset:'veryfast',threads:2,dimensions:'source-even',frameRate:'source-passthrough',audioCodec:'aac',audioBitrate:96000});
const error=(code,message)=>Object.assign(Error(message),{code});
const finite=value=>typeof value==='number'&&Number.isFinite(value);

// Only a delivery derivative. Never publish into sources, change mediaPath or
// reuse this lower-quality input in the editor, ASR, preview or final export.
export function createWebAiVideo({root,ffmpeg,run,probeMedia,fingerprint,isLocked=()=>false}){
 const shared=createSharedOperations(),identities=createSharedOperations(),busy=new Map();
 const progressListeners=new Map(),progressSnapshots=new Map(),progressUsers=new Map();
 function progress(sourceId,phase,detail={}){
  const previous=progressSnapshots.get(sourceId),now=Date.now();
  const value={phase,percent:null,...detail,updatedAt:now};
  const notify=!previous||previous.value.phase!==phase||previous.value.attempt!==value.attempt||now-previous.publishedAt>=250||['ready','error','cancelled'].includes(phase);
  progressSnapshots.set(sourceId,{value,publishedAt:notify?now:previous.publishedAt});
  if(notify)for(const listener of progressListeners.get(sourceId)||[]){try{listener({...value});}catch{/* Progress observers do not own preparation. */}}
  // Only tiny operational snapshots are retained, never source paths/content.
  while(progressSnapshots.size>128){const oldest=[...progressSnapshots.keys()].find(id=>!progressUsers.has(id));if(!oldest)break;progressSnapshots.delete(oldest);}
 }
 function subscribeProgress(sourceId,listener){
  const listeners=progressListeners.get(sourceId)||new Set();listeners.add(listener);progressListeners.set(sourceId,listeners);
  const current=progressSnapshots.get(sourceId)?.value;
  if(current&&progressUsers.has(sourceId)){try{listener({...current});}catch{/* Optional observer. */}}
  return()=>{listeners.delete(listener);if(!listeners.size)progressListeners.delete(sourceId);};
 }
 async function convert(source,args,signal,attempt=1,maxAttempts=1){
  progress(source.id,'converting',{percent:0,completedSeconds:0,totalSeconds:source.duration,attempt,maxAttempts});
  let pending='',completedSeconds=0;
  return run(ffmpeg,['-progress','pipe:1','-nostats',...args],{signal,maxStdout:65536,onQueued(){progress(source.id,'waiting');},onStart(){progress(source.id,'converting',{percent:0,completedSeconds:0,totalSeconds:source.duration,attempt,maxAttempts});},onStdout(chunk){
   if(signal.aborted)return;
   pending+=chunk;const lines=pending.split(/\r?\n/);pending=(lines.pop()||'').slice(-1024);
   for(const line of lines){
    if(!line.startsWith('out_time_us='))continue;
    const seconds=Number(line.slice(12))/1_000_000;
    if(!finite(seconds)||seconds<0||!finite(source.duration)||source.duration<=0)continue;
    completedSeconds=Math.max(completedSeconds,Math.min(source.duration,seconds));
    progress(source.id,'converting',{percent:Math.min(99,completedSeconds/source.duration*100),completedSeconds,totalSeconds:source.duration,attempt,maxAttempts});
   }
  }});
 }
 function retain(sourceId){if(isLocked(sourceId))throw error('SOURCE_BUSY','Nguồn đang ở Thùng rác hoặc đang di chuyển.');busy.set(sourceId,(busy.get(sourceId)||0)+1);return()=>{const n=busy.get(sourceId)||0;if(n<=1)busy.delete(sourceId);else busy.set(sourceId,n-1);};}
 function spanCheck(original,review){
  // Two encodes can add AAC priming/container rounding. These small tolerances
  // validate alignment; they never trim, change endpoints or repair timestamps.
  const epsilon=.25;
  if(!finite(review.duration)||Math.abs(review.duration-original.duration)>epsilon||Boolean(review.hasAudio)!==Boolean(original.hasAudio))throw error('WEB_VIDEO_TIMELINE','Bản video nhẹ không giữ đủ thời lượng hoặc âm thanh nguồn.');
  for(const key of ['videoStart','audioStart','audioEnd'])if(finite(original[key])&&(!finite(review[key])||Math.abs(review[key]-original[key])>epsilon))throw error('WEB_VIDEO_TIMELINE','Mốc âm thanh/hình ảnh của bản nhẹ lệch nguồn; chưa gửi.');
  if(finite(original.videoDuration)&&(!finite(review.videoDuration)||Math.abs(review.videoDuration-original.videoDuration)>epsilon))throw error('WEB_VIDEO_TIMELINE','Video nhẹ chưa chứng minh đủ khoảng hình ảnh nguồn.');
  const width=Math.max(2,Math.floor(original.width/2)*2),height=Math.max(2,Math.floor(original.height/2)*2);
  if(!review.width||!review.height||review.width!==width||review.height!==height)throw error('WEB_VIDEO_GEOMETRY','Bản video nén không giữ kích thước nguồn; chỉ cho phép làm chẵn tối đa một pixel.');
 }
 async function originalIdentity(source,signal){
  const info=await stat(source.mediaPath);signal?.throwIfAborted();
  if(!info.isFile())throw error('WEB_VIDEO_SOURCE','Không đọc được video nguồn.');
  const statKey=JSON.stringify([source.id,info.size,info.mtimeMs,info.dev,info.ino]);
  const sourceHash=fingerprint?await identities(statKey,async active=>{const releaseHash=retain(source.id);try{return await fingerprint(source,active);}finally{releaseHash();}},signal):undefined;signal?.throwIfAborted();
  const signature={sourceHash,version:WEB_AI_VIDEO_VERSION,qualityPolicy:WEB_AI_VIDEO_POLICY,sourceId:source.id,kind:source.kind,bytes:info.size,mtimeMs:info.mtimeMs,dev:info.dev,ino:info.ino,duration:source.duration,sourceStart:source.sourceStart,videoStart:source.videoStart,videoDuration:source.videoDuration,audioStart:source.audioStart,audioEnd:source.audioEnd,hasAudio:source.hasAudio,width:source.width,height:source.height,maxBytes:WEB_AI_VIDEO_LIMIT};
  const key=createHash('sha256').update(JSON.stringify(signature)).digest('hex');
  return{info,key,signature};
 }
 function descriptor(source,file,bytes,{method='original',width=source.width,height=source.height,key,deliveryHash,originalBytes=bytes}={}){
  return{file,manifest:{id:`source-video-${source.id}`,sourceId:source.id,filename:`source-${source.id}.mp4`,bytes,duration:source.duration,clock:'source-seconds',playbackRate:1,coverage:[0,source.duration],width,height,representation:method==='original-smaller'?'original':'quality-compressed',preparation:method,qualityPolicy:WEB_AI_VIDEO_POLICY,originalBytes,variantKey:deliveryHash?createHash('sha256').update(JSON.stringify([key,deliveryHash])).digest('hex'):key,delivery:'website-file-input',providerReceipt:'not-verified',limitation:method==='original-smaller'?'Sau khi so sánh, MP4 nguồn nhỏ hơn hoặc bằng bản nén; dùng nguồn, không nhận là đã nén nhẹ hơn.':'Nén lossy giữ kích thước nguồn và đầy đủ timeline; chưa có bằng chứng model đọc mọi chi tiết chính xác hơn hoặc Thinking nhanh hơn.'}};
 }
 // TXT and JSON import need a stable source binding, not a completed delivery
 // encode. Do not hash/download/transcode here or inspect derivative cache: the
 // same prompt must remain valid before and after the separate video download.
 async function describe(source,signal){
  const release=retain(source.id);
  try{
   signal?.throwIfAborted();const info=await stat(source.mediaPath);signal?.throwIfAborted();
   if(!info.isFile())throw error('WEB_VIDEO_SOURCE','Không đọc được video nguồn.');
   const sourceKey=createHash('sha256').update(JSON.stringify({version:'web-video-source-binding-v1',sourceId:source.id,bytes:info.size,mtimeMs:info.mtimeMs,dev:info.dev,ino:info.ino,duration:source.duration,sourceStart:source.sourceStart,videoStart:source.videoStart,videoDuration:source.videoDuration,audioStart:source.audioStart,audioEnd:source.audioEnd,hasAudio:source.hasAudio,width:source.width,height:source.height})).digest('hex');
   return{id:`source-video-${source.id}`,sourceId:source.id,sourceKey,filename:`source-${source.id}.mp4`,bytes:null,originalBytes:info.size,duration:source.duration,clock:'source-seconds',playbackRate:1,coverage:[0,source.duration],width:source.width,height:source.height,representation:'delivery-copy-pending',preparation:'on-video-download',qualityPolicy:WEB_AI_VIDEO_POLICY,maxBytes:WEB_AI_VIDEO_LIMIT,delivery:'manual-download',providerReceipt:'not-verified',limitation:'Bản nén từ nguồn local được chuẩn bị khi bấm Tải video; giữ kích thước nguồn (chỉ làm chẵn tối đa một pixel), fps và toàn bộ timeline. Kích thước cuối chưa xác định trong TXT. Nếu nguồn MP4 đã nhỏ hơn bản nén thì dùng nguồn. Chưa kiểm chứng độ chính xác hoặc tốc độ của model; manifest không chứng minh website đã nhận/xem video.'};
  }finally{release();}
 }
 async function cached(source,key,originalBytes){
  try{
   const metaPath=path.join(root,key+'.json'),metaInfo=await lstat(metaPath);
   if(!metaInfo.isFile()||metaInfo.isSymbolicLink()||metaInfo.size>65536)return null;
   const meta=JSON.parse(await readFile(metaPath,'utf8'));
   if(!meta||typeof meta!=='object'||Array.isArray(meta)||meta.version!==WEB_AI_VIDEO_VERSION||meta.key!==key||meta.sourceId!==source.id||meta.originalBytes!==originalBytes||JSON.stringify(meta.qualityPolicy)!==JSON.stringify(WEB_AI_VIDEO_POLICY))return null;
   if(meta.method==='original-smaller'){
    if(path.extname(source.mediaPath).toLowerCase()!=='.mp4'||originalBytes>WEB_AI_VIDEO_LIMIT||!finite(meta.encodedBytes)||meta.encodedBytes<originalBytes)return null;
    return descriptor(source,source.mediaPath,originalBytes,{method:meta.method,key,originalBytes});
   }
   const file=path.join(root,key+'.mp4'),info=await lstat(file);
   if(!meta.probe||typeof meta.probe!=='object'||meta.method!=='local-quality-compressed'||typeof meta.deliveryHash!=='string'||!/^[a-f0-9]{64}$/.test(meta.deliveryHash)||!info.isFile()||info.isSymbolicLink()||info.size!==meta.bytes||info.mtimeMs!==meta.mtimeMs||info.size>WEB_AI_VIDEO_LIMIT||info.size<1000)return null;
   spanCheck(source,meta.probe);
   return descriptor(source,file,info.size,{method:meta.method,width:meta.probe.width,height:meta.probe.height,key,deliveryHash:meta.deliveryHash,originalBytes});
  }catch(e){if(['ENOENT','ENOTDIR'].includes(e.code)||e instanceof SyntaxError||e.code?.startsWith('WEB_VIDEO_'))return null;throw e;}
 }
 async function prepare(source,key,info,signal){
  progress(source.id,'cache');
  await mkdir(root,{recursive:true,mode:0o700});const rootInfo=await lstat(root);if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())throw error('WEB_VIDEO_CACHE','Cache video web không an toàn.');
  const previous=await cached(source,key,info.size);if(previous)return previous;
  if(!ffmpeg)throw error('WEB_VIDEO_ENCODER','Thiếu FFmpeg để chuẩn bị video nén.');
  if(!finite(source.duration)||source.duration<=0)throw error('WEB_VIDEO_SOURCE','Không xác định được thời lượng video nguồn.');
  if(!finite(source.width)||!finite(source.height)||source.width<2||source.height<2)throw error('WEB_VIDEO_GEOMETRY','Không xác định được kích thước nguồn để tạo bản nén.');
  await requireDiskSpace(root,WEB_AI_VIDEO_LIMIT*3);
  const directory=await mkdtemp(path.join(root,'prepare-')),operationId=randomUUID(),output=path.join(directory,'review.mp4');
  try{
   await writeFile(path.join(directory,'owner.json'),JSON.stringify({version:WEB_AI_VIDEO_VERSION,operationId,key,sourceId:source.id}),{flag:'wx',mode:0o600});
   // One local quality encode. Never redownload a YouTube rendition, lower the
   // resolution/frame rate, force a small byte target or silently retry at a
   // poorer quality. The managed source is used only as a read-only input.
   const width=Math.max(2,Math.floor(source.width/2)*2),height=Math.max(2,Math.floor(source.height/2)*2);
   await convert(source,['-hide_banner','-loglevel','error','-y','-copyts','-start_at_zero','-i',source.mediaPath,'-map','0:v:0',...(source.hasAudio?['-map','0:a:0']:['-an']),'-vf',`scale=${width}:${height}:flags=bicubic,setsar=1`,'-c:v','libx264','-threads',String(WEB_AI_VIDEO_POLICY.threads),'-preset',WEB_AI_VIDEO_POLICY.preset,'-crf',String(WEB_AI_VIDEO_POLICY.crf),'-pix_fmt','yuv420p','-fps_mode:v','passthrough','-enc_time_base:v','filter',...(source.hasAudio?['-c:a','aac','-b:a','96k']:[]),'-map_metadata','-1','-map_chapters','-1','-movflags','+faststart',output],signal);
   progress(source.id,'validating');
   const probe=await probeMedia(output,signal);spanCheck(source,probe);
   signal.throwIfAborted();
   const unchanged=await originalIdentity(source,signal);if(unchanged.key!==key)throw error('WEB_VIDEO_SOURCE_CHANGED','Nguồn đã đổi trong lúc nén video. Chưa gửi.');
   const finalFile=path.join(root,key+'.mp4'),finalMeta=path.join(root,key+'.json'),outInfo=await lstat(output),temporaryMeta=path.join(directory,'manifest.json');
   if(outInfo.size<1000)throw error('WEB_VIDEO_SOURCE','Bản video nén không có dữ liệu hợp lệ.');
   if(outInfo.size>=info.size&&info.size<=WEB_AI_VIDEO_LIMIT&&path.extname(source.mediaPath).toLowerCase()==='.mp4'){
    // Remember the quality comparison without copying an already smaller source
    // into the derivative cache or calling it a successful size reduction.
    await writeFile(temporaryMeta,JSON.stringify({version:WEB_AI_VIDEO_VERSION,qualityPolicy:WEB_AI_VIDEO_POLICY,key,sourceId:source.id,method:'original-smaller',originalBytes:info.size,encodedBytes:outInfo.size}),{flag:'wx',mode:0o600});
    signal.throwIfAborted();
    try{await link(temporaryMeta,finalMeta);}catch(e){if(e.code==='EEXIST'){const winner=await cached(source,key,info.size);if(winner)return winner;throw error('WEB_VIDEO_CACHE_CONFLICT','Cache video nén chưa xác minh được; giữ nguyên dữ liệu.');}throw e;}
    return descriptor(source,source.mediaPath,info.size,{method:'original-smaller',key,originalBytes:info.size});
   }
   if(outInfo.size>WEB_AI_VIDEO_LIMIT)throw error('WEB_VIDEO_TOO_LARGE','Bản nén giữ kích thước nguồn vẫn vượt 512 MiB. Chưa tải; không tự giảm độ phân giải, chất lượng hoặc cắt video.');
   // No overwrite of an unknown/corrupt cached artifact. Cleanup on publication
   // failure removes only our proven inode; original source is never touched.
   const hash=createHash('sha256');for await(const chunk of createReadStream(output)){signal.throwIfAborted();hash.update(chunk);}const deliveryHash=hash.digest('hex');
   await writeFile(temporaryMeta,JSON.stringify({version:WEB_AI_VIDEO_VERSION,qualityPolicy:WEB_AI_VIDEO_POLICY,key,sourceId:source.id,method:'local-quality-compressed',originalBytes:info.size,bytes:outInfo.size,mtimeMs:outInfo.mtimeMs,probe,deliveryHash}),{flag:'wx',mode:0o600});
   signal.throwIfAborted();
   try{await link(output,finalFile);}catch(e){if(e.code==='EEXIST'){const winner=await cached(source,key,info.size);if(winner)return winner;throw error('WEB_VIDEO_CACHE_CONFLICT','Bản video nén trong cache chưa xác minh được; giữ nguyên dữ liệu.');}throw e;}
   try{await link(temporaryMeta,finalMeta);}catch(e){try{const current=await lstat(finalFile);if(outInfo.ino!==0&&current.dev===outInfo.dev&&current.ino===outInfo.ino)await rm(finalFile);}catch{/* Preserve ambiguity. */}throw e;}
   return descriptor(source,finalFile,outInfo.size,{method:'local-quality-compressed',width:probe.width,height:probe.height,key,deliveryHash,originalBytes:info.size});
  }finally{
   // directory is created by this operation only; never scan/remove old cache,
   // source files, exports, backups or another operation's temporary directory.
   await rm(directory,{recursive:true,force:true});
  }
 }
 async function ensure(source,signal){
  const release=retain(source.id);
  const users=progressUsers.get(source.id)||0;progressUsers.set(source.id,users+1);
  if(!users)progress(source.id,'identity');
  try{
   const {info,key}=await originalIdentity(source,signal);
   // Even a source below512MiB gets one quality comparison before delivery;
   // cached compressed output or an original-smaller marker avoids repeat work.
   const prepared=await shared(key,async active=>{
    const releaseWork=retain(source.id);
    try{
      const stable=await originalIdentity(source,active);if(stable.key!==key)throw error('WEB_VIDEO_SOURCE_CHANGED','Nguồn đã đổi trước khi chuẩn bị video nhẹ.');
      return await prepare(source,key,info,AbortSignal.any([active,AbortSignal.timeout(20*60_000)]));
    }finally{releaseWork();}
   },signal);
   progress(source.id,'ready',{percent:100});return prepared;
  }catch(caught){
   // One cancelled subscriber must not report a shared preparation as stopped
   // while another subscriber still owns it. The last rejection is terminal.
   if(progressUsers.get(source.id)===1)progress(source.id,signal?.aborted?'cancelled':'error');
   throw caught;
  }finally{const n=progressUsers.get(source.id)||0;if(n<=1)progressUsers.delete(source.id);else progressUsers.set(source.id,n-1);release();}
 }
 return{describe,ensure,subscribeProgress,isBusy:sourceId=>(busy.get(sourceId)||0)>0,async using(source,signal,work){const release=retain(source.id);try{return await work(await ensure(source,signal));}finally{release();}}};
}
