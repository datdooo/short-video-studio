// Adapted from MR.HiSum preprocess/preprocess.py::align_most_replayed,
// @aeb667f71239887034c2974062a341d312762867 (also provided as personalproject/).
// Copyright (c) 2023 Jinhwan Sul, Jihoon Han, Joonseok Lee (MR.HiSum). See third_party/mr-hisum/LICENSE and README.
// Separate author permission: reported by the project owner, 2026-10-21.
// JS port: validated variable-width bins instead of a fixed100-bin assumption;
// source-time lookup, null gaps (never fabricate interest), <=4096 samples.
export function alignReplayToSource(bins,durationSeconds,maxSamples=4096){
 if(!Array.isArray(bins)||!Number.isFinite(durationSeconds)||durationSeconds<=0)return[];
 const valid=bins.filter(b=>Number.isFinite(b.startMs)&&Number.isFinite(b.endMs)&&b.startMs>=0&&b.endMs>b.startMs&&b.endMs<=durationSeconds*1000&&Number.isFinite(b.intensity)&&b.intensity>=0&&b.intensity<=1).slice().sort((a,b)=>a.startMs-b.startMs);
 if(!valid.length)return[];
 const step=Math.max(1,Math.ceil(durationSeconds/Math.max(1,Math.min(4096,maxSamples)))),aligned=[];
 let bin=0;
 for(let second=0;second<durationSeconds;second+=step){
  const timeMs=second*1000;while(bin<valid.length&&valid[bin].endMs<=timeMs)bin++;
  const current=valid[bin],inside=current&&timeMs>=current.startMs&&timeMs<current.endMs;
  aligned.push({sourceTime:second,intensity:inside?current.intensity:null,...(inside?{binStartMs:current.startMs,binEndMs:current.endMs}:{})});
 }
 return aligned;
}
