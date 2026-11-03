import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {installFatalHandlers} from './fatal-errors.mjs';
for(const kind of ['unhandledRejection','uncaughtException']) test(`fatal ${kind} exits nonzero after shutdown, logs no raw input`,async()=>{
 const target=new EventEmitter(),lines=[],exits=[];let stops=0;
 const remove=installFatalHandlers({target,shutdown:async()=>{stops++;throw Error('secret');},log:line=>lines.push(line),exit:code=>exits.push(code)});
 target.emit(kind,Error('secret /user/path'));target.emit(kind,Error('again'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(stops,1);assert.deepEqual(exits,[1]);assert.ok(!lines.join('').includes('secret'));remove();assert.equal(target.listenerCount(kind),0);
});
test('fatal shutdown has a bounded nonzero exit when checkpoint stalls',async()=>{
 const target=new EventEmitter();const code=await new Promise(resolve=>{
  const timer=setTimeout(()=>assert.fail('timeout not enforced'),1000);
  installFatalHandlers({target,shutdown:()=>new Promise(()=>{}),exit:code=>{clearTimeout(timer);resolve(code);},log:()=>{},timeoutMs:5});target.emit('uncaughtException',Error('fixture'));
 });assert.equal(code,1);
});
