import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {verifiedRenderOutput} from './render-resume.mjs';
test('resume reuses only verified own-job completed output; missing/corrupt geometry/duration is not marked complete',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'resume-part-'));t.after(()=>rm(root,{recursive:true,force:true}));const file=path.join(root,'part.mp4');await writeFile(file,Buffer.alloc(2048));
 const input={file,filename:'part.mp4',sourceId:'source',jobId:'job',partId:1,duration:61,probe:async()=>({width:1080,height:1920,hasAudio:true,duration:61})};
 assert.equal((await verifiedRenderOutput(input)).part,1);assert.equal(await verifiedRenderOutput({...input,record:{filename:'part.mp4',size:2047}}),null);
 assert.equal(await verifiedRenderOutput({...input,duration:62}),null);assert.equal(await verifiedRenderOutput({...input,probe:async()=>({width:720,height:1280,hasAudio:true,duration:61})}),null);
 assert.equal(await verifiedRenderOutput({...input,file:path.join(root,'missing.mp4')}),null);
});
