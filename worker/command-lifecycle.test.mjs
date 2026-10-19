import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createCommandLifecycle } from "./command-lifecycle.mjs";

test("shutdown targets only registered children, escalates stubborn groups, and rejects new work", async () => {
  const calls = [], child = new EventEmitter(), unrelated = new EventEmitter();
  child.pid = 12345; unrelated.pid = 54321;
  child.kill = name => calls.push([child.pid, name]);
  const lifecycle = createCommandLifecycle({ platform: "darwin", graceMs: 10, kill: (pid, name) => {
    calls.push([pid, name]); if (name === "SIGKILL") queueMicrotask(() => child.emit("close"));
  } });
  lifecycle.track(child, true);
  let aborted = false, flushed = false;
  const stop = lifecycle.stop({ onStart() { aborted = true; }, onStopped() { flushed = true; } });
  assert.equal(lifecycle.stop(), stop);
  assert.throws(() => lifecycle.assertRunning(), { name: "AbortError" });
  await stop;
  assert.deepEqual(calls, [[-12345, "SIGTERM"], [-12345, "SIGKILL"]]);
  assert.ok(aborted && flushed);
});

test("completed/failed children are forgotten; non-detached children use their own handle", async () => {
  const lifecycle = createCommandLifecycle({ platform: "win32", kill() { assert.fail("No process group kill on Windows"); } });
  const done = new EventEmitter(), active = new EventEmitter(); done.pid = 123; active.pid = 456;
  done.kill = () => assert.fail("Completed child must not be signalled");
  active.kill = name => { assert.equal(name, "SIGTERM"); queueMicrotask(() => active.emit("close")); };
  lifecycle.track(done, true); done.emit("close"); lifecycle.track(active, false);
  await lifecycle.stop();
});

test("worker SIGTERM reaps its detached command instead of leaving an orphan", { skip: process.platform === "win32" }, async () => {
  const moduleUrl = new URL("./command-lifecycle.mjs", import.meta.url).href;
  const program = `import {spawn} from 'node:child_process'; import {createCommandLifecycle} from ${JSON.stringify(moduleUrl)};
    const l=createCommandLifecycle({graceMs:50});
    const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
    l.track(c,true); process.on('SIGTERM',()=>l.stop().then(()=>process.exit(0)));
    console.log(c.pid); setInterval(()=>{},1000);`;
  const parent = spawn(process.execPath, ["--input-type=module", "-e", program], { stdio: ["ignore", "pipe", "pipe"] });
  let child;
  try {
    const [data] = await once(parent.stdout, "data"); child = Number(data.toString().trim()); assert.ok(child > 0);
    const exit = once(parent, "exit"); parent.kill("SIGTERM"); const [code] = await exit; assert.equal(code, 0);
    assert.throws(() => process.kill(child, 0), { code: "ESRCH" });
  } finally {
    if (parent.exitCode === null && parent.signalCode === null) parent.kill("SIGKILL");
    if (child) { try { process.kill(-child, "SIGKILL"); } catch { /* Already reaped. */ } }
  }
});
