// The Windows launcher owns a Job Object, so closing it also stops render children.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { windowsEnvironment } from './windows-config.mjs';

const resources = path.resolve(import.meta.dirname, '..');
const { appRoot, dataRoot, fontConfig, fontXml, env } = windowsEnvironment(resources, process.env);
await mkdir(path.join(dataRoot, 'cache'), { recursive: true });
await writeFile(fontConfig, fontXml);
async function occupied(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    const done = (value) => { socket.destroy(); resolve(value); };
    socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.once('timeout', () => done(false));
  });
}
if (await occupied(5173) || await occupied(8787)) throw new Error('Ports 5173/8787 are occupied. Close the other ShortCut Studio instance first.');
let stopping = false;
const children = [];
function stop(code) {
  if (stopping) return; stopping = true;
  for (const child of children) child.kill();
  // Exiting releases the launcher's Job Object after it observes this process.
  setTimeout(() => process.exit(code), 500);
}
for (const script of [path.join(appRoot, 'worker', 'server.mjs'), path.join(appRoot, 'server.js')]) {
  const child = spawn(process.execPath, [script], { cwd: appRoot, env, windowsHide: true, stdio: ['ignore', 'inherit', 'inherit'] });
  children.push(child);
  child.once('error', (error) => { console.error(error.message); stop(1); });
  child.once('exit', (code) => { if (!stopping) stop(code || 1); });
}
let ready = false;
for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
  try {
    const [worker, web] = await Promise.all([fetch('http://127.0.0.1:8787/health', { signal: AbortSignal.timeout(1500) }), fetch('http://127.0.0.1:5173/', { signal: AbortSignal.timeout(1500) })]);
    if (worker.ok && (await worker.json()).ok && web.ok) { ready = true; console.log('SHORTCUT_READY'); break; }
  } catch { /* Still starting. */ }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!ready && !stopping) { console.error('Startup timed out. See the local log file.'); stop(1); }
