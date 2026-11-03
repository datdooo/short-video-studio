// Small isolated component fixture; no installed app, worker, real storage or media.
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const out = path.resolve(".isolation-verification/draft-status-ui-1127");
await mkdir(out, { recursive: true });
const source = `
import React,{useState}from'react';
import{createRoot}from'react-dom/client';
import{StudioHeader}from'./components/studio-header';
import{StudioRenderStatus}from'./components/studio-render-status';
import{PreservedDrafts}from'./components/preserved-drafts';
import{ConfirmationProvider,useConfirm}from'./components/confirmation-provider';
function Fixture(){
 const confirm=useConfirm(),[drafts,setDrafts]=useState([{key:'a',label:'Nháp A'},{key:'b',label:'Nháp B'},{key:'long',label:'Bản nháp video có tiêu đề rất dài 日本語 한국어 Tiếng Việt '.repeat(8)}]);
 return <main className="prototype-shell">
 <StudioHeader workspace="editor" onWorkspace={v=>window.workspace=v} workerReady={true} providerReady={true} providerLabel="ChatGPT · web" saveState="dirty" saveMessage="" onSave={()=>window.saved=true} saveBlocked={false} onNewSession={()=>window.created=true} ready={true}
 drafts={<PreservedDrafts drafts={drafts} onOpen={async k=>{window.openedDraft=k;}} onDelete={async k=>{if(await confirm({title:'Xóa bản nháp?',message:'Xóa đúng bản đã chọn',confirmLabel:'Xóa bản nháp'})==='confirm')setDrafts(d=>d.filter(x=>x.key!==k));}}/>}/>
 <div id="preview" style={{flex:1}}>Preview fixture</div>
 <footer className="studio-statusbar"><StudioRenderStatus job={null} submitting={false} canRender={false} hasPlan={false} blockedReason="" validation="" issues={[{partId:1,reason:'Thiếu teaser. Chọn lại bằng AI hoặc nhập mốc nguồn. '.repeat(20)}]} stopping={false} worker="" onRender={()=>{}} onCancel={()=>{}} onPart={()=>{}} busy={false}/></footer>
 </main>;
}
createRoot(document.getElementById('root')).render(<ConfirmationProvider><Fixture/></ConfirmationProvider>);`;
const b = await build({
  stdin: { contents: source, loader: "tsx", resolveDir: process.cwd() },
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "fixture-image",
      setup(build) {
        build.onResolve({ filter: /^next\/image$/ }, () => ({ path: "next/image", namespace: "fixture" }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents:
            'import React from "react";export default function Image({unoptimized,...props}){return React.createElement("img",props)}',
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const css = (
  await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), {
    from: path.resolve("app/globals.css"),
  })
).css;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  measurements = [];
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(7000);
  await page.route("**/*", (r) => {
    const url = new URL(r.request().url());
    if (url.pathname === "/fixture.js")
      return r.fulfill({ contentType: "text/javascript", body: b.outputFiles[0].text });
    if (url.pathname === "/fixture.css") return r.fulfill({ contentType: "text/css", body: css });
    if (url.pathname === "/fixture")
      return r.fulfill({
        contentType: "text/html",
        body: '<link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script>',
      });
    if (url.pathname === "/favicon.svg")
      return readFile("public/favicon.svg", "utf8").then((body) => r.fulfill({ contentType: "image/svg+xml", body }));
    return r.abort();
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const metrics = () =>
    page.locator("header").evaluate((n) => ({
      height: n.getBoundingClientRect().height,
      preview: document.getElementById("preview").getBoundingClientRect().top,
    }));
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("http://127.0.0.1:5373/fixture");
    const trigger = page.getByRole("button", { name: "Bản nháp đã giữ (3)", exact: true });
    await trigger.waitFor();
    assert.equal(await page.locator("header").getByRole("button", { name: "Bản nháp đã giữ (3)" }).count(), 1);
    const order = await page
      .locator(".studio-header-status > *")
      .evaluateAll((nodes) => nodes.map((n) => n.textContent));
    assert.deepEqual(order, ["Worker sẵn sàng", "ChatGPT · web", "Bản nháp3", "Lưu", "Phiên mới", "?"]);
    const before = await metrics();
    await trigger.click();
    const panel = page.getByRole("dialog", { name: "Bản nháp đã giữ", exact: true });
    await panel.waitFor();
    await panel.evaluate((n) => Promise.all(n.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));
    assert.deepEqual(await metrics(), before);
    const bounds = await panel.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.height >= 60);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: path.join(out, `drafts-${width}.png`) });
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    assert.equal(await trigger.evaluate((n) => n === document.activeElement), true);
    measurements.push({ width, before, after: await metrics() });
  }
  const trigger = () => page.getByRole("button", { name: /^Bản nháp đã giữ \(/ });
  await trigger().click();
  await page.getByRole("button", { name: "Xóa bản nháp Nháp A", exact: true }).click();
  await page.getByRole("alertdialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("button", { name: "Xóa bản nháp Nháp A", exact: true }).count(), 1);
  await page.getByRole("button", { name: "Xóa bản nháp Nháp A", exact: true }).click();
  await page.getByRole("button", { name: "Xóa bản nháp", exact: true }).click();
  await page.getByRole("button", { name: "Bản nháp đã giữ (2)", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Xóa bản nháp Nháp A", exact: true }).count(), 0);
  const row = page.locator(".studio-preserved-drafts li").filter({ hasText: "Nháp B" });
  await row.getByRole("button", { name: "Mở", exact: true }).click();
  await page.getByRole("dialog", { name: "Bản nháp đã giữ", exact: true }).waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.openedDraft), "b");
  await page.getByRole("button", { name: "Lưu phiên chỉnh sửa", exact: true }).click();
  assert.equal(await page.evaluate(() => window.saved), true);
  // Clear the two remaining synthetic copies and verify empty-state access.
  for (const name of ["Xóa bản nháp Nháp B", /^Xóa bản nháp Bản nháp video/]) {
    await trigger().click();
    await page.getByRole("button", { name, exact: typeof name === "string" }).click();
    await page.getByRole("button", { name: "Xóa bản nháp", exact: true }).click();
    await page.getByRole("alertdialog").waitFor({ state: "hidden" });
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Bản nháp đã giữ (0)", exact: true }).click();
  await page.getByText("Chưa có bản nháp đã giữ.", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  const footer = () =>
    page
      .locator("footer")
      .evaluate((n) => ({ height: n.getBoundingClientRect().height, top: n.getBoundingClientRect().top }));
  const before = await footer();
  await page.getByRole("button", { name: "Chưa có bản cắt", exact: true }).click();
  await page.getByRole("dialog", { name: "Chưa có bản cắt" }).waitFor();
  assert.deepEqual(await footer(), before);
  await page.keyboard.press("Escape");
  assert.deepEqual(await footer(), before);
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, "result.json"),
    JSON.stringify(
      {
        measurements,
        errors,
        checks: [
          "header button order",
          "no overflow at 1440/1024/390",
          "draft popover leaves header/preview geometry unchanged",
          "Escape returns focus",
          "cancel/delete/open target correct copy",
          "save handler preserved",
          "empty list accessible",
          "footer popover remains stable",
        ],
      },
      null,
      2,
    ),
  );
  console.log("PASS: header drafts, actions, narrow layout and stable status popovers");
} finally {
  await browser.close();
}
