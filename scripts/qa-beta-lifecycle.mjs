// Production React music/lease hooks, fake audio promises and intercepted HTTP only.
import { createEditorSourceLeases } from "../worker/editor-source-leases.mjs";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.QA_PLAYWRIGHT_MODULE || "/private/tmp/marketing-slide-tools/node_modules/playwright/index.mjs"
);
const out = path.resolve(".isolation-verification/work-order-complete/lifecycle");
await mkdir(out, { recursive: true });
const entry = `import React,{useState,useRef}from'react';import{createRoot}from'react-dom/client';import{MusicPanel}from'./components/music-panel';import{useEditorSourceLease}from'./components/use-editor-source-lease';import{mockPlan}from'./lib/edit-plan';
const plan=mockPlan({provider:'mock',transcript:'',originalTitle:'Synthetic'});function Live({source,suspended}){const video=useRef(document.createElement('video'));useEditorSourceLease('http://127.0.0.1:8987',source==='A'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',true);return <MusicPanel suspended={suspended} autoPrepare={false} previewReady={true} plan={plan} worker="http://127.0.0.1:8987" settings={{version:1,enabled:true,volume:20,ducking:false,assetId:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}} source={{id:source,duration:100}} part={plan.parts[0]} duration={100} time={0} playing={false} video={video} onChange={()=>{}} onSpeech={()=>{}} onAudition={()=>{}}/>;}function App(){const[source,setSource]=useState('A'),[suspended,setSuspended]=useState(false),[mounted,setMounted]=useState(true);return <><button onClick={()=>setSource(s=>s==='A'?'B':'A')}>Source</button><button onClick={()=>setSuspended(v=>!v)}>Suspend</button><button onClick={()=>setMounted(false)}>Unmount</button>{mounted&&<Live source={source} suspended={suspended}/>}</>;}createRoot(document.getElementById('root')).render(<App/>);`;
const bundle = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() },
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
const requests = [],
  errors = [],
  leaseState = createEditorSourceLeases();
try {
  const c = await browser.newContext();
  await c.route("**/*", async (r) => {
    const q = r.request(),
      u = new URL(q.url());
    if (u.pathname === "/fixture")
      return r.fulfill({
        contentType: "text/html",
        body: '<div id="root"></div><script type="module" src="/fixture.js"></script>',
      });
    if (u.pathname === "/fixture.js")
      return r.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text });
    if (q.method() === "OPTIONS")
      return r.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST,GET",
        },
      });
    requests.push({ path: u.pathname, body: q.postData() ? JSON.parse(q.postData()) : null });
    return r.fulfill({
      json:
        u.pathname === "/api/editor/source-lease"
          ? leaseState.retain(JSON.parse(q.postData()))
          : {
              assets: [
                {
                  id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  title: "Synthetic music",
                  duration: 100,
                  durationLoop: 100,
                  contentHash: "fixture",
                },
              ],
            },
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  const p = await c.newPage();
  p.setDefaultTimeout(10000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() => {
    window.audioFixtures = [];
    HTMLMediaElement.prototype.play = function () {
      window.audioFixtures.push(this);
      return new Promise((resolve) => (this.finishFixture = resolve));
    };
    HTMLMediaElement.prototype.pause = function () {
      this.fixturePaused = true;
    };
    HTMLMediaElement.prototype.load = function () {
      this.fixtureLoaded = true;
    };
  });
  await p.goto("http://127.0.0.1:5373/fixture");
  await p.locator("summary").filter({ hasText: "Nhạc nền" }).click();
  await p
    .getByRole("button", { name: "Nghe thử nhạc", exact: true })
    .waitFor()
    .catch(async (e) => {
      await writeFile(
        path.join(out, "failure.json"),
        JSON.stringify({ errors, requests, body: await p.locator("body").innerText() }, null, 2),
      );
      throw e;
    });
  await p.getByRole("button", { name: "Nghe thử nhạc", exact: true }).click();
  await p.waitForFunction(() => window.audioFixtures.length === 1);
  await p.getByRole("button", { name: "Suspend", exact: true }).click();
  await p.evaluate(() => window.audioFixtures[0].finishFixture());
  assert.equal(
    await p.evaluate(() => {
      const a = window.audioFixtures[0];
      return a.fixturePaused && !a.getAttribute("src") && a.fixtureLoaded;
    }),
    true,
    "Suspension releases even a pending audition",
  );
  await p.getByRole("button", { name: "Source", exact: true }).click();
  await p.waitForFunction(() => true);
  await p.getByRole("button", { name: "Suspend", exact: true }).click();
  await p.getByRole("button", { name: "Nghe thử nhạc", exact: true }).click();
  await p.waitForFunction(() => window.audioFixtures.length === 2);
  await p.getByRole("button", { name: "Unmount", exact: true }).click();
  await p.evaluate(() => window.audioFixtures[1].finishFixture());
  assert.equal(
    await p.evaluate(() => window.audioFixtures[1].fixturePaused && !window.audioFixtures[1].getAttribute("src")),
    true,
  );
  await p.waitForTimeout(100);
  const leases = requests.filter((r) => r.path === "/api/editor/source-lease").map((r) => r.body);
  assert.ok(leases.some((r) => r.sourceId === "11111111-1111-4111-8111-111111111111"));
  assert.ok(leases.some((r) => r.sourceId === "22222222-2222-4222-8222-222222222222"));
  assert.equal(new Set(leases.map((r) => r.ownerId)).size, 1);
  const ordered = [...leases].sort((a, b) => a.revision - b.revision);
  assert.equal(new Set(leases.map((r) => r.revision)).size, leases.length);
  assert.equal(ordered.at(-1).sourceId, null);
  assert.equal(leaseState.has("11111111-1111-4111-8111-111111111111"), false);
  assert.equal(leaseState.has("22222222-2222-4222-8222-222222222222"), false);
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, "result.json"),
    JSON.stringify(
      {
        requests,
        errors,
        checks: [
          "pending audition suspended/released",
          "unmount releases pending audio",
          "lease A to B and final release, same owner increasing revision",
        ],
        scope: "synthetic component integration",
      },
      null,
      2,
    ),
  );
  console.log("PASS: music lifecycle and source lease ownership");
} finally {
  await browser.close();
}
