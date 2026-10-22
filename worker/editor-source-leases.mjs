// Presence only, not the heavy FFmpeg/ASR resource lane. No disk lock survives a
// worker restart; an abandoned renderer expires, including after a crash.
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function createEditorSourceLeases({now=()=>performance.now(),ttlMs=120_000,maxOwners=128}={}){
 const owners=new Map();
 const prune=()=>{for(const [id,value]of owners)if(value.expiresAt<=now())owners.delete(id);};
 return{
  retain(value,isLocked=()=>false){
   if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['ownerId','sourceId','revision'].includes(key)))throw Object.assign(Error('Tham chiếu Editor không hợp lệ.'),{status:400});
   const {ownerId,sourceId,revision}=value;
   if(!uuid.test(ownerId)||sourceId!==null&&!uuid.test(sourceId)||!Number.isSafeInteger(revision)||revision<1)throw Object.assign(Error('Tham chiếu Editor không hợp lệ.'),{status:400});
   prune();const prior=owners.get(ownerId);
   // A late renewal/release must not replace a newer source in this renderer.
   if(prior&&revision<=prior.revision)return{ttlMs,accepted:false};
   if(sourceId&&isLocked(sourceId))throw Object.assign(Error('Nguồn đang được xử lý trong Thùng rác. Thử lại sau.'),{status:409});
   if(!prior&&owners.size>=maxOwners)throw Object.assign(Error('Quá nhiều phiên Editor; đóng phiên không dùng rồi thử lại.'),{status:429});
   // A release tombstone rejects older in-flight renewals until their TTL ends.
   owners.set(ownerId,{sourceId,revision,expiresAt:now()+ttlMs});
   return{ttlMs,accepted:true};
  },
  has(sourceId){prune();return [...owners.values()].some(owner=>owner.sourceId===sourceId);},
 };
}
