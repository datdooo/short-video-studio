import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewClock} from './preview-clock.mjs';
function fixture(){
 let ms=0,id=0;const timers=new Map();
 const clock=createPreviewClock({now:()=>ms,schedule:(fn,wait)=>{timers.set(++id,{fn,at:ms+wait});return id;},cancel:id=>timers.delete(id)});
 const advance=to=>{for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>to)break;ms=next[1].at;timers.delete(next[0]);next[1].fn();}ms=to;};
 return{clock,advance,timers};
}
test('60 frame callbacks keep exact time while notifying display subscribers only 10 times',()=>{
 const f=fixture();let publishes=0;const stop=f.clock.subscribe(()=>publishes++);
 for(let frame=1;frame<=60;frame++){
  f.advance(frame*1000/60);f.clock.setTime(frame/60);
  assert.equal(f.clock.timeRef.current,frame/60);
 }
 assert.equal(publishes,10);console.log(`Synthetic clock: 60 callbacks -> ${publishes} display notifications in 1s`);
 f.advance(1100);assert.equal(f.clock.getSnapshot(),1);
 stop();const before=publishes;f.clock.setTime(2);f.advance(1300);assert.equal(publishes,before);
});
test('rapid seek and functional updates use exact clock; pending display update never restores stale time',()=>{
 const f=fixture();f.clock.setTime(10.123456789);f.advance(1);f.clock.setTime(time=>time+5);
 assert.equal(f.clock.timeRef.current,15.123456789);
 f.clock.setTime(0);f.advance(100);assert.equal(f.clock.getSnapshot(),0);
 f.advance(101);f.clock.setTime(2);assert.equal(f.timers.size,1);f.clock.dispose();assert.equal(f.timers.size,0);
});
