import {PLAYBACK_RATE} from '../lib/render-config.mjs';
import {DUCK_GAIN,DUCKING_VERSION,duckWindows,mapSpeechIntervals,duckSidechainExpression} from '../lib/music/envelope.mjs';
export function musicDuckingState({settings,part,activity,duration,speed=PLAYBACK_RATE}){
  const windows=settings.ducking?duckWindows(mapSpeechIntervals(part,activity,speed),duration):[];
  return {version:DUCKING_VERSION,applied:windows.length>0,windows,
    reason:!settings.ducking?'Đã tắt giảm nhạc tự động.':activity?.status!=='available'?'VAD chưa khả dụng; chỉ dùng mức nhạc thủ công.':!windows.length?'Không có lời nói VAD trong timeline part này; giữ mức nhạc thủ công.':'Đã map VAD qua teaser/cuts; chỉ nhạc thêm được giảm khoảng 12 dB khi có lời nói.'};
}
export function musicMixFilters({input,settings,part,activity,duration,speed=PLAYBACK_RATE}){
  const fade=Math.min(.15,duration/4),{windows}=musicDuckingState({settings,part,activity,duration,speed});
  const headroom=c=>`val(${c})+sgn(val(${c+2}))*min(abs(val(${c+2})),max(0,0.98-abs(val(${c}))))`;
  const bed=`[${input}:a]atrim=duration=${duration+.25},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,asetnsamples=n=240:p=0,volume=${settings.volume/100},afade=t=in:d=${fade},afade=t=out:st=${duration-fade}:d=${fade}`;
  const filters=windows.length?[
    `${bed}[musicbed]`,
    `aevalsrc='${duckSidechainExpression(windows)}':s=48000:d=${duration+.25}:c=mono,asetnsamples=n=240:p=0[vadkey]`,
    `[musicbed][vadkey]sidechaincompress=threshold=${DUCK_GAIN**2}:ratio=2:knee=1:attack=0.01:release=0.01:makeup=1:level_in=1:level_sc=1:mix=1:detection=peak:link=maximum,apad[bgm]`
  ]:[`${bed},apad[bgm]`];
  return [...filters,
    '[originalaudio][bgm]amerge=inputs=2[musicmerged]',`[musicmerged]aeval='${headroom(0)}|${headroom(1)}':c=stereo,pan=stereo|c0=c0|c1=c1[aout]`];
}
export function seamlessMusicFilter(duration){const seam=Math.min(.05,duration/8);return `[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=3[h][b][t];[h]atrim=0:${seam},asetpts=PTS-STARTPTS[head];[b]atrim=${seam}:${duration-seam},asetpts=PTS-STARTPTS[body];[t]atrim=${duration-seam}:${duration},asetpts=PTS-STARTPTS[tail];[tail][head]acrossfade=d=${seam}:c1=tri:c2=tri[seam];[body][seam]concat=n=2:v=0:a=1[out]`;}
