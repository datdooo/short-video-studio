import test from 'node:test';
import assert from 'node:assert/strict';
import {build}from'esbuild';
import{fileURLToPath}from'node:url';
const output=await build({entryPoints:[fileURLToPath(new URL('./api/worker-client.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const{workerFetch,workerJson,readSourcePreparation}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
test('worker client preserves Beta origin, raw response, body and AbortSignal without retries',async()=>{
 const original=globalThis.fetch;const calls=[],controller=new AbortController();const response=new Response('stream');
 globalThis.fetch=async(...args)=>{calls.push(args);return response;};try{const init={method:'POST',body:'payload',signal:controller.signal};assert.equal(await workerFetch('/api/sources/test/teaser-hooks',init),response);assert.deepEqual(calls,[['http://127.0.0.1:8987/api/sources/test/teaser-hooks',init]]);}finally{globalThis.fetch=original;}
});
test('typed JSON decoding retains safe server error and never retries an error',async()=>{
 const original=globalThis.fetch;let count=0;globalThis.fetch=async()=>{count++;return Response.json({error:'Fixture unavailable'},{status:503});};try{await assert.rejects(workerJson('/health',()=>{throw Error('must not decode');}),/Fixture unavailable/);assert.equal(count,1);}finally{globalThis.fetch=original;}
});
test('source preparation NDJSON parser keeps boundary chunks, complete source and releases reader',async()=>{
 const source={id:'synthetic',duration:20},lines=JSON.stringify({type:'progress',phase:'download',percent:32})+'\r\n'+JSON.stringify({type:'result',source})+'\r\n';const bytes=new TextEncoder().encode(lines);let offset=0;
 const body=new ReadableStream({pull(c){if(offset>=bytes.length)return c.close();c.enqueue(bytes.slice(offset,offset+3));offset+=3;}}),events=[];
 assert.deepEqual(await readSourcePreparation(new Response(body,{headers:{'Content-Type':'application/x-ndjson'}}),p=>events.push(p)),{source});assert.equal(events[0].percent,32);assert.equal(body.locked,false);
});
