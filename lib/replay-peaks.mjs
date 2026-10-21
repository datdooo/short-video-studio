// Group adjacent bins into peak regions, splitting at a genuine relative valley
// rather than letting the number of bins count as separate votes. The 20% valley
// is a spatial grouping rule, NEVER an editorial/engagement acceptance score.
export function replayPeakRegions(bins){
 const ordered=bins.filter(b=>Number.isFinite(b.startMs)&&Number.isFinite(b.endMs)&&Number.isFinite(b.intensity)&&b.endMs>b.startMs&&b.intensity>0).slice().sort((a,b)=>a.startMs-b.startMs);
 const regions=[];let region=null,previous=null,falling=false;
 const flush=()=>{if(region)regions.push(region);};
 for(const bin of ordered){
  const gap=previous&&bin.startMs>previous.endMs+1;
  const separate=region&&previous&&falling&&bin.intensity>previous.intensity&&previous.intensity<=region.intensity*.8;
  if(!region||gap||separate){flush();region={...bin,regionStartMs:separate?previous.startMs:bin.startMs,regionEndMs:bin.endMs,binCount:1};falling=false;}
  else{region.regionEndMs=bin.endMs;region.binCount++;if(bin.intensity>region.intensity)Object.assign(region,{startMs:bin.startMs,endMs:bin.endMs,intensity:bin.intensity});if(bin.intensity<previous.intensity)falling=true;}
  previous=bin;
 }
 flush();return regions;
}

// Scope BEFORE finding peaks: a stronger bin in another part or across a removed
// gap must not hide the strongest retained bin here. Clipping affects the search
// interval only; the upstream relative intensity is unchanged.
export function replayRegionsForRanges(bins,ranges){
 const regions=[];
 for(const range of ranges){
  if(!Number.isFinite(range.start)||!Number.isFinite(range.end)||range.end<=range.start)continue;
  const local=bins.filter(b=>b.startMs<range.end*1000&&b.endMs>range.start*1000).map(b=>({...b,startMs:Math.max(b.startMs,range.start*1000),endMs:Math.min(b.endMs,range.end*1000)}));
  regions.push(...replayPeakRegions(local));
 }
 const ranked=regions.sort((a,b)=>b.intensity-a.intensity||a.startMs-b.startMs);
 return ranked.map((r,i)=>({...r,rankWithinPart:i+1,peakCount:ranked.length,partMaximumIntensity:ranked[0]?.intensity||0}));
}
