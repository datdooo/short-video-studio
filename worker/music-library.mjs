import{MUSIC_CATALOG}from'../lib/music/catalog.mjs';
import{createHash,randomUUID}from'node:crypto';import{createReadStream,createWriteStream}from'node:fs';import{mkdir,readFile,writeFile,lstat,realpath,readdir,rename,rm,statfs,link}from'node:fs/promises';import{pipeline}from'node:stream/promises';import{Transform}from'node:stream';import path from'node:path';import{seamlessMusicFilter}from'./music-audio.mjs';
export const MAX_MUSIC_BYTES=64*1024*1024,MAX_MUSIC_DURATION=600;
export const MAX_MUSIC_TRACKS=128,MAX_LIBRARY_BYTES=1024*1024*1024;
export function createMusicLibrary({root,ffmpeg,ffprobe,run}){
 const verified=new Map();
 // Upload/decode can overlap, but quota checks and publication must observe the
 // latest library together. A failed import must not poison later imports.
 let publications=Promise.resolve();
 function publish(work){const task=publications.then(work);publications=task.catch(()=>{});return task;}
 function publicationError(error){return error?.code==='EEXIST'?Object.assign(Error('Bài nhạc cùng mã đã tồn tại nhưng chưa đọc được. File cũ được giữ; kiểm tra thư viện trước khi nhập lại.'),{code:'MUSIC_ASSET_CONFLICT',status:409}):error;}
 async function assertCapacity(reserve){
  const entries=await readdir(root);let used=0;
  for(const name of entries.filter(n=>/^[a-f0-9]{64}\.(flac|mp3|m4a|aac|ogg|opus)$/.test(n)))used+=(await lstat(path.join(root,name))).size;
  if(entries.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).length>=MAX_MUSIC_TRACKS||used+reserve>MAX_LIBRARY_BYTES)throw Error('Thư viện nhạc tối đa 128 bài / 1 GiB; không tự xoá nhạc đã lưu.');
 }
 const valid=id=>{if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid music asset ID.');return id;};
 async function resolve(id){valid(id);if((await lstat(root)).isSymbolicLink())throw Error('Unsafe music directory.');const base=await realpath(root);const meta=JSON.parse(await readFile(path.join(base,id+'.json'),'utf8'));const extension=meta.extension||'.flac';if(!['.flac','.mp3','.m4a','.aac','.ogg','.opus'].includes(extension))throw Error('Invalid managed music format.');const file=path.join(base,id+extension),s=await lstat(file).catch(()=>null);if(!s?.isFile()||await realpath(file)!==file)throw Error('Không tìm thấy nhạc đã chọn. Import lại file nhạc trước khi xuất.');if(meta.id!==id||meta.contentHash!==id)throw Error('Music identity mismatch.');if(!Number.isFinite(meta.durationLoop)||meta.durationLoop<=0||meta.durationLoop>MAX_MUSIC_DURATION)throw Error('Invalid music duration.');const known=verified.get(id);if(!known||known.mtime!==s.mtimeMs||known.size!==s.size){const h=createHash('sha256');for await(const c of createReadStream(file))h.update(c);if(h.digest('hex')!==meta.normalizedHash)throw Error('File nhạc đã thay đổi/hỏng. Import lại để tạo identity mới.');verified.set(id,{mtime:s.mtimeMs,size:s.size});}return{...meta,file};}
 return{resolve,async list(){await mkdir(root,{recursive:true});const out=[];for(const name of(await readdir(root)).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){try{const{file,...m}=await resolve(name.slice(0,-5));void file;out.push(m);}catch{/* broken assets stay on disk; never delete user files */}}return out;},
 async import(stream,{filename='Local music',catalogId,signal,officialDownload=false}={}){await mkdir(root,{recursive:true});if(!(await lstat(root)).isDirectory()||(await lstat(root)).isSymbolicLink())throw Error('Unsafe music directory');const disk=await statfs(root);if(disk.bavail*disk.bsize<512*1024*1024)throw Error('Cần ít nhất 512 MiB trống để import nhạc.');const extension=path.extname(filename).toLowerCase();if(!['.mp3','.wav','.m4a','.aac','.flac','.ogg','.opus'].includes(extension))throw Error('Chọn MP3/WAV/M4A/AAC/FLAC/OGG/Opus.');const tmp=path.join(root,'.import-'+randomUUID()),retainCompressed=['.mp3','.m4a','.aac','.ogg','.opus'].includes(extension),storedExtension=retainCompressed?extension:'.flac',audio=tmp+storedExtension;let size=0;const hash=createHash('sha256');
 try{await pipeline(stream,new Transform({transform(chunk,_e,cb){size+=chunk.length;if(size>MAX_MUSIC_BYTES)return cb(Error('Nhạc tối đa 64 MiB.'));hash.update(chunk);cb(null,chunk);}}),createWriteStream(tmp,{flags:'wx'}),{signal});
 const id=hash.digest('hex');try{return await resolve(id);}catch{/* new or missing managed asset */}
 const probe=JSON.parse((await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mp3,wav,flac,mov,aac,ogg','-show_format','-show_streams','-of','json',tmp],{signal})).stdout);const duration=Number(probe.format?.duration);if(!Number.isFinite(duration)||duration<.5||duration>MAX_MUSIC_DURATION||!probe.streams?.some(s=>s.codec_type==='audio')||probe.streams.some(s=>s.codec_type==='video'&&s.disposition?.attached_pic!==1))throw Error('Nhạc cần audio 0.5–600 giây, không có video.');
 await assertCapacity(retainCompressed?size:duration*192000); // Fail early before a needless full decode/conversion.
 if(retainCompressed){await run(ffmpeg,['-v','error','-nostdin','-protocol_whitelist','file,pipe','-format_whitelist','mp3,wav,flac,mov,aac,ogg','-i',tmp,'-map','0:a:0','-f','null','-'],{signal});await rename(tmp,audio);}
 else await run(ffmpeg,['-v','error','-nostdin','-y','-protocol_whitelist','file,pipe','-format_whitelist','mp3,wav,flac,mov,aac,ogg','-i',tmp,'-filter_complex',seamlessMusicFilter(duration),'-map','[out]','-c:a','flac',audio],{signal});
 const normalizedHash=createHash('sha256');for await(const c of createReadStream(audio))normalizedHash.update(c);
 const metadata={extension:storedExtension,storedBytes:(await lstat(audio)).size,id,contentHash:id,normalizedHash:normalizedHash.digest('hex'),artist:String(probe.format?.tags?.artist||'Unknown (local import)').replace(/[\x00-\x1f]/g,'').slice(0,160),sourceUrl:null,licenseUrl:null,licenseCheckedDate:null,title:path.basename(filename,extension).replace(/[\x00-\x1f]/g,'').slice(0,160),duration,durationLoop:retainCompressed?duration:duration-Math.min(.05,duration/8),importedAt:new Date().toISOString(),...(catalogId?{catalogId}:{}),...(MUSIC_CATALOG.find(t=>t.id===catalogId)?{...MUSIC_CATALOG.find(t=>t.id===catalogId),id,contentHash:id,duration,catalogAssociation:officialDownload?'official-download-hash-verified':'user-selected-not-independently-matched'}:{}),origin:'local-import',license:MUSIC_CATALOG.find(t=>t.id===catalogId)?.license||(catalogId?'User-associated catalog file; verify match and rights':'User-supplied; verify rights'),auditioned:false,instrumentalVerified:false,verificationStatus:'full-file-decoded; audio audition not performed'};
 return await publish(async()=>{
  signal?.throwIfAborted();
  // Another upload of the same track may have completed during this decode.
  try{return await resolve(id);}catch{/* Missing/broken entries are never overwritten below. */}
  const audioInfo=await lstat(audio);
  await assertCapacity(audioInfo.size);
  const finalAudio=path.join(root,id+storedExtension),finalMetadata=path.join(root,id+'.json');
  await writeFile(tmp+'.json',JSON.stringify(metadata),{flag:'wx',mode:0o600});signal?.throwIfAborted();
  // Publish without replacement. If metadata fails, remove only the audio inode
  // just linked by this operation; preserve existing or independently replaced files.
  try{await link(audio,finalAudio);}catch(error){throw publicationError(error);}
  try{await link(tmp+'.json',finalMetadata);}
  catch(error){try{const current=await lstat(finalAudio);if(audioInfo.ino!==0&&current.dev===audioInfo.dev&&current.ino===audioInfo.ino)await rm(finalAudio);}catch{/* Keep ambiguous files for recovery. */}throw publicationError(error);}
  return{...metadata,file:finalAudio};
 });
 }finally{await Promise.all([tmp,audio,tmp+'.json'].map(p=>rm(p,{force:true})));}}
 };
}
