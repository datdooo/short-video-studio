import {validateHeatmap} from "./source-context/heatmap.mjs";
// Overlap suppression narrowly adapted from highlights.py::dedupe_highlights,
// Anil-matcha/AI-Youtube-Shorts-Generator @3d11f2e6ecbbb9757d788e1bd05695c01f3e6c6c.
// Copyright (c) 2026 Anil Chandra Naidu Matcha. MIT, see third_party/teaser-reuse/.
// Adaptations: no viral score; deterministic source coordinates, spread coverage,
// bounded cue/context windows; no model/framework dependency.
const terminal=s=>/[.!?。！？]["'”’)]*$/u.test(s.trim());
export function diverseExcerpts(candidates,limit=12){
 const kept=[];
 for(const h of candidates){const length=h.end-h.start;if(length<=0)continue;
  if(kept.some(k=>Math.min(h.end,k.end)-Math.max(h.start,k.start)>.5*Math.min(length,k.end-k.start)))continue;
  kept.push(h);
 }
 if(kept.length<=limit)return kept;
 return Array.from({length:limit},(_,i)=>kept[Math.round(i*(kept.length-1)/(limit-1))]);
}
export function buildHookCandidates(ranges,cues,rate,maxSourceSeconds,signals={}){
 const timed=cues.slice(0,20000).map((c,i)=>({...c,cueId:`cue-${i}`})).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string'&&c.text.trim()).sort((a,b)=>a.start-b.start||a.end-b.end);
 const speech=[];
 // Uniformly bounded starts, no prefix-only truncation or genre keyword rank.
 for(let i=0;i<timed.length;i+=Math.max(1,Math.ceil(timed.length/1000))){const first=timed[i],range=ranges.find(r=>first.start>=r.start&&first.end<=r.end);if(!range)continue;
  const prev=timed[i-1];if(prev&&prev.end>=first.start-1&&!terminal(prev.text))continue;
  const group=[];let text='';
  for(let j=i;j<Math.min(timed.length,i+32);j++){const c=timed[j],p=timed[j-1];if(c.end>range.end||c.end-first.start>maxSourceSeconds||(j>i&&(c.start<p.end||c.start-p.end>1)))break;group.push(c);text+=(text?' ':'')+c.text.trim();if(text.length>1800)break;
   if(terminal(c.text)&&(c.end-first.start)/rate>=.5){speech.push({start:first.start,end:c.end,text,cueIds:group.map(c=>c.cueId),kind:'speech',boundaryEvidence:'Transcript punctuation only; semantic completeness requires provider/user review.'});break;}
  }
 }
 const durationMs=Math.ceil(Math.max(0,...ranges.map(r=>r.end))*1000),heatmap=validateHeatmap(signals.heatmap,{durationMs:signals.sourceDurationMs||durationMs});
 const peaks=heatmap?.status==='available'?heatmap.bins.filter(b=>b.intensity>0&&ranges.some(r=>b.startMs/1000<r.end&&b.endMs/1000>r.start)).sort((a,b)=>b.intensity-a.intensity).slice(0,6):[];
 const peakProposals=[];
 for(const peak of peaks){const center=(peak.startMs+peak.endMs)/2000,r=ranges.find(r=>center>=r.start&&center<=r.end);if(!r)continue;
  const aligned=speech.filter(c=>c.start<=center+2&&c.end>=center-2).sort((a,b)=>Math.abs((a.start+a.end)/2-center)-Math.abs((b.start+b.end)/2-center))[0];
  const length=Math.min(maxSourceSeconds,r.end-r.start),start=Math.max(r.start,Math.min(r.end-length,center-length/2));
  if(length/rate<.5)continue;
  peakProposals.push({...aligned,...(!aligned?{start,end:start+length,text:'',cueIds:[],kind:'visual-review',boundaryEvidence:'Replay-centered temporal window; meaningful boundaries still require review.'}:{}),replayPeak:{startMs:peak.startMs,endMs:peak.endMs,intensity:peak.intensity}});
 }
 let proposals=diverseExcerpts(speech.sort((a,b)=>a.start-b.start),9);
 // Even without captions offer temporal proposals for visual inspection, not
 // fabricated actions. Quiet events are as eligible as loud/high-motion events.
 if(proposals.length<6){const total=ranges.reduce((n,r)=>n+r.end-r.start,0);for(let i=0;i<12&&total>0;i++){
   let offset=(i+.5)/12*total,r=ranges[0];for(const candidate of ranges){r=candidate;if(offset<r.end-r.start)break;offset-=r.end-r.start;}
   const span=Math.min(maxSourceSeconds,r.end-r.start),start=Math.max(r.start,Math.min(r.end-span,r.start+offset-span/2)),end=start+span;
   if(span/rate>=.5)proposals.push({start,end,text:'',cueIds:timed.filter(c=>c.start<end&&c.end>start).map(c=>c.cueId).slice(0,24),kind:'visual-review',boundaryEvidence:'Temporal proposal only; inspect actual event, start context and ending. No action is inferred.'});
  }
  proposals=diverseExcerpts(proposals,12);
 }
 proposals=diverseExcerpts([...peakProposals.slice(0,3),...proposals],12).sort((a,b)=>a.start-b.start);
 return proposals.map((c,i)=>({...c,id:`candidate-${i+1}`,renderedSeconds:(c.end-c.start)/rate,editorialVerified:false,
  before:timed.filter(x=>x.end<=c.start&&x.end>=c.start-8).slice(-3).map(({cueId,start,end,text})=>({cueId,start,end,text:text.slice(0,240)})),
  after:timed.filter(x=>x.start>=c.end&&x.start<=c.end+8).slice(0,3).map(({cueId,start,end,text})=>({cueId,start,end,text:text.slice(0,240)})),
  supporting:{...(c.replayPeak?{replayPeak:c.replayPeak}:{}),correlatedSignalsPolicy:"comment/replay corroboration only; never added as independent quality votes",chapters:(signals.chapters||[]).filter(x=>x.startMs/1000<=c.end&&x.endMs/1000>=c.start).slice(0,2),commentClusters:(signals.commentClusters||[]).filter(x=>x.centerMs/1000>=c.start&&x.centerMs/1000<=c.end).slice(0,2)},
 }));
}
export function partContextWindows(ranges,cues){
 const available=cues.slice(0,20000).map((c,i)=>({...c,cueId:`cue-${i}`})).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&typeof c.text==='string'&&ranges.some(r=>c.start<r.end&&c.end>r.start));
 const windows=[];const span=available.length/12;
 for(let i=0;i<Math.min(12,available.length);i++){const middle=Math.min(available.length-1,Math.floor((i+.5)*span));windows.push(available.slice(Math.max(0,middle-5),middle+6).map(({cueId,start,end,text})=>({cueId,start,end,text:text.slice(0,240)})));}
 return windows;
}
export function candidateFrameTimes(candidates){
 const chosen=candidates.length<=3?candidates:[candidates[0],candidates[Math.floor(candidates.length/2)],candidates.at(-1)];
 return chosen.flatMap(c=>[c.start+.01,(c.start+c.end)/2,Math.max(c.start,c.end-.01)].map(time=>({time,candidateId:c.id})));
}
