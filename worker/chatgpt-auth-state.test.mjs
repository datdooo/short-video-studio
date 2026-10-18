import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthAttempts, tokenError, assertTokenResponse, sessionHealth } from './chatgpt-auth-state.mjs';
test('auth polling follows the specific new attempt, never a previously connected session', () => {
 const a=createAuthAttempts(); a.add({state:'old'});a.finish('old','connected');a.add({state:'new'});
 assert.deepEqual(a.public('new'),{status:'pending'});a.take('new');assert.throws(()=>a.take('new'));
 a.finish('new','failed','Login cancelled');assert.deepEqual(a.public('new'),{status:'failed',error:'Login cancelled'});
 assert.deepEqual(a.public('old'),{status:'connected'});
});
test('expired/cancelled callbacks cannot exchange or replace credentials', () => {
 let now=0;const a=createAuthAttempts({now:()=>now,ttl:100});a.add({state:'a'});now=101;
 assert.equal(a.public('a').status,'expired');assert.throws(()=>a.take('a'));a.add({state:'b'});a.cancel('b');assert.throws(()=>a.take('b'));
 assert.equal(a.public('unknown').status,'expired');assert.ok(!JSON.stringify(a.public('b')).includes('verifier'));
});
test('expired credentials are actionable, permission is never inferred from identity alone',()=>{
 assert.equal(sessionHealth(null).sharing,false);
 assert.equal(sessionHealth({scopes:['openid'],expires_at:new Date(Date.now()+10000).toISOString()}).sharing,false);
 assert.equal(sessionHealth({scopes:['chatgpt.tokens.use.direct'],expires_at:'invalid'}).needsSignIn,true);
 assert.equal(sessionHealth({scopes:['chatgpt.tokens.use.direct'],expires_at:new Date(Date.now()+10000).toISOString()}).sharing,true);
});
test('malformed token responses cannot replace the previous secure credential; remote details stay private',()=>{
 for(const t of [{},{access_token:'x'},{access_token:'',expires_in:3600},{access_token:'x',expires_in:-1}])assert.throws(()=>assertTokenResponse(t));
 assert.doesNotThrow(()=>assertTokenResponse({access_token:'private',expires_in:3600}));
 assert.equal(tokenError({error:'invalid_grant',error_description:'SECRET'},400).status,401);
 assert.doesNotMatch(tokenError({error_description:'SECRET'},500).message,/SECRET/);
});
test('disconnect cancels pending and exchanging sign-ins; remote origins cannot inspect/start auth',async()=>{
 const {localAuthOrigin}=await import('./chatgpt-auth-state.mjs');const a=createAuthAttempts();a.add({state:'pending'});a.add({state:'exchange'});a.take('exchange');a.cancelAll();
 assert.equal(a.public('pending').status,'cancelled');assert.equal(a.get('exchange').status,'cancelled');assert.throws(()=>a.take('pending'));
 for(const o of [undefined,'http://127.0.0.1:5273','http://localhost:5273'])assert.equal(localAuthOrigin(o),true);
 for(const o of ['null','https://example.com','http://127.0.0.1.attacker.example','file://local'])assert.equal(localAuthOrigin(o),false);
});
