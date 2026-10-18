// Evaluate the actual trusted source/packaged worker render functions without
// starting its HTTP server. This is render evidence, not an HTTP/browser smoke.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const project = path.resolve(import.meta.dirname, "..");
const staged = process.argv.includes("--staged");
const packaged = process.argv.includes("--packaged") || staged;
const baseline = process.argv.includes("--baseline");
const resources = staged ? path.resolve(process.argv[process.argv.indexOf("--staged") + 1]) : path.join(project, "release/dev/ShortCut Studio Dev.app/Contents/Resources");
if (staged) assert.ok(resources.startsWith(path.join(project, "release/dev/.build-")) && resources.endsWith("/ShortCut Studio Dev.app/Contents/Resources"), "Only an in-worktree DEV package stage is accepted");
await mkdir(path.join(project, ".isolation-verification"), { recursive: true });
const root = await mkdtemp(path.join(project, `.isolation-verification/animation-offline-${baseline ? "baseline" : staged ? "staged" : packaged ? "package" : "source"}-`));
function runSync(binary, args, options = {}) {
  const result = spawnSync(binary, args, { maxBuffer: 256 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, result.error?.message || result.stderr?.toString()); return result.stdout;
}
let app = packaged ? path.join(resources, "app") : project;
if (baseline) {
  assert.ok(!packaged);
  app = path.join(root, "baseline"); await mkdir(app);
  const archive = runSync("git", ["archive", "7abe5f23fded5bcd195907d00f606d5524fa40ad", "worker", "lib", "public"]);
  runSync("/usr/bin/tar", ["-xf", "-", "-C", app], { input: archive });
}
const ffmpeg = packaged ? path.join(resources, "runtime/bin/ffmpeg") : "/opt/homebrew/bin/ffmpeg";
const ffprobe = packaged ? path.join(resources, "runtime/bin/ffprobe") : "/opt/homebrew/bin/ffprobe";
const xml = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
process.env.FONTCONFIG_FILE = path.join(root, "fonts.xml");
await writeFile(process.env.FONTCONFIG_FILE, `<fontconfig><dir>${xml(path.join(app, "public"))}</dir><cachedir>${xml(path.join(root, "font-cache"))}</cachedir></fontconfig>`);
const sharp = createRequire(path.join(baseline ? project : app, "package.json"))("sharp");
const load = (file) => import(pathToFileURL(path.join(app, file)).href);
const { listFonts, fontFamilyForStyle, fontFallbackStack } = await load("lib/visual-style/fonts.mjs");
const { styledTextSvg } = await load("lib/visual-style/text-render.mjs");
const { constrainTitlePair, needsMeasuredTitleFit } = await load("lib/visual-style/title-fit.mjs");
const { DEFAULT_VISUAL_STYLE } = await load("lib/visual-style/defaults.mjs");
const config = await load("lib/render-config.mjs");
const subtitles = await load("lib/subtitles.mjs");
const backgrounds = await load("lib/visual-style/backgrounds.mjs");
const filters = await load("lib/visual-style/filters.mjs");
const { applyVisualTemplate } = await load("lib/visual-style/templates.mjs");
const { normalizeVisualStyle } = await load("lib/visual-style/normalize.mjs");
const { renderSceneOverlay } = await load("worker/scene-overlays.mjs");
const animation = baseline ? {} : { ...await load("worker/title-animation.mjs"), ...await load("lib/visual-style/animations.mjs"), ...await load("worker/cut-transition.mjs") };
const worker = await readFile(path.join(app, "worker/server.mjs"), "utf8");
const definitions = worker.slice(worker.indexOf("function fontFamilyFor("), worker.indexOf("async function loadSource("))
  + worker.slice(worker.indexOf("async function renderTitleOverlay("), worker.indexOf("function exportPrefixFor("));
let lastArgs;
const renderPart = vm.runInNewContext(`${definitions}\nrenderPart`, {
  sharp, path, Buffer, projectRoot: app, process: { env: { FFMPEG_PRESET: "ultrafast", FFMPEG_CRF: "18" } },
  listFonts, fontFamilyForStyle, styledTextSvg, constrainTitlePair, needsMeasuredTitleFit,
  DEFAULT_VISUAL_STYLE, ...config, ...subtitles, ...backgrounds, ...filters, ...animation,
  ffmpegFilterExpression: (value, current) => filters.ffmpegFilterExpression(value, JSON.parse(JSON.stringify(current))),
  ffmpeg, preferredVideoEncoder: "libx264", hardwareDecodeCodecs: new Set(), renderContrast: 1.04, renderSaturation: 1.06, writeFile,
  run: async (binary, args, options) => {
    lastArgs = args;
    await new Promise((resolve, reject) => {
      const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      child.stdout.on("data", (c) => options.onStdout?.(c.toString()));
      child.stderr.on("data", (c) => { stderr = (stderr + c).slice(-10000); });
      child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(stderr)));
    });
  },
});
const fixture = path.join(root, "fixture.mp4");
runSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=960x540:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "4", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", fixture]);
const silentFixture = path.join(root, "silent-fixture.mp4");
runSync(ffmpeg, ["-v", "error", "-i", fixture, "-c:v", "copy", "-an", silentFixture]);
const hash = (b) => createHash("sha256").update(b).digest("hex");
const animations = baseline ? ["none"] : ["none", "fade-in", "slide-up", "pop-in"];
const cases = [
  ...animations.map((animation) => ({ id: animation, animation, template: "current", text: "Sweet tomatoes トマト 토마토" })),
  ...animations.map((animation) => ({ id: `scene-${animation}`, animation, template: "cinematic-dark", text: "TITLE ANIMATION", measurement: true })),
  ...(!baseline ? [
    { id: "silent-news-pop", animation: "pop-in", template: "news", text: "Silent news 日本語 한국어", silent: true },
    { id: "jp-pop", animation: "pop-in", template: "farming-jp", text: "トマトを甘く育てる方法" },
    { id: "kr-slide", animation: "slide-up", template: "korean-tutorial", text: "토마토를 맛있게 키우는 방법" },
  ] : []),
];
const coverage = {};
for (const font of listFonts().filter((f) => f.bundled)) {
  const file = path.join(app, "public", font.file);
  assert.equal(hash(await readFile(file)), hash(await readFile(path.join(project, "public", font.file))));
  const ranges = runSync("/opt/homebrew/bin/fc-scan", ["--format", "%{charset}\n", file]).toString().split("\n")[0].split(" ").map((r) => r.split("-").map((v) => parseInt(v,16)));
  coverage[font.family] = (c) => ranges.some(([a,b=a]) => c.codePointAt(0) >= a && c.codePointAt(0) <= b);
}
const results = [], cards = [];
for (const sample of cases) {
  let style = applyVisualTemplate(undefined, sample.template);
  if (sample.measurement) { style.background = backgrounds.getBackgroundPreset("black").background; style.overlays = applyVisualTemplate(undefined, "news").overlays; }
  if (sample.animation !== "none") style.titleAnimation = sample.animation;
  style.subtitle.enabled = true; style.subtitle.source = "youtube";
  style = normalizeVisualStyle(style);
  for (const c of sample.text.replace(/\s/g,"")) assert.ok(fontFallbackStack(style.originalTitle.font, sample.text).some((family) => coverage[family]?.(c)), `Missing glyph ${c}`);
  const directory = path.join(root, sample.id); await mkdir(directory);
  const sceneAsset = await renderSceneOverlay({ overlays: style.overlays, publicRoot: path.join(app, "public"), outputPath: path.join(directory, "scene.png") });
  let backgroundAsset;
  if (style.background.mode === "gradient") {
    backgroundAsset = path.join(directory, "background.png");
    const bytes = Buffer.alloc(1080 * 1920 * 3);
    for (let y=0; y<1920; y++) { const rgb = backgrounds.gradientRowRgb(style.background,y,1920); for (let x=0;x<1080;x++) for(let c=0;c<3;c++) bytes[(y*1080+x)*3+c]=rgb[c]; }
    await sharp(bytes,{raw:{width:1080,height:1920,channels:3}}).png().toFile(backgroundAsset);
  }
  const source = { id: "offline-synthetic", duration: 4, height: 540, hasAudio: !sample.silent, mediaPath: sample.silent ? silentFixture : fixture, videoCodec: "h264" };
  const plan = { originalTitle: sample.text, visualStyle: style, subtitles: style.subtitle, parts: [1,2].map((id) => ({ id, title: sample.text, segments: [{ start: (id-1)*2, end: (id-1)*2+0.75 }, { start: (id-1)*2+1, end:id*2 }] })), captionCues: { sourceId: source.id, sourceDuration:4, timeline:"source", cues: [{start:0,end:4,text:"Fixed caption 日本語 한국어"}] } };
  const outputs = [];
  for (const part of plan.parts) {
    const partRoot = path.join(directory, `part-${part.id}`); await mkdir(partRoot);
    const media = path.join(partRoot, "output.mp4");
    await renderPart({ source, plan, part, totalParts:2, outputPath:media, backgroundAsset, sceneAsset, onProgress:()=>{} });
    await writeFile(path.join(partRoot,"ffmpeg-args.json"),JSON.stringify(lastArgs,null,2));
    const info = JSON.parse(runSync(ffprobe,["-v","error","-show_entries","format=duration:stream=width,height,r_frame_rate,codec_type","-of","json",media]));
    const video = info.streams.find((s)=>s.codec_type==="video");
    assert.deepEqual([video.width,video.height,video.r_frame_rate],[1080,1920,"30/1"]);
    assert.ok(info.streams.some((s)=>s.codec_type==="audio")); assert.ok(Math.abs(Number(info.format.duration)-1.4)<0.06);
    const title = path.join(partRoot, `part-${part.id}-titles.png`);
    const titleHash = hash(await readFile(title));
    const subtitleHash = hash(await readFile(path.join(partRoot,"subtitle-0.png")));
    const measures=[];
    for (const time of [0,0.2,0.6,1]) {
      const frame=runSync(ffmpeg,["-v","error","-ss",String(time),"-i",media,"-frames:v","1","-f","image2pipe","-vcodec","png","-"]);
      await writeFile(path.join(partRoot,`${time}.png`),frame);
      const {data,info}=await sharp(frame).removeAlpha().raw().toBuffer({resolveWithObject:true});
      let sum=0,count=0,minX=1080,maxX=0,minY=1920,maxY=0;
      for(let y=120;y<280;y++)for(let x=90;x<990;x++){
        const at=(y*info.width+x)*3,v=Math.max(data[at],data[at+1],data[at+2]);sum+=v;
        if(v>25){count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      }
      const caption=await sharp(frame).extract({left:120,top:1170,width:840,height:130}).raw().toBuffer();
      measures.push({time,sum,count,bounds:[minX,minY,maxX,maxY],hash:hash(frame),captionHash:hash(caption)});
      if(part.id===1){
        const label=Buffer.from(`<svg width="270" height="34"><rect width="270" height="34" fill="#15171c"/><text x="6" y="23" fill="white" font-size="15">${sample.id} · ${time}s</text></svg>`);
        cards.push({input:await sharp(frame).resize(270,480).extend({bottom:34,background:"#15171c"}).composite([{input:label,top:480,left:0}]).png().toBuffer(),top:results.length*514,left:[0,0.2,0.6,1].indexOf(time)*270});
      }
    }
    if(sample.measurement){
      const [start,mid,settled,later]=measures;
      if(sample.animation!=="none"){
        assert.ok(start.sum<settled.sum*0.015, `${sample.id}: invisible entry ${start.sum/settled.sum}`);
        assert.ok(mid.sum>settled.sum*0.35&&mid.sum<settled.sum*0.48,`${sample.id}: mid opacity ${mid.sum/settled.sum}`);
      }
      assert.ok(Math.abs(settled.sum-later.sum)<settled.sum*0.02, `${sample.id}: settled luminance`);
      assert.deepEqual(settled.bounds,later.bounds);
      if(sample.animation==="slide-up")assert.ok(mid.bounds[1]-settled.bounds[1]>=10&&mid.bounds[1]-settled.bounds[1]<=14,`Expected 12px slide: ${JSON.stringify(measures)}`);
      if(sample.animation==="pop-in")assert.ok(mid.bounds[2]-mid.bounds[0]<settled.bounds[2]-settled.bounds[0],"Pop grows to full width");
    }
    const decoded = runSync(ffmpeg,["-v","error","-i",media,"-map","0:v","-f","framemd5","-"]).toString().split("\n").filter((l)=>l&&!l.startsWith("#"));
    outputs.push({part:part.id,media,titleHash,subtitleHash,measures,decoded});
  }
  results.push({id:sample.id,style,outputs});
  console.log(`PASS offline ${baseline?"Phase7":staged?"staged":packaged?"package":"source"} ${sample.id}: 2 parts, discontinuous cuts, 30fps/audio/1.4s, four sampled times`);
}
await sharp({create:{width:1080,height:results.length*514,channels:4,background:"#111111"}}).composite(cards).png().toFile(path.join(root,"contact-sheet.png"));
await writeFile(path.join(root,"result.json"),JSON.stringify({packaged,staged,baseline,fixture,results},null,2));
console.log(`PASS offline animation render set: ${root}`);
