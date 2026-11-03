// Small isolated component fixture; no installed app, server, real storage or media.
import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const out = path.resolve(".isolation-verification/draft-status-ui");
await mkdir(out, { recursive: true });
const source = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{StudioRenderStatus}from'./components/studio-render-status';import{PreservedDrafts}from'./components/preserved-drafts';import{ConfirmationProvider,useConfirm}from'./components/confirmation-provider';function Fixture(){const confirm=useConfirm(),[drafts,setDrafts]=useState([{key:'a',label:'Nháp A'},{key:'b',label:'Nháp B'}]);return <><PreservedDrafts drafts={drafts} onOpen={async k=>{window.openedDraft=k;}} onDelete={async k=>{if(await confirm({title:'Xóa bản nháp?',message:'Xóa đúng bản đã chọn',confirmLabel:'Xóa bản nháp'})==='confirm')setDrafts(d=>d.filter(x=>x.key!==k));}}/><div id="preview">Preview fixture</div><footer className="studio-statusbar"><StudioRenderStatus job={null} submitting={false} canRender={false} hasPlan={false} blockedReason="" validation="" issues={[{partId:1,reason:'Thiếu teaser. Chọn lại bằng AI hoặc nhập mốc nguồn. '.repeat(20)}]} stopping={false} worker="" onRender={()=>{}} onCancel={()=>{}} onPart={()=>{}} busy={false}/></footer></>;}createRoot(document.getElementById('root')).render(<ConfirmationProvider><Fixture/></ConfirmationProvider>);`;
const b = await build({
  stdin: { contents: source, loader: "tsx", resolveDir: process.cwd() },
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
});
const css = (await readFile("app/globals.css", "utf8")).split("/* Status details float above")[1];
const browser = await chromium.launch({ channel: "chrome", headless: true });
let errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/fixture.js")
      ? r.fulfill({ contentType: "text/javascript", body: b.outputFiles[0].text })
      : r.fulfill({
          contentType: "text/html",
          body: `<style>:root{--panel:#211e1a;--foreground:#f4f0ea;--border:#555}body{margin:0;font:14px sans-serif}footer{position:fixed;bottom:0;display:flex;align-items:center;gap:8px;width:100%}#preview{height:300px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}/* Status details float above${css}</style><div id="root"></div><script type="module" src="/fixture.js"></script>`,
        }),
  );
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5373/fixture");
  const metrics = () =>
    page
      .locator("footer")
      .evaluate((n) => ({ height: n.getBoundingClientRect().height, top: n.getBoundingClientRect().top }));
  const before = await metrics();
  await page.getByRole("button", { name: "Chưa có bản cắt", exact: true }).click();
  await page.getByRole("dialog", { name: "Chưa có bản cắt" }).waitFor();
  assert.deepEqual(await metrics(), before);
  await page.screenshot({ path: path.join(out, "status-open-390.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.deepEqual(await metrics(), before);
  assert.equal(
    await page
      .getByRole("button", { name: "Chưa có bản cắt", exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await page.locator("summary").click();
  await page.getByRole("button", { name: "Xóa bản nháp Nháp A", exact: true }).click();
  await page.getByRole("alertdialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Xóa bản nháp Nháp A" }).count(), 1);
  await page.getByRole("button", { name: "Xóa bản nháp Nháp A" }).click();
  await page.getByRole("button", { name: "Xóa bản nháp", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Xóa bản nháp Nháp A" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Xóa bản nháp Nháp B" }).count(), 1);
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, "result.json"),
    JSON.stringify(
      {
        before,
        after: await metrics(),
        errors,
        checks: [
          "popover does not resize footer",
          "Escape returns focus",
          "delete cancel keeps row",
          "confirm deletes selected row only",
        ],
      },
      null,
      2,
    ),
  );
  console.log("PASS: fixed footer geometry and draft delete interaction");
} finally {
  await browser.close();
}
