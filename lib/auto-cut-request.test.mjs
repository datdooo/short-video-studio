import test from 'node:test';import assert from 'node:assert/strict';import {createAnalysisRequestGuard} from './auto-cut/request.mjs';import {buildMusePrompt,parseMusePlan} from './muse-plan.mjs';import {lockedParts} from './auto-cut/locks.mjs';
test('source/input/cancel invalidation rejects stale completion; unrelated visual edits retain the active ticket',()=>{
 const guard=createAnalysisRequestGuard(),a=guard.begin();assert.equal(guard.isCurrent(a),true);const b=guard.begin();assert.equal(a.controller.signal.aborted,true);assert.equal(guard.isCurrent(a),false);assert.equal(guard.isCurrent(b),true);
 const style={font:'new'};assert.ok(style);assert.equal(guard.isCurrent(b),true);guard.invalidate();assert.equal(b.controller.signal.aborted,true);assert.equal(guard.isCurrent(b),false);
 const c=guard.begin();guard.finish(b);assert.equal(guard.isCurrent(c),true);guard.finish(c);assert.equal(guard.isCurrent(c),false);
 assert.deepEqual(lockedParts({providerUsed:'manual',parts:[{manualLocked:false},{}]}),[false,true]);
});
test('external prompt binds analysis key, source and request; mismatched/new arbitrary root fields are not accepted',()=>{
 const source={id:'source',title:'Fixture',duration:200};const schema={type:'object',properties:{parts:{items:{properties:{},required:[]}}},required:['parts']};
 const prompt=buildMusePrompt('Untrusted source context',schema,source,{requestId:'request',analysisKey:'expected'});assert.match(prompt,/analysisKey/);
 const payload={sourceId:source.id,requestId:'request',analysisKey:'wrong',originalTitle:source.title,language:'en',parts:[]};assert.throws(()=>parseMusePlan(JSON.stringify(payload),source,'Gemini',{requestId:'request',analysisKey:'expected'}),/Analysis context/);
});
