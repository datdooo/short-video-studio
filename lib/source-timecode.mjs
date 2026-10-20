import {RENDER_FPS} from './render-config.mjs';
// Non-drop 30fps SOURCE coordinates. Playback speed never participates here.
export const TIMECODE_FPS=RENDER_FPS;
export function parseSourceTimecode(value){
 if(typeof value!=='string'||!/^\d{2,}:\d{2}:\d{2}:\d{2}$/.test(value.trim()))throw Error('Nhập HH:MM:SS:FF (30 FPS), ví dụ 00:01:23:15.');
 const [hours,minutes,seconds,frames]=value.trim().split(':').map(Number);
 if(minutes>59||seconds>59||frames>=TIMECODE_FPS)throw Error('MM/SS từ 00–59; FF từ 00–29.');
 const count=((hours*60+minutes)*60+seconds)*TIMECODE_FPS+frames;
 if(!Number.isSafeInteger(count))throw Error('Timecode vượt giới hạn hợp lệ.');
 return count/TIMECODE_FPS;
}
export function formatSourceTimecode(seconds){
 if(!Number.isFinite(seconds)||seconds<0)throw Error('Timestamp nguồn phải hữu hạn, không âm.');
 // Display projection only. Sub-frame AI/caption times stay exact in the plan.
 const count=Math.floor(seconds*TIMECODE_FPS+1e-7);
 if(!Number.isSafeInteger(count))throw Error('Timestamp vượt giới hạn timecode.');
 const frames=count%TIMECODE_FPS,total=Math.floor(count/TIMECODE_FPS);
 return [Math.floor(total/3600),Math.floor(total/60)%60,total%60,frames].map(n=>String(n).padStart(2,'0')).join(':');
}
export function sourceTimecodeValue(value,exact){
 const parsed=parseSourceTimecode(value);
 // A display-only projection must not quantize an untouched original boundary.
 return Number.isFinite(exact)&&exact>=0&&value===formatSourceTimecode(exact)?exact:parsed;
}
