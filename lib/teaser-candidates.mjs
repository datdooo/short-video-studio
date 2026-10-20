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
   if(terminal(c.text)&&(c.end-first.start)/rate>=.5){speech.push({start:first.start,end:c.end,text,cueIds:group.map(c=>c.cueId),kind:'speech',boundaryEvidence:'Transcript boundary proposal, not an editorial score; inspect the event, opening appeal and complete meaning.'});}
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
 // Keep short and multi-sentence endpoints in input: the first punctuation
 // mark must not decide the winner or hide a later payoff. Spread selection is
 // coverage only, never a claim of semantic interest.
 const speechByStart=new Map();
 for(const c of speech){const group=speechByStart.get(c.start)||[];group.push(c);speechByStart.set(c.start,group);}
 const bundles=[...speechByStart.values()].map(g=>({...g.at(-1),boundaryOptions:g.filter((_,i)=>i===0||i===g.length-1).map(c=>({start:c.start,end:c.end,text:c.text,cueIds:c.cueIds}))}));
 const temporal=[],total=ranges.reduce((n,r)=>n+r.end-r.start,0);
 // Visual proposals ALWAYS participate, even when there is plenty of speech.
 // Captions cannot show a catch, interaction, reaction or quiet discovery.
 for(let i=0;i<12&&total>0;i++){
   let offset=(i+.5)/12*total,r=ranges[0];for(const candidate of ranges){r=candidate;if(offset<r.end-r.start)break;offset-=r.end-r.start;}
   const span=Math.min(maxSourceSeconds,r.end-r.start),start=Math.max(r.start,Math.min(r.end-span,r.start+offset-span/2)),end=start+span;
   if(span/rate>=.5)temporal.push({start,end,text:timed.filter(c=>c.start<end&&c.end>start).map(c=>c.text).join(' ').slice(0,1800),cueIds:timed.filter(c=>c.start<end&&c.end>start).map(c=>c.cueId).slice(0,24),kind:'visual-review',boundaryEvidence:'Temporal proposal, not a complete action. Review actual frames and repair to a meaningful start/end; never invent motion.'});
 }
 // Source-specific metadata/comments/local proxies can locate additional
 // places to inspect, never establish interest, a catch, speech or an emotion.
 const extraPoints=[
  ...(signals.commentClusters||[]).slice(0,24).map(c=>({time:c.centerMs/1000,basis:'timestamped-comment-context'})),
  ...(signals.chapters||[]).slice(0,24).map(c=>({time:c.startMs/1000,basis:'chapter-context'})),
  ...(signals.visualSignals?.status==='available'?(signals.visualSignals.boundaries||[]).slice(0,24).map(c=>({time:c.time,basis:'local-scene-change-proxy'})):[]),
  ...(signals.audioSignals?.status==='available'?(signals.audioSignals.activity||[]).filter((_,i)=>i%20===0).slice(0,12).map(c=>({time:c.start,basis:'local-audio-activity-proxy-not-speech'})):[]),
 ];
 const extra=[];
 for(const point of extraPoints){if(!Number.isFinite(point.time))continue;const r=ranges.find(r=>point.time>=r.start&&point.time<r.end);if(!r)continue;
  const span=Math.min(maxSourceSeconds,r.end-r.start),start=Math.max(r.start,Math.min(r.end-span,point.time-span/2));if(span/rate<.5)continue;
  const aligned=bundles.find(c=>c.start<=point.time&&c.end>=point.time);
  extra.push({...aligned,...(!aligned?{start,end:start+span,text:'',cueIds:[],kind:'visual-review',boundaryEvidence:'Context/proxy proposal only; event and complete boundaries require actual evidence.'}:{}),proposalSignals:[{time:point.time,basis:point.basis}]});
 }
 // Reserve room for each evidence channel; neither punctuation nor replay can
 // crowd visual opportunities out. Suppress near-identical windows, not genres.
 const replay=diverseExcerpts(peakProposals,3),extraCandidates=diverseExcerpts(extra,2),speechSlots=replay.length||extraCandidates.length?3:6;
 const reserved=[...replay,...extraCandidates,...diverseExcerpts(bundles,speechSlots),...diverseExcerpts(temporal,12-replay.length-extraCandidates.length-speechSlots)];
 let proposals=diverseExcerpts(reserved,12);
 for(const c of [...temporal,...bundles]){if(proposals.length>=12)break;proposals=diverseExcerpts([...proposals,c],12);}
 proposals.sort((a,b)=>a.start-b.start);
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
 // Every proposed candidate receives local evidence, not just first/middle/last
 // candidates. Max12 x4 frames; no full-video transcode, no motion claims.
 return candidates.slice(0,12).flatMap(c=>[...new Set([c.start+.001,Math.min(c.end-.001,c.start+1.25),(c.start+c.end)/2,c.end-.001])].map(time=>({time,candidateId:c.id})));
}
