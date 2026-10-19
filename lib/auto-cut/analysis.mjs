const budgets={transcript:.2,chapters:.1,engagement:.15,visual:.05,audio:.05};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,n)=>typeof v==='string'&&v.length<=n;
export function validateMainAnalysis(value,source) {
  const invalid=()=>{throw new Error('Invalid or source-mismatched Smart Auto Cut analysis metadata.');};
  if(!object(value)||value.version!=='multi-signal-main-v1'||value.sourceId!==source.id||!text(value.sourceKey,512)||!['ai','deterministic-fallback','external-import'].includes(value.method)
    ||!text(value.provider,100)||!text(value.model,200)||!text(value.recipeId,200)||!text(value.scoreSemantics,200))invalid();
  if(!object(value.structural)||![value.structural.coverage,value.structural.balance].every(n=>Number.isFinite(n)&&n>=0&&n<=1))invalid();
  if(!Array.isArray(value.limitations)||value.limitations.length>12||value.limitations.some(t=>!text(t,500)))invalid();
  for(const key of ['analysisKey','cacheKey','localCacheKey'])if(value[key]!==undefined&&!/^[a-f0-9]{64}$/.test(value[key]))invalid();
  if(value.fallbackReason!==undefined&&!text(value.fallbackReason,500))invalid();
  if(!Array.isArray(value.parts)||value.parts.length!==2)invalid();
  for(const [i,part]of value.parts.entries()){
    if(!object(part)||part.id!==i+1||!text(part.reason,500)||!object(part.signals)||Object.keys(part.signals).length>5)invalid();
    for(const [name,signal]of Object.entries(part.signals)){
      if(!Object.hasOwn(budgets,name)||!object(signal)||!Number.isFinite(signal.contribution)||signal.contribution<0||signal.contribution>budgets[name]+.00001||!text(signal.detail,400)
        ||!Array.isArray(signal.evidence)||signal.evidence.length>12||signal.evidence.some(t=>!Number.isFinite(t)||t<0||t>source.duration))invalid();
    }
  }
}

export function invalidateEditedAnalysis(plan,parts,duration) {
  if(!plan.analysis)return undefined;
  const ranges=p=>p.segments.filter(s=>!s.isPadding).map(s=>[s.start,s.end]);
  const changed=parts.map((p,i)=>JSON.stringify(ranges(p))!==JSON.stringify(ranges(plan.parts[i])));
  if(!changed.some(Boolean))return plan.analysis;
  const lengths=parts.map(p=>ranges(p).reduce((n,[start,end])=>n+end-start,0));
  return{...plan.analysis,recipeId:'manual-customized',structural:{coverage:Number.isFinite(duration)?Math.min(1,lengths.reduce((a,b)=>a+b,0)/duration):plan.analysis.structural.coverage,balance:Math.min(...lengths)/Math.max(...lengths)},
    parts:plan.analysis.parts.map((p,i)=>changed[i]?{...p,reason:'Manual ranges changed; automatic evidence for this part was invalidated.',signals:{}}:p),
    limitations:[...new Set([...plan.analysis.limitations,'Manually edited parts require editorial review; previous automatic contributions are cleared.'])].slice(-12)};
}
