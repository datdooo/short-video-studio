// Isolated browser/worker fixture; intercept every production-worker URL.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PLAYBACK_RATE, FOREGROUND_SCALE } from '../lib/render-config.mjs';
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || '/private/tmp/shortcut-transform-browser-qa/node_modules/playwright/index.mjs');
const root = await mkdtemp('/private/tmp/shortcut-editor-preview-');
const runtime = '/Applications/ShortCut Studio.app/Contents/Resources/runtime/bin';
const fixture = '/private/tmp/shortcut-transform-qa-ULZCbZ/source-wide.mp4';
const worker = spawn(path.join(runtime, 'node'), ['worker/server.mjs'], { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, NODE_ENV: 'production', MEDIA_WORKER_PORT: '8791', MEDIA_WORKER_DATA_DIR: root, MEDIA_WORKER_DISABLE_LEGACY: '1', FFMPEG_PATH: path.join(runtime, 'ffmpeg'), FFPROBE_PATH: path.join(runtime, 'ffprobe') }, stdio: ['ignore', 'pipe', 'pipe'] });
worker.stdout.resume(); worker.stderr.resume();
let browser;
let syntheticJobs = null;
const deletedRenderIds = [];
const errors = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  for (let index = 0; index < 80; index++) { try { if ((await fetch('http://127.0.0.1:8791/health')).ok) break; } catch {} await delay(100); }
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1550, height: 1000 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('http://127.0.0.1:8787/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/editor-renders' && syntheticJobs) return route.fulfill({ json: { jobs: syntheticJobs }, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (pathname.startsWith('/api/editor-renders/') && syntheticJobs && route.request().method() === 'DELETE') {
      const id = pathname.split('/').at(-1); deletedRenderIds.push(id); syntheticJobs = syntheticJobs.filter((job) => job.id !== id);
      return route.fulfill({ json: { removed: true, trashId: `qa-trash-${id}` }, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (pathname === '/api/chatgpt/session') return route.fulfill({ json: { session: { available: false, connected: false, sharing: false } }, headers: { 'Access-Control-Allow-Origin': '*' } });
    const response = await route.fetch({ url: route.request().url().replace(':8787', ':8791'), timeout: 90_000 });
    if (pathname === '/api/sources/upload') {
      const data = await response.json();
      const source = data.source;
      source.captions = [{ start: 1, end: 4, text: 'The engine needs a careful inspection.' }, { start: 23, end: 26, text: 'Well, the engine remains in good condition.' }, { start: 27, end: 31, text: 'The brakes were tested after 39000 kilometers.' }, { start: 73, end: 76, text: 'Well, the motor remains in good condition.' }, { start: 77, end: 81, text: 'The test is complete.' }];
      await writeFile(path.join(root, 'sources', source.id, 'source.json'), JSON.stringify(source));
      return route.fulfill({ response, json: data });
    }
    await route.fulfill({ response });
  });
  await page.goto(process.env.QA_EDITOR_URL || 'http://localhost:5174/');
  await page.getByText('Worker ready', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Original title', { exact: true }).inputValue(), '', 'No prefilled Audi demo title');
  assert.match(await page.locator('.portrait-preview .overlay-copy-block').first().innerText(), /YOUR\s+STORY\s+STARTS\s+HERE/);
  assert.match(await page.locator('.portrait-preview .overlay-copy-block').nth(1).innerText(), /THE\s+MOMENT\s+THAT\s+MATTERS/);
  await page.getByRole('tab', { name: 'Local video', exact: true }).click();
  const tabs = await page.getByRole('tab', { name: /^(YouTube|Local video)$/ }).evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(node); const text = range.getBoundingClientRect();
    return { height: rect.height, top: rect.top, bottom: rect.bottom, parentTop: parent.top, parentBottom: parent.bottom, textCenter: text.top + text.height / 2, center: rect.top + rect.height / 2 };
  }));
  assert.equal(tabs[0].height, tabs[1].height);
  for (const tab of tabs) { assert.ok(tab.top >= tab.parentTop && tab.bottom <= tab.parentBottom); assert.ok(Math.abs(tab.textCenter - tab.center) <= 2, 'Source-tab labels are vertically centered'); }
  await page.locator('input[type=file]').setInputFiles(fixture);
  await page.getByRole('button', { name: 'Chuẩn bị source để render', exact: true }).click();
  await page.getByRole('button', { name: 'Source đã sẵn sàng', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Manual cut', exact: true }).click();
  await page.getByLabel('Part 1 timestamp ranges').fill('0 - 50');
  await page.getByLabel('Part 2 timestamp ranges').fill('50 - 100');
  await page.getByRole('button', { name: 'Apply manual timestamps', exact: true }).click();
  const cutDetails = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Chi tiết bản cắt' }) });
  assert.equal(await cutDetails.evaluate((node) => node.open), false, 'Cut details default to collapsed');
  await cutDetails.locator('summary').click();
  assert.equal(await cutDetails.evaluate((node) => node.open), true);
  assert.ok(await cutDetails.getByText('Source-timestamp duration', { exact: true }).isVisible());
  await cutDetails.locator('summary').click();
  assert.equal(await cutDetails.evaluate((node) => node.open), false);
  await page.locator('summary').filter({ hasText: 'Auto Subtitle' }).click();
  await page.getByRole('checkbox', { name: 'Ghép phụ đề vào video xuất' }).check();
  assert.equal(await page.getByRole("checkbox", { name: "Transform Lite", exact: true }).count(), 0);
  const geometry = await page.locator('.native-preview-video').evaluate((video) => ({ width: video.getBoundingClientRect().width, frameHeight: video.parentElement.getBoundingClientRect().height, canvasWidth: video.closest('.portrait-preview').getBoundingClientRect().width, rate: video.playbackRate }));
  assert.ok(Math.abs(geometry.width - 1920 * FOREGROUND_SCALE * geometry.canvasWidth / 1080) < 2, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.frameHeight - 1350 * geometry.canvasWidth / 1080) < 2); assert.equal(geometry.rate, PLAYBACK_RATE);
  const checkTitles = async () => {
    const titles = await page.locator('.portrait-preview .overlay-copy-block').evaluateAll((nodes) => nodes.map((node) => ({ size: getComputedStyle(node).fontSize, rect: node.getBoundingClientRect().toJSON() })));
    const foreground = await page.locator('.native-preview-video').evaluate((node) => node.parentElement.getBoundingClientRect().toJSON());
    assert.equal(titles[0].size, titles[1].size, 'Both title layers must share the same font size');
    assert.ok(titles[0].rect.bottom < foreground.top, 'Top title stays above enlarged foreground');
    assert.ok(titles[1].rect.top > foreground.bottom, 'Bottom title stays below enlarged foreground');
    const indicator = await page.locator('.portrait-preview span.social-copy').evaluate((node) => node.getBoundingClientRect().toJSON());
    assert.ok(titles[1].rect.bottom < indicator.top, 'Bottom title does not collide with the part index');
    return titles;
  };
  await checkTitles();
  const seek = async (time) => page.getByLabel('Seek edited part').evaluate((input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value)); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, time);
  await page.getByLabel('Part 1 start', { exact: true }).fill('2');
  await page.waitForFunction(() => Math.abs(document.querySelector('.native-preview-video').currentTime - 2) < .2);
  await seek(5);
  assert.ok(Math.abs((await page.locator('.native-preview-video').evaluate((video) => video.currentTime)) - 8.25) < .2, 'Custom Time retains the edited source timeline at 1.25x');
  assert.deepEqual(errors, []);
  await page.getByLabel('Original title', { exact: true }).fill('日本語の長いタイトルと自動車修理の重要な結果について詳しく説明します '.repeat(4));
  await page.getByRole('button', { name: 'Apply manual timestamps', exact: true }).click();
  await page.getByLabel('New part title', { exact: true }).fill('한국어 자동차 수리 결과와 중요한 테스트');
  const longTitles = await checkTitles();
  assert.ok(Number.parseFloat(longTitles[0].size) <= 70 * geometry.canvasWidth / 1080);
  await page.screenshot({ path: path.join(root, 'preview-title-safe-zones.png'), fullPage: true });
  await page.locator('.portrait-preview').click({ position: { x: 5, y: 5 } });
  await seek(5);
  await seek(1);
  const shineStart = await page.locator('.portrait-preview .title-shine').first().evaluate((node) => node.style.maskPosition);
  await seek(2);
  const shineEnd = await page.locator('.portrait-preview .title-shine').first().evaluate((node) => node.style.maskPosition);
  assert.ok(Number.parseFloat(shineEnd) > Number.parseFloat(shineStart), 'Title light sweeps left to right on the output clock');
  await seek(5);
  await page.keyboard.press('ArrowRight');
  assert.ok(Math.abs(Number(await page.getByLabel('Seek edited part').inputValue()) - 10) < .1);
  await page.keyboard.press('ArrowLeft');
  assert.ok(Math.abs(Number(await page.getByLabel('Seek edited part').inputValue()) - 5) < .1);
  await page.getByLabel('New part title', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.ok(Math.abs(Number(await page.getByLabel('Seek edited part').inputValue()) - 5) < .1, 'Typing arrow keys must not seek');
  await page.getByRole('button', { name: 'Tua tới 5 giây', exact: true }).click();
  assert.ok(Math.abs(Number(await page.getByLabel('Seek edited part').inputValue()) - 10) < .1);
  await page.getByRole('button', { name: 'Tua lùi 5 giây', exact: true }).click();
  assert.ok(Math.abs(Number(await page.getByLabel('Seek edited part').inputValue()) - 5) < .1);
  await page.getByRole('button', { name: 'Dùng phụ đề YouTube', exact: true }).click();
  await page.waitForFunction(() => /phụ đề YouTube/.test(document.body.textContent) && !document.body.textContent.includes('Đang tạo phụ đề…'));
  const job = (id, state) => ({ id, sourceId: `qa-source-${id}`, state, progress: state === 'done' ? 100 : 0, outputs: [], error: null, currentPart: 1, plan: { originalTitle: `Own QA ${id}`, parts: [{ id: 1, title: 'Own QA part', hashtags: [] }] } });
  syntheticJobs = [job('finished-one', 'done'), job('finished-two', 'error'), job('active-job', 'rendering')];
  const deleteAll = page.getByRole('button', { name: 'Xoá tất cả', exact: true });
  await page.waitForFunction(() => { const button = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === 'Xoá tất cả'); return button && !button.disabled; });
  let confirmations = 0;
  page.on('dialog', async (dialog) => { confirmations++; await dialog.accept(); });
  await deleteAll.click();
  await page.getByText('Đã xoá 2/2 tác vụ render.', { exact: false }).waitFor();
  assert.equal(confirmations, 1); assert.deepEqual(deletedRenderIds, ['finished-one', 'finished-two']);
  assert.equal(syntheticJobs[0].id, 'active-job'); assert.equal(syntheticJobs.length, 1);
  await page.getByRole('button', { name: /Xử lý hàng loạt/ }).click();
  assert.equal(await page.getByText(/Transform Lite/).count(), 0);
  console.log(JSON.stringify({ pass: true, root, geometry, customTimeApplied: 2, transformRemoved: true, errors }));
} finally { await browser?.close(); worker.kill('SIGTERM'); await new Promise((resolve) => { if (worker.exitCode !== null) resolve(); else worker.once('exit', resolve); }); }

