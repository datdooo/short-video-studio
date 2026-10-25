import {randomUUID} from 'node:crypto';
import {readdir,readFile,writeFile,rename,rm,statfs} from 'node:fs/promises';
import path from 'node:path';
import {youtubeUrl} from './youtube-common.mjs';
import {createSharedOperations} from './shared-operation.mjs';
import {requireDiskSpace} from './analysis-cache.mjs';
export function createSourceReuse({sourcesRoot,load,download,metadata,isLocked=()=>false}) {
  const shared=createSharedOperations(),index=new Map(),available=new Map(),indexFile=path.join(path.dirname(sourcesRoot),'youtube-source-index.json');let scanned,truncated=false,indexWrites=Promise.resolve();
  async function saveIndex(){const snapshot=JSON.stringify([...index]);const write=indexWrites.then(async()=>{
    const temporary=indexFile+'.'+randomUUID()+'.tmp';
    try{await writeFile(temporary,snapshot,{mode:0o600,flag:'wx'});await rename(temporary,indexFile);}finally{await rm(temporary,{force:true});}
  });indexWrites=write.catch(()=>{});return indexWrites;}

  function rememberAvailable(videoId,sourceId,at){
    if(!available.has(videoId))available.set(videoId,new Map());
    available.get(videoId).set(sourceId,{sourceId,at:String(at||'')});
  }
  function forgetAvailable(sourceId){
    for(const [videoId,entries]of available){entries.delete(sourceId);if(!entries.size)available.delete(videoId);}
  }
  async function scan(){if(scanned)return scanned;scanned=(async()=>{
    try{const saved=JSON.parse(await readFile(indexFile,'utf8'));if(Array.isArray(saved))for(const entry of saved.slice(0,10000)){if(Array.isArray(entry)&&/^[A-Za-z0-9_-]{11}$/.test(entry[0])&&/^[a-f0-9-]{16,64}$/i.test(entry[1]?.sourceId))index.set(entry[0],entry[1]);}}catch{/* Build from local source records. */}
    let names;try{names=await readdir(sourcesRoot,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
    const directories=names.filter(e=>e.isDirectory()&&/^[a-f0-9-]{16,64}$/i.test(e.name));truncated=directories.length>2000;
    for(const entry of directories.slice(0,2000)){
      try{const s=JSON.parse(await readFile(path.join(sourcesRoot,entry.name,'source.json'),'utf8'));if(s.kind!=='youtube')continue;
        const files=await readdir(path.join(sourcesRoot,entry.name),{withFileTypes:true});
        if(!files.some(file=>file.isFile()&&/^source\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(file.name)))continue;
        const id=youtubeUrl(s.sourceUrl).id;
        rememberAvailable(id,entry.name,s.createdAt);
        if(!index.has(id)||String(s.createdAt)>index.get(id).at)index.set(id,{sourceId:entry.name,at:String(s.createdAt)});
      }catch{/* Incomplete/unrelated source records are not reusable media. */}
    }
    await saveIndex();
  })();return scanned;}
  return{
    async forget(sourceId){
      await scan();forgetAvailable(sourceId);let changed=false;
      // Remove only references to this exact source, not a newer copy of the URL.
      for(const [videoId,value]of index)if(value.sourceId===sourceId){index.delete(videoId);changed=true;}
      if(changed)await saveIndex();
    },
    async restored(sourceId){
      await scan();
      if(!/^[a-f0-9-]{16,64}$/i.test(sourceId))return;
      // Restore has already moved this exact file back. Refresh only the cache;
      // never restore media, access the network, or replace a newer URL entry.
      let source;
      try{
        source=JSON.parse(await readFile(path.join(sourcesRoot,sourceId,'source.json'),'utf8'));
        const files=await readdir(path.join(sourcesRoot,sourceId),{withFileTypes:true});
        if(source.kind!=='youtube'||!files.some(file=>file.isFile()&&/^source\.(mp4|mov|mkv|webm|m4v|avi)$/i.test(file.name)))return;
        const videoId=youtubeUrl(source.sourceUrl).id,prior=index.get(videoId),at=String(source.createdAt||'');
        rememberAvailable(videoId,sourceId,at);
        if(!prior||prior.sourceId===sourceId||at>prior.at){index.set(videoId,{sourceId,at});await saveIndex();}
      }catch{/* Restored media remains usable even if optional cache metadata is absent. */}
    },
    async get(url,signal){const parsed=youtubeUrl(url);signal?.throwIfAborted();await scan();
    const result=await shared(parsed.id,async active=>{
      const prior=index.get(parsed.id),seen=new Set();
      // The preferred index can point to a removed copy while an older valid
      // source of this same YouTube identity is still in the active library.
      const candidates=[...(prior?[prior]:[]),...[...(available.get(parsed.id)?.values()||[])].sort((a,b)=>b.at.localeCompare(a.at))];
      for(const candidate of candidates){
        if(seen.has(candidate.sourceId))continue;seen.add(candidate.sourceId);active.throwIfAborted();
        if(isLocked(candidate.sourceId))throw new Error('Source is busy/in trash; do not download a duplicate.');
        try{
          const loaded=await load(candidate.sourceId,active);
          if(loaded.id!==candidate.sourceId||loaded.kind!=='youtube'||youtubeUrl(loaded.sourceUrl).id!==parsed.id)throw new Error('Cached source identity mismatch; inspect source metadata.');
          const record={sourceId:candidate.sourceId,at:String(loaded.createdAt||candidate.at||'')};
          rememberAvailable(parsed.id,record.sourceId,record.at);
          if(index.get(parsed.id)?.sourceId!==record.sourceId){index.set(parsed.id,record);await saveIndex();}
          return loaded;
        }catch(error){
          active.throwIfAborted();
          if(!['ENOENT','ENOTDIR','SOURCE_MEDIA_MISSING'].includes(error.code))throw error;
          forgetAvailable(candidate.sourceId);
          if(index.get(parsed.id)?.sourceId===candidate.sourceId){index.delete(parsed.id);await saveIndex();}
        }
      }
      if(index.size>=10000)throw new Error('Source index capacity reached; select existing sources instead of downloading duplicates.');
      if(truncated)throw new Error('Source library exceeds bounded legacy indexing; select the existing source rather than downloading a possible duplicate.');
      const context=await metadata(parsed.url,active);
      const estimate=Number.isFinite(context?.metadata.estimatedDownloadBytes)?context.metadata.estimatedDownloadBytes:
        Number.isFinite(context?.metadata.durationSeconds)?Math.ceil(context.metadata.durationSeconds*2000000):1024*1024*1024;
      await requireDiskSpace(path.dirname(sourcesRoot),Math.ceil(estimate*1.15)+512*1024*1024);
      // Guard unknown remote sizes during streaming; yt-dlp scratch cleanup owns partials.
      const space=new AbortController();let checking=false;
      const timer=setInterval(async()=>{if(checking)return;checking=true;try{const s=await statfs(path.dirname(sourcesRoot));if(s.bavail*s.bsize<512*1024*1024)space.abort(new Error('Low storage: preserve 512 MiB free; download cancelled.'));}catch{space.abort(new Error('Storage availability check failed'));}finally{checking=false;}},2000);timer.unref();
      try{const source=await download(parsed.url,AbortSignal.any([active,space.signal]));rememberAvailable(parsed.id,source.id,source.createdAt);index.set(parsed.id,{sourceId:source.id,at:source.createdAt||''});await saveIndex();return await load(source.id,active);}
      finally{clearInterval(timer);}
    },signal);
    return structuredClone(result);
  }};
}
