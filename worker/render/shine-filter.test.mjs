import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { overlaySourceFilter, shineSweepFilters } from "./shine-filter.mjs";

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const probe = spawnSync(ffmpeg, ["-version"], { encoding: "utf8" });
const skip = probe.error?.code === "ENOENT" ? "ffmpeg not installed (set FFMPEG_PATH)" : false;

test("shine sweep builds the ramp once and never evaluates geq per frame", () => {
  const filters = shineSweepFilters({ input: 3, x: "(1080-160)*mod(t,5)/5", staticInputFilter: "loop=loop=-1:size=1:start=0,setpts=N/(30*TB)," });
  const graph = filters.join(";");
  assert.match(graph, /^\[3:v\]loop=loop=-1:size=1:start=0,setpts=N\/\(30\*TB\),format=rgba,crop=160:1920:x='\(1080-160\)\*mod\(t,5\)\/5':y=0,split/);
  assert.match(graph, /geq=lum='255\*max\(0,1-abs\(X-80\)\/80\)',trim=end_frame=1,loop=loop=-1:size=1:start=0/);
  assert.ok(!/geq=r=|geq=a=/.test(graph));
  assert.match(graph, /blend=all_mode=multiply:shortest=1\[shineMask\]/);
  assert.ok(graph.endsWith("alphamerge,format=rgba[shine]"));
  assert.equal(filters.filter((f) => f.includes("[shine]")).length, 1);
});

test("static overlays convert once before looping on the YUV path and keep RGBA for RGB overlays", () => {
  const loop = "loop=loop=-1:size=1:start=0,setpts=N/(30*TB),";
  assert.equal(overlaySourceFilter({ input: 2, label: "titlecard", rgb: false, loop }), "[2:v]format=yuva420p,loop=loop=-1:size=1:start=0,setpts=N/(30*TB)[titlecard]");
  assert.equal(overlaySourceFilter({ input: 2, label: "titlecard", rgb: true, loop }), "[2:v]loop=loop=-1:size=1:start=0,setpts=N/(30*TB),format=rgba[titlecard]");
  assert.equal(overlaySourceFilter({ input: 5, label: "staticScene", rgb: false }), "[5:v]format=yuva420p,null[staticScene]");
});

test("new shine chain stays within one alpha level of the legacy geq on real pixels", { skip }, () => {
  const source = "color=c=0xFF8800@0.9:s=1080x1920:r=30,format=rgba";
  const crop = "crop=160:1920:x='(1080-160)*mod(t,5)/5':y=0";
  const legacy = `[0:v]${crop},geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*max(0,1-abs(X-80)/80)'[a]`;
  const next = `[1:v]${crop},split[shineColor][shineAlpha];[shineAlpha]alphaextract[shineAlphaPlane];color=c=white:s=160x1920:r=30,format=gray,geq=lum='255*max(0,1-abs(X-80)/80)',trim=end_frame=1,loop=loop=-1:size=1:start=0,setpts=N/(30*TB)[shineRamp];[shineAlphaPlane][shineRamp]blend=all_mode=multiply:shortest=1[shineMask];[shineColor][shineMask]alphamerge,format=rgba[b]`;
  const result = spawnSync(ffmpeg, ["-hide_banner", "-nostdin", "-f", "lavfi", "-i", source, "-f", "lavfi", "-i", source, "-filter_complex", `${legacy};${next};[a][b]blend=all_mode=difference,format=rgba,alphaextract,signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=-`, "-t", "2", "-f", "null", "-"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr.slice(-300));
  const peaks = [...result.stdout.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(peaks.length > 10);
  assert.ok(Math.max(...peaks) <= 2, `alpha difference peaked at ${Math.max(...peaks)}`);
});
