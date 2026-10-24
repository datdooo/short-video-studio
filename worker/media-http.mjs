// Single byte range only. Keep source/output timestamps unrelated to HTTP byte
// offsets; reject unsafe integers and support suffix requests used by players.
export function mediaByteRange(header,size){
 if(typeof header!=='string'||!Number.isSafeInteger(size)||size<=0)return null;
 const match=/^bytes=(\d*)-(\d*)$/i.exec(header.trim());
 if(!match||(!match[1]&&!match[2]))return null;
 const first=match[1]?Number(match[1]):null,last=match[2]?Number(match[2]):null;
 if((first!==null&&!Number.isSafeInteger(first))||(last!==null&&!Number.isSafeInteger(last)))return null;
 if(first===null){if(last<=0)return null;return{start:Math.max(0,size-last),end:size-1};}
 const end=last===null?size-1:Math.min(last,size-1);
 return first>=size||first>end?null:{start:first,end};
}
