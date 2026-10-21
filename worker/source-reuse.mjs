import {randomUUID} from 'node:crypto';
import {readdir,readFile,writeFile,rename,rm,statfs} from 'node:fs/promises';
import path from 'node:path';
import {youtubeUrl} from './youtube-common.mjs';
import {createSharedOperations} from './shared-operation.mjs';
import {requireDiskSpace} from './analysis-cache.mjs';
export function createSourceReuse({sourcesRoot,load,download,metadata,isLocked=()=>false}) {
  const shared=createSharedOperations(),index=new Map(),indexFile=path.join(path.dirname(sourcesRoot),'youtube-source-index.json');let scanned,truncated=false,indexWrites=Promise.resolve();
  async function saveIndex(){const snapshot=JSON.stringify([...index]);const write=indexWrites.then(async()=>{
    const temporary=indexFile+'.'+randomUUID()+'.tmp';
    try{await writeFile(temporary,snapshot,{mode:0o600,flag:'wx'});await rename(temporary,indexFile);}finally{await rm(temporary,{force:true});}
  });indexWrites=write.catch(()=>{});return indexWrites;}

  async function scan(){if(scanned)return scanned;scanned=(async()=>{
    try{const saved=JSON.parse(await readFile(indexFile,'utf8'));if(Array.isArray(saved))for(const entry of saved.slice(0,10000)){if(Array.isArray(entry)&&/^[A-Za-z0-9_-]{11}$/.test(entry[0])&&/^[a-f0-9-]{16,64}$/i.test(entry[1]?.sourceId))index.set(entry[0],entry[1]);}}catch{/* Build from local source records. */}
    let names;try{names=await readdir(sourcesRoot,{withFileTypes:true});}catch{return;}
    const directories=names.filter(e=>e.isDirectory()&&/^[a-f0-9-]{16,64}$/i.test(e.name));truncated=directories.length>2000;
    for(const entry of directories.slice(0,2000)){
      try{const s=JSON.parse(await readFile(path.join(sourcesRoot,entry.name,'source.json'),'utf8'));if(s.kind!=='youtube')continue;const id=youtubeUrl(s.sourceUrl).id;
        if(!index.has(id)||String(s.createdAt)>index.get(id).at)index.set(id,{sourceId:entry.name,at:String(s.createdAt)});
      }catch{/* Incomplete/unrelated source records are not reusable media. */}
    }
    await saveIndex();
  })();return scanned;}
  return{async get(url,signal){const parsed=youtubeUrl(url);signal?.throwIfAborted();await scan();
    const result=await shared(parsed.id,async active=>{
      const prior=index.get(parsed.id);
      if(prior){if(isLocked(prior.sourceId))throw new Error('Source is busy/in trash; do not download a duplicate.');
        try{const loaded=await load(prior.sourceId,active);if(loaded.kind!=='youtube'||youtubeUrl(loaded.sourceUrl).id!==parsed.id)throw new Error('Cached source identity mismatch; inspect source metadata.');return loaded;}catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))throw error;index.delete(parsed.id);}}
      if(index.size>=10000)throw new Error('Source index capacity reached; select existing sources instead of downloading duplicates.');
      if(truncated)throw new Error('Source library exceeds bounded legacy indexing; select the existing source rather than downloading a possible duplicate.');
      const context=await metadata(parsed.url,active);
      const estimate=Number.isFinite(context?.metadata.estimatedDownloadBytes)?context.metadata.estimatedDownloadBytes:
        Number.isFinite(context?.metadata.durationSeconds)?Math.ceil(context.metadata.durationSeconds*2000000):1024*1024*1024;
      await requireDiskSpace(path.dirname(sourcesRoot),Math.ceil(estimate*1.15)+512*1024*1024);
      // Guard unknown remote sizes during streaming; yt-dlp scratch cleanup owns partials.
      const space=new AbortController();let checking=false;
      const timer=setInterval(async()=>{if(checking)return;checking=true;try{const s=await statfs(path.dirname(sourcesRoot));if(s.bavail*s.bsize<512*1024*1024)space.abort(new Error('Low storage: preserve 512 MiB free; download cancelled.'));}catch{space.abort(new Error('Storage availability check failed'));}finally{checking=false;}},2000);timer.unref();
      try{const source=await download(parsed.url,AbortSignal.any([active,space.signal]));index.set(parsed.id,{sourceId:source.id,at:source.createdAt||''});await saveIndex();return await load(source.id,active);}
      finally{clearInterval(timer);}
    },signal);
    return structuredClone(result);
  }};
}
