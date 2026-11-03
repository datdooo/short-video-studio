import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built=await build({entryPoints:[fileURLToPath(new URL('./ai-progress.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {readAiOperation}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const decoderBuild=await build({entryPoints:[fileURLToPath(new URL('./ai-response.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {planResult,contextResult}=await import('data:text/javascript;base64,'+Buffer.from(decoderBuild.outputFiles[0].text).toString('base64'));
const render={width:1080,height:1920,speed:1.25,preservePitch:true,backgroundBlur:50,backgroundOpacity:50};
const plan=()=>({originalTitle:'Nguồn giả',providerUsed:'manual',language:'vi',render,parts:[1,2].map(id=>({id,title:'Nháp',hook:'Câu nguồn',hashtags:[],segments:[{start:id*10,end:id*10+5,label:'Giữ',reason:'Fixture'}]}))});
const diagnostic={id:'synthetic',stage:'validation',elapsedMs:12,requestCount:1,requests:[],events:[]};
function stream(text){const bytes=new TextEncoder().encode(text);let at=0;return new Response(new ReadableStream({pull(c){if(at===bytes.length){c.close();return;}c.enqueue(bytes.slice(at,at+7));at=Math.min(bytes.length,at+7);}}),{headers:{'Content-Type':'application/x-ndjson'}});}
test('JSON and chunked CRLF NDJSON validate the same plan without modifying source times or draft',async()=>{
 const input=plan(),before=structuredClone(input),events=[];
 const one=await readAiOperation(Response.json({plan:input,diagnostics:diagnostic}),d=>events.push(d),planResult);
 const two=await readAiOperation(stream(JSON.stringify({type:'progress',diagnostics:diagnostic})+'\r\n'+JSON.stringify({type:'result',plan:input})+'\r\n'),d=>events.push(d),planResult);
 assert.deepEqual(one.plan,input);assert.deepEqual(two.plan,input);assert.deepEqual(input,before);assert.equal(events.length,2);
 const direct=planResult({plan:input});assert.equal(direct.plan,input,'Decoder does not normalize or replace the accepted object');
});
test('unknown primitives, malformed payloads and unfinished streams reject without inventing a result',async()=>{
 for(const value of [null,[],42,{error:42},{plan:{parts:[]}},{plan:{...plan(),render:{...render,speed:5}}}])await assert.rejects(readAiOperation(Response.json(value),()=>{},planResult));
 await assert.rejects(readAiOperation(stream('{"type":"progress"}\n'),()=>{},planResult),/trước khi có kết quả/);
 await assert.rejects(readAiOperation(stream('null\n'),()=>{},planResult),/object/);
});
test('safe error responses and web-context payloads retain diagnostics and validate nested attachment types',async()=>{
 const error=await readAiOperation(Response.json({error:'Không có quyền',diagnostics:diagnostic},{status:401}),()=>{},planResult);assert.equal(error.error,'Không có quyền');assert.equal(error.plan,undefined);
 const context={analysisKey:'abc',attachments:{sourceVideo:{id:'source',filename:'source.mp4',bytes:null,duration:100}},extra:'kept'};
 assert.equal(contextResult({context}).context,context);
 for(const value of [{},null,{analysisKey:5},{analysisKey:'abc',attachments:{sourceVideo:{}}},{...context,captionTrack:{cues:[]}}])assert.throws(()=>contextResult({context:value}));
});

test('stream read failure releases its reader without accepting partial result',async()=>{
 let streamController;
 const body=new ReadableStream({start(c){streamController=c;}});
 const pending=readAiOperation(new Response(body,{headers:{'Content-Type':'application/x-ndjson'}}),()=>{},planResult);
 streamController.enqueue(new TextEncoder().encode('{"type":"result","plan":'));
 streamController.error(new DOMException('Synthetic cancellation','AbortError'));
 await assert.rejects(pending,{name:'AbortError'});assert.equal(body.locked,false);
});

test('structurally valid preserved teaser remains editable when its old main context is stale',()=>{
 const input=plan();input.parts[0].teaserNeedsReselection=true;
 input.parts[0].teaser={version:1,status:'selected',selection:'manual',start:2,end:99,reason:'Preserved manual draft',rangeKey:'previous-main',relation:'User range',evidenceTimes:[2],limitations:[],provider:'user',model:'manual',promptVersion:'saved',inputKey:'saved',transition:'inherit-or-dip-black'};
 const result=planResult({plan:input});assert.equal(result.plan,input);assert.equal(result.plan.parts[0].teaser.end,99);assert.equal(result.plan.parts[0].teaserNeedsReselection,true);
});

// Shape decoding must accept both ordinary worker outcomes. Readiness is separate.
test('AI selected and unavailable worker outcomes both decode without a semantic rewrite',async()=>{
 for(const state of ['selected','unavailable']){
  const input=plan();input.providerUsed='chatgpt';
  input.parts[0].teaser={version:1,status:state,reason:'Fixture',rangeKey:'source-main',...(state==='selected'?{selection:'ai',start:10,end:15,relation:'Main',evidenceTimes:[10],limitations:[],provider:'chatgpt',model:'gpt-6.1-sol',promptVersion:'current',inputKey:'context',transition:'inherit-or-dip-black'}:{})};
  const result=await readAiOperation(Response.json({plan:input}),()=>{},planResult);assert.deepEqual(result.plan,input);
 }
});
