import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MAIN_INSTRUCTIONS} from './auto-cut/main-content.mjs';
import {buildMusePrompt,manualMainRules,WEB_AI_PROMPT_VERSION,WEB_AI_COMPATIBLE_PROMPT_VERSIONS} from './muse-plan.mjs';
import {ADAPTIVE_HOOK_PROMPT_VERSIONS} from './prompt-versions.mjs';
import {rainbowChannels} from './music/light-leak.mjs';
import {CANVAS_WIDTH,CANVAS_HEIGHT,PLAYBACK_RATE,RENDER_FPS,BACKGROUND_BLUR,BACKGROUND_OPACITY} from './render-config.mjs';
test('manual prompt patches fail loudly on canonical drift and have no text-only contradiction',()=>{
 assert.doesNotMatch(manualMainRules(MAIN_INSTRUCTIONS),/No images\/video\/audio are supplied/);
 assert.throws(()=>manualMainRules(MAIN_INSTRUCTIONS.replace('No images/video/audio are supplied; never claim to see/hear footage.','changed')),/Manual prompt rule missing/);
 const prompt=buildMusePrompt('',{properties:{},required:[]},{id:'synthetic',title:'Giả lập',duration:120},{context:{version:WEB_AI_PROMPT_VERSION,rules:{main:MAIN_INSTRUCTIONS}}});
 assert.doesNotMatch(prompt,/No images\/video\/audio are supplied|at1x|first10|maximum9|normally1080p|below480p|a480p|optional480p|parts1\/2/);
 assert.match(prompt,/at 1x/);assert.match(prompt,/first 10/);assert.match(prompt,/maximum 9/);assert.match(prompt,/480p/);
 assert.match(prompt,/without a quota-saving ceiling; prioritize quality over a cheap guess/);
});
test('all released TXT versions and exactly the existing adaptive hook versions stay accepted',()=>{
 assert.equal(WEB_AI_PROMPT_VERSION,'external-editing-full-media-compact-v24');
 assert.deepEqual(WEB_AI_COMPATIBLE_PROMPT_VERSIONS,[19,20,21,22,23,24].map(v=>`external-editing-full-media-compact-v${v}`));
 assert.deepEqual(ADAPTIVE_HOOK_PROMPT_VERSIONS,['same-part-hook-v12-text-reselection','same-part-hook-v10-evidence-discovery','same-part-hook-v9-ranked-selection','same-part-hook-v8-timing-provenance','same-part-hook-v7-complete-speech','same-part-hook-v6-impact-evidence','same-part-hook-v5-vietnamese','same-part-hook-v4-part-arc','same-part-hook-v3-editorial']);
});
test('render consumers share constants with no repeated preset literals (source grep)',async()=>{
 for(const file of ['edit-plan.ts','ai-response.ts','auto-cut/main-content.mjs','music/light-leak.mjs']){
  const source=await readFile(new URL(file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:1080|1920|1\.25|50|30)\b/,file);
  assert.match(source,/render-config\.mjs/,file);
 }
 assert.deepEqual([CANVAS_WIDTH,CANVAS_HEIGHT,PLAYBACK_RATE,RENDER_FPS,BACKGROUND_BLUR,BACKGROUND_OPACITY],[1080,1920,1.25,30,50,50]);
 const channels=rainbowChannels([{startFrame:30,endFrame:60,halfFrames:15}]);
 assert.ok(channels.every(channel=>channel.includes('T*30/1.25-30')&&channel.includes('between(T,1.25,2.5)')));
});
