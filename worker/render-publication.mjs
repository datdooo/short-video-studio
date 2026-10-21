import {mkdtemp,mkdir,readFile,readdir,lstat,stat,writeFile,rename,rm,link,open} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const marker='.render-owner.json',prefix='.render-work-v1-';
const owned=(value,owner)=>value?.version===1&&value.sourceId===owner.sourceId&&value.jobId===owner.jobId;
// Only positively identified scratch belonging to this exact job is disposable.
export async function renderScratch(directory,owner){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(!entry.isDirectory()||!entry.name.startsWith(prefix))continue;
  const root=path.join(directory,entry.name);
  try{const info=await lstat(path.join(root,marker));if(!info.isFile()||info.isSymbolicLink())continue;
   if(owned(JSON.parse(await readFile(path.join(root,marker),'utf8')),owner))await rm(root,{recursive:true,force:true});
  }catch{/* Ambiguous scratch stays untouched. */}
 }
 const root=await mkdtemp(path.join(directory,prefix));
 await writeFile(path.join(root,marker),JSON.stringify({version:1,...owner}),{mode:0o600,flag:'wx'});
 return{root,dispose:()=>rm(root,{recursive:true,force:true})};
}
function journalPath(directory){return path.join(directory,'.publication-v1.json');}
export async function recoverPublication({directory,filename,sourceId,jobId,partId,metadataPolicy}){
 try{
  const record=JSON.parse(await readFile(journalPath(directory),'utf8'));
  if(!owned(record,{sourceId,jobId})||record.part!==partId||record.filename!==filename||record.metadataPolicy!==metadataPolicy)return null;
  const info=await lstat(path.join(directory,filename));
  if(!info.isFile()||info.isSymbolicLink()||info.dev!==record.device||info.ino!==record.inode||info.size!==record.size||info.mtimeMs!==record.mtimeMs)return null;
  return{part:partId,filename,size:record.size,metadataPolicy};
 }catch{return null;}
}
export async function publishRender({staging,directory,filename,sourceId,jobId,partId,metadataPolicy,signal}){
 if(path.basename(filename)!==filename||!filename.endsWith('.mp4'))throw Error('Invalid output filename.');
 signal?.throwIfAborted();await mkdir(directory,{recursive:true});
 const file=await open(staging,'r');try{await file.sync();}finally{await file.close();}
 const info=await stat(staging);
 const record={version:1,sourceId,jobId,part:partId,filename,size:info.size,metadataPolicy,device:info.dev,inode:info.ino,mtimeMs:info.mtimeMs};
 const temporary=path.join(directory,`.publication-${randomUUID()}.tmp`);
 try{
  const handle=await open(temporary,'wx',0o600);try{await handle.writeFile(JSON.stringify(record));await handle.sync();}finally{await handle.close();}
  await rename(temporary,journalPath(directory));signal?.throwIfAborted();
  // A hard-link publishes atomically with NO overwrite (rename can overwrite).
  // The journal's inode proves ownership if history persistence is interrupted.
  await link(staging,path.join(directory,filename));
 }finally{await rm(temporary,{force:true});}
 return record;
}
