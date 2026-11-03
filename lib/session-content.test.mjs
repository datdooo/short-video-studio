import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['lib/session-content.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {hasSessionContent}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('new session and layout changes contain nothing to archive',()=>{
 assert.equal(hasSessionContent({hasEditPlan:false,plan:{parts:[{title:'mock'}]},workspace:'storage',previewTime:0,controls:{},sourceUrl:'  '}),false);
});
test('incomplete text, source, batch, manual and imported work remain saveable',()=>{
 for(const data of [{sourceUrl:'invalid unfinished URL'},{transcript:'draft'},{manualPart1Ranges:'00:'},{controls:{'source:manual-cut':{ranges:'draft'}}},{hasEditPlan:true},{sourceId:'fixture'},{batchUrls:'draft link'},{webAiResult:'{'}]) assert.equal(hasSessionContent(data),true);
});
