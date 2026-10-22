import {mkdir,open,rename,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
// Preserve the existing serial atomic-write boundary. Only ordinary pending
// snapshots coalesce; strict checkpoints remain ordered barriers.
export function createHistoryPersistence(file,{delayMs=150}={}){
 const queue=[];let active=null,timer=null,lastWritten=null;
 function start(){
  if(timer){clearTimeout(timer);timer=null;}if(active)return;
  const entry=queue.shift();if(!entry)return;
  active=entry;
  void(async()=>{
   const temporary=`${file}.${randomUUID()}.tmp`;let owned=false;
   try{
    if(entry.snapshot!==lastWritten){
     await mkdir(path.dirname(file),{recursive:true});
     try{
      const handle=await open(temporary,'wx',0o600);owned=true;
      try{await handle.writeFile(entry.snapshot);}finally{await handle.close();}
      await rename(temporary,file);
     }catch(error){if(owned)await rm(temporary,{force:true}).catch(()=>{});throw error;}
     lastWritten=entry.snapshot;
    }
    entry.resolve();
   }catch(error){entry.reject(error);}
   finally{active=null;start();}
  })();
 }
 return{
  save(snapshot,{strict=false}={}){
   const tail=queue.at(-1)||active;
   if(tail?.snapshot===snapshot){if(strict){tail.strict=true;start();}return tail.promise;}
   if(!tail&&snapshot===lastWritten)return Promise.resolve();
   let entry=queue.at(-1);
   if(!strict&&entry&&!entry.strict)entry.snapshot=snapshot;
   else{
    entry={snapshot,strict};entry.promise=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject;});queue.push(entry);
   }
   if(strict)start();else if(!active&&!timer)timer=setTimeout(()=>{timer=null;start();},delayMs);
   return entry.promise;
  },
 };
}
