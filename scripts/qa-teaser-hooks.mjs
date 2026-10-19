// Small source-mode integration, not an RC matrix. --live requires real DEV
// ChatGPT credentials and rejects every heuristic fallback as AI verification.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { presentationSegments, fallbackTeaser } from "../lib/teaser-hooks.mjs";
import { locateTimelineTime } from "../lib/preview-timeline.mjs";
import { partCaptions } from "../lib/subtitles.mjs";
import { resolveRuntime, runtimeEnvironment, prepareRuntimeDirectories, assertRuntimePortsAvailable } from "../desktop/runtime-config.mjs";
const project = path.resolve(import.meta.dirname, "..");
const live = process.argv.includes("--live"), port = 8897;
const bin = path.join(project, "release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin");
await mkdir(path.join(project, ".isolation-verification"), { recursive: true });
const root = await mkdtemp(path.join(project, ".isolation-verification/teaser-render-"));
console.log(`QA root: ${root}`);
await assertRuntimePortsAvailable({ name: "Hook QA", webPort: port, workerPort: port });
const runtime = resolveRuntime({ profile: "development", home: path.join(root, "mock-home") });
await prepareRuntimeDirectories(runtime);
const dataRoot = path.join(root, "media"), api = `http://127.0.0.1:${port}`;
const run = (name, args) => {
  const result = spawnSync(path.join(bin, name), args, { maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.toString() || result.error?.message);
  return result.stdout;
};
const fixture = path.join(root, "fixture.mp4");
const video = "color=c=red:s=320x180:r=30:d=8[r];color=c=green:s=320x180:r=30:d=8[g];color=c=blue:s=320x180:r=30:d=8[b];color=c=yellow:s=320x180:r=30:d=8[y];[r][g][b][y]concat=n=4:v=1:a=0";
const audio = "aevalsrc=0.3*sin(2*PI*if(lt(t\\,8)\\,440\\,if(lt(t\\,16)\\,660\\,if(lt(t\\,24)\\,880\\,1100)))*t):s=48000:d=32";
run("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", video, "-f", "lavfi", "-i", audio, "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", fixture]);
const env = { ...runtimeEnvironment(runtime), MEDIA_WORKER_DATA_DIR: dataRoot, MEDIA_WORKER_PORT: String(port), MEDIA_WORKER_DISABLE_LEGACY: "1", FFMPEG_PATH: path.join(bin,"ffmpeg"), FFPROBE_PATH: path.join(bin,"ffprobe"), YT_DLP_PATH: path.join(bin,"yt-dlp"), FFMPEG_VIDEO_ENCODER: "libx264", FFMPEG_CRF: "18", FFMPEG_PRESET: "ultrafast", CHATGPT_KEYCHAIN_SERVICE: live ? "ShortCut Studio Dev ChatGPT" : `ShortCut Studio Dev Hook QA ${path.basename(root)}` };
const worker = spawn(process.execPath, [path.join(project,"worker/server.mjs")], { cwd: project, env, stdio:["ignore","pipe","pipe"] });
let logs = ""; worker.stdout.on("data", c => { logs += c; }); worker.stderr.on("data", c => { logs += c; });
const delay = ms => new Promise(r => setTimeout(r,ms));
async function call(route, body) {
  const r = await fetch(api+route, { method: body ? "POST" : "GET", headers:body ? {"Content-Type":"application/json"}: {}, body:body?JSON.stringify(body):undefined });
  const data=await r.json(); assert.ok(r.ok, `${r.status}: ${data.error}`);return data;
}
async function done(id) {
  for(let n=0;n<1000;n++) { const {job}=await call(`/api/jobs/${id}`);assert.notEqual(job.state,"error",`${job.error}\n${logs}`); if(job.state==="done")return job; await delay(200); }
  throw new Error("Hook render timed out");
}
const colors = ["red","green","blue","yellow"];
const expectedColor = time => colors[Math.min(3, Math.floor(time/8))];
function frame(media,time) {
  const b=run("ffmpeg",["-v","error","-ss",String(time),"-i",media,"-frames:v","1","-vf","crop=20:20:530:900,scale=1:1","-f","rawvideo","-pix_fmt","rgb24","-"]);
  return [...b.subarray(0,3)];
}
function classify([r,g,b]) { if(r>80&&g>80&&b<40)return "yellow";return ["red","green","blue"][[r,g,b].indexOf(Math.max(r,g,b))]; }
function audioCheck(media, time, frequency) {
  const b=run("ffmpeg",["-v","error","-ss",String(time),"-i",media,"-t","0.12","-vn","-ac","1","-ar","48000","-f","s16le","-"]);
  const samples=Array.from({length:b.length/2},(_,i)=>b.readInt16LE(i*2)/32768);
  assert.ok(samples.length>4000);
  const power=f=>{let re=0,im=0; for(let i=0;i<samples.length;i++){re+=samples[i]*Math.cos(2*Math.PI*f*i/48000); im+=samples[i]*Math.sin(2*Math.PI*f*i/48000);}return re*re+im*im;};
  assert.ok(power(frequency)>Math.max(...[440,660,880,1100].filter(f=>f!==frequency).map(power))*8,"Pitch/scene order must match the source excerpt");
  assert.ok(samples.reduce((s,x)=>s+x*x,0)/samples.length>0.001,"Audio tail must not be truncated/silent");
}
try {
  for(let i=0;i<100;i++){try{assert.equal((await call("/health")).dataRoot,dataRoot);break;}catch{assert.equal(worker.exitCode,null,logs);assert.ok(i<99);await delay(200);}}
  const response=await fetch(api+"/api/sources/upload?filename=HookFixture.mp4",{method:"POST",body:await readFile(fixture)});
  assert.equal(response.status,201);const {source}=await response.json();
  const cues=[{start:8,end:10,text:"The green result."},{start:24,end:26,text:"The yellow result."}];
  const plan={providerUsed:"manual",originalTitle:"Color tutorial",parts:[{id:1,title:"Red setup to green result",segments:[{start:0,end:2},{start:8,end:16}]},{id:2,title:"Blue setup to yellow result",segments:[{start:16,end:18},{start:24,end:32}]}].map(p=>({...p,startTrimApplied:true,smartCutApplied:true,hashtags:[]})),captionCues:{sourceId:source.id,sourceDuration:source.duration,timeline:"source",origin:"fixed-fixture",cues},visualStyle:{version:1,subtitle:{enabled:true,source:"whisper"},titleAnimation:"fade-in",cutTransition:"none"}};
  const before=structuredClone(plan.parts);
  const selected=(await call(`/api/sources/${source.id}/teaser-hooks`,{plan})).plan;
  const outcome={liveRequested:live,aiVerified:selected.parts.every(p=>p.teaser.selection==="ai"),selections:selected.parts.map(p=>({part:p.id,...p.teaser})),models:[...new Set(selected.parts.map(p=>p.teaser.model))]};
  await writeFile(path.join(root,"provider-outcome.json"),JSON.stringify(outcome,null,2));
  if(live) assert.ok(outcome.aiVerified,"LIVE AI VERIFICATION BLOCKED: see sanitized provider-outcome.json; fallbacks do not qualify AI.");
  else assert.ok(selected.parts.every(p=>p.teaser.selection==="fallback"));
  assert.deepEqual(selected.parts.map(p=>p.segments),before.map(p=>p.segments));
  const fractional = structuredClone(selected);
  for (const part of fractional.parts) {
    part.segments[1].start += 0.04;
    part.teaser = fallbackTeaser(part, "Explicit fractional-timestamp regression, not AI selection.", cues);
  }
  // Resolve the changed inputs before snapshot assertions; an all-zero placeholder
  // intentionally causes the renderer to select again, rather than being final.
  const fractionalSelected = (await call(`/api/sources/${source.id}/teaser-hooks`, { plan: fractional })).plan;
  const cases = [["legacy",plan],["hooks-none",selected],["hooks-flash",{...selected,visualStyle:{...selected.visualStyle,cutTransition:"flash-white"}}],["hooks-fractional",fractionalSelected]];
  const results=[];
  for(const [name,input] of process.argv.includes("--fractional-only") ? cases.slice(-1) : cases) {
    const expected=structuredClone(input.parts);
    const {job}=await call("/api/render",{sourceId:source.id,plan:input});
    input.parts=structuredClone(input.parts); input.parts[0].title="Caller mutated after queueing";
    const result=await done(job.id);
    assert.deepEqual(result.plan.parts,expected,"Queued snapshots include independent hooks and main content");
    for(const output of result.outputs) {
      const part=result.plan.parts[output.part-1],segments=presentationSegments(part),hasHook=Boolean(part.teaser),duration=segments.reduce((sum,segment)=>sum+segment.end-segment.start,0)/1.25;
      const media=path.join(dataRoot,"sources",output.url.slice("/files/".length));
      const probe=JSON.parse(run("ffprobe",["-v","error","-show_streams","-show_format","-of","json",media]));
      const v=probe.streams.find(s=>s.codec_type==="video");assert.deepEqual([v.width,v.height],[1080,1920]);
      assert.ok(Math.abs(Number(probe.format.duration)-duration)<0.06);assert.equal(Number(v.nb_frames),Math.round(duration*30));
      const pcm=run("ffmpeg",["-v","error","-i",media,"-map","0:a","-ac","1","-ar","48000","-f","s16le","-"]);
      const samples=pcm.length/2,target=Math.round(duration*48000);
      assert.ok(Math.abs(samples-target)<=1024,"Complete decoded audio tail must be retained within one AAC frame");
      const end=Math.min(samples,target);let tailEnergy=0;
      for(let i=end-1024;i<end;i++)tailEnergy+=(pcm.readInt16LE(i*2)/32768)**2;
      assert.ok(tailEnergy/1024>0.001,"Audio remains present through the intended EOF");
      const hookSeconds=hasHook?(part.teaser.end-part.teaser.start)/1.25:0;
      for(const t of [...(hasHook?[0.5,hookSeconds-0.5]:[]),hookSeconds+0.5,hookSeconds+2.3,duration-0.3]) {
        const mapped=locateTimelineTime(segments,t).sourceTime,color=expectedColor(mapped);
        assert.equal(classify(frame(media,t)),color,`${name} part${part.id} at${t} -> source${mapped}`);
        audioCheck(media,t,{red:440,green:660,blue:880,yellow:1100}[color]);
      }
      if(hasHook) {
        const rgb=frame(media,hookSeconds);assert.ok(rgb.every(x=>name==="hooks-flash"?x>235:x<20),"Hook boundary must reach its transition color");
        if(!live) {
          const captions=partCaptions(cues,part,result.plan.visualStyle.subtitle);
          assert.equal(captions.length,2,"Same source cue appears in teaser and original occurrence");
          assert.ok(captions[1].start>part.teaser.end-part.teaser.start);
          const concat=await readFile(path.join(path.dirname(media),"subtitles.ffconcat"),"utf8");
          assert.ok((concat.match(/subtitle-\d+\.png/g)||[]).length>=2);
          const whites=t=>{const b=run("ffmpeg",["-v","error","-ss",String(t),"-i",media,"-frames:v","1","-vf","crop=600:150:240:930","-f","rawvideo","-pix_fmt","rgb24","-"]);let n=0;for(let i=0;i<b.length;i+=3)if(b[i]>220&&b[i+1]>220&&b[i+2]>220)n++;return n;};
          assert.ok(whites(0.8)>500&&whites(hookSeconds+2.3)>500&&whites(hookSeconds+0.6)<50,"Decoded subtitles repeat at both source occurrences only");
        }
      }
      results.push({name,part:part.id,media,duration:probe.format.duration,frames:v.nb_frames,hook:part.teaser});
    }
    console.log(`PASS ${name}: two parts, scene/audio order, captions, duration and snapshots`);
  }
  await writeFile(path.join(root,"result.json"),JSON.stringify({ok:true,aiVerified:outcome.aiVerified,results},null,2));
  console.log(`PASS small hook integration: ${root}`);
}finally{
  if(worker.exitCode===null){const exit=once(worker,"exit");worker.kill("SIGTERM");await exit;}
  await writeFile(path.join(root,"worker.log"),logs);
}
