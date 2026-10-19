import {duckWindows,mapSpeechIntervals,duckExpression} from '../lib/music/envelope.mjs';
export function musicMixFilters({input,settings,part,activity,duration}){
  const fade=Math.min(.15,duration/4),windows=settings.ducking?duckWindows(mapSpeechIntervals(part,activity),duration):[];
  const headroom=c=>`val(${c})+sgn(val(${c+2}))*min(abs(val(${c+2})),max(0,0.98-abs(val(${c}))))`;
  return [`[${input}:a]atrim=duration=${duration+.25},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,asetnsamples=n=240:p=0,volume='${settings.volume/100}*(${duckExpression(windows)})':eval=frame,afade=t=in:d=${fade},afade=t=out:st=${duration-fade}:d=${fade},apad[bgm]`,
    '[originalaudio][bgm]amerge=inputs=2[musicmerged]',`[musicmerged]aeval='${headroom(0)}|${headroom(1)}':c=stereo,pan=stereo|c0=c0|c1=c1[aout]`];
}
export function seamlessMusicFilter(duration){const seam=Math.min(.05,duration/8);return `[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=3[h][b][t];[h]atrim=0:${seam},asetpts=PTS-STARTPTS[head];[b]atrim=${seam}:${duration-seam},asetpts=PTS-STARTPTS[body];[t]atrim=${duration-seam}:${duration},asetpts=PTS-STARTPTS[tail];[tail][head]acrossfade=d=${seam}:c1=tri:c2=tri[seam];[body][seam]concat=n=2:v=0:a=1[out]`;}
