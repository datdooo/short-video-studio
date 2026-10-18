import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { resolveRuntime, runtimeEnvironment, prepareRuntimeDirectories, macPackageTarget, assertRuntimePortsAvailable } from "./runtime-config.mjs";
import { resolveWorkerOrigin } from "../lib/worker-origin.mjs";

const home = "/test-home";
const projectRoot = "/dev-worktree";

test("production defaults preserve identity, ports, data path and frontend origin", () => {
  const runtime = resolveRuntime({ home });
  assert.equal(runtime.name, "ShortCut Studio");
  assert.equal(runtime.bundleId, "local.datdo.shortcutstudio");
  assert.equal(runtime.webPort, 5173);
  assert.equal(runtime.workerPort, 8787);
  assert.equal(runtime.dataRoot, "/test-home/Library/Application Support/ShortCut Studio/media");
  assert.equal(resolveWorkerOrigin(), runtime.workerOrigin);
  assert.equal(runtimeEnvironment(runtime, {}).MEDIA_WORKER_DISABLE_LEGACY, undefined);
});

test("old package config still selects an existing production worker-data root", () => {
  assert.equal(resolveRuntime({ home, existingDataRoot: "/old/worker-data", exists: () => true }).dataRoot, "/old/worker-data");
  assert.equal(resolveRuntime({ home, existingDataRoot: "/old/worker-data", exists: () => false }).dataRoot, resolveRuntime({ home }).dataRoot);
});

test("DEV fixes ports, data root and legacy lookup even with inherited production settings", () => {
  const runtime = resolveRuntime({ profile: "development", home, existingDataRoot: "/stable/worker-data", exists: () => assert.fail("DEV must not inspect the production data root") });
  const env = runtimeEnvironment(runtime, {
    MEDIA_WORKER_PORT: "8787", PORT: "5173", MEDIA_WORKER_DATA_DIR: "/stable/worker-data", MEDIA_WORKER_DISABLE_LEGACY: "0",
    MEDIA_WORKER_LEGACY_DATA_DIR: "/stable/worker-data", NEXT_PUBLIC_MEDIA_WORKER_ORIGIN: "http://127.0.0.1:8787",
    CHATGPT_KEYCHAIN_SERVICE: "ShortCut Studio ChatGPT", OPENAI_API_KEY: "fake", GOOGLE_APPLICATION_CREDENTIALS: "/stable/credentials",
    YOUTUBE_COOKIES_FILE: "/stable/cookies.txt", YOUTUBE_COOKIES_FROM_BROWSER: "chrome", FONTCONFIG_FILE: "/stable/fontconfig.xml",
    XDG_CACHE_HOME: "/stable/cache", HOME: home, NODE_OPTIONS: "--import /stable/code.mjs",
  });
  assert.equal(runtime.webPort, 5273);
  assert.equal(runtime.workerPort, 8887);
  assert.equal(env.PORT, "5273");
  assert.equal(env.MEDIA_WORKER_PORT, "8887");
  assert.equal(env.MEDIA_WORKER_DISABLE_LEGACY, "1");
  assert.equal(runtime.dataRoot, "/test-home/Library/Application Support/ShortCut Studio Dev/media");
  assert.equal(env.MEDIA_WORKER_DATA_DIR, runtime.dataRoot);
  assert.notEqual(runtime.dataRoot, resolveRuntime({ home }).dataRoot);
  assert.equal(resolveWorkerOrigin(env.NEXT_PUBLIC_MEDIA_WORKER_ORIGIN), "http://127.0.0.1:8887");
  assert.equal(env.CHATGPT_KEYCHAIN_SERVICE, "ShortCut Studio Dev ChatGPT");
  assert.ok(env.HOME.includes("ShortCut Studio Dev"));
  assert.ok(env.TMPDIR.includes("ShortCut Studio Dev"));
  for (const key of ["OPENAI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "YOUTUBE_COOKIES_FILE", "YOUTUBE_COOKIES_FROM_BROWSER", "MEDIA_WORKER_LEGACY_DATA_DIR", "FONTCONFIG_FILE", "NODE_OPTIONS"]) assert.equal(env[key], undefined, key);
});

test("DEV package target cannot overwrite production or retain existingDataRoot", () => {
  const dev = macPackageTarget({ projectRoot, development: true });
  const prod = macPackageTarget({ projectRoot });
  assert.equal(dev.outputAppPath, "/dev-worktree/release/dev/ShortCut Studio Dev.app");
  assert.equal(prod.outputAppPath, "/dev-worktree/release/ShortCut Studio.app");
  assert.notEqual(dev.outputAppPath, prod.outputAppPath);
  assert.equal(dev.runtime.bundleId, "local.datdo.shortcutstudio.dev");
  assert.equal(prod.runtime.bundleId, "local.datdo.shortcutstudio");
  assert.equal(dev.config.profile, "development");
  assert.equal(dev.config.webPort, 5273);
  assert.equal(dev.config.workerPort, 8887);
  assert.equal(dev.config.existingDataRoot, null);
  assert.equal(prod.config.existingDataRoot, "/dev-worktree/worker-data");
  assert.equal(macPackageTarget({ projectRoot, compatible26: true }).config.existingDataRoot, null);
  assert.throws(() => macPackageTarget({ projectRoot, development: true, compatible26: true }), /separately/);
});

test("runtime resolution creates nothing; DEV directories are created lazily under a mock home", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "shortcut-isolation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dev = resolveRuntime({ home: root, profile: "development" });
  const prod = resolveRuntime({ home: root });
  assert.equal(existsSync(dev.supportRoot), false);
  await prepareRuntimeDirectories(dev);
  assert.equal(existsSync(dev.dataRoot), true);
  assert.equal(existsSync(runtimeEnvironment(dev, {}).HOME), true);
  assert.equal(existsSync(prod.supportRoot), false);
});

test("unexpected DEV symlinks fail closed without modifying their targets", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "shortcut-isolation-link-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dev = resolveRuntime({ home: root, profile: "development" });
  await prepareRuntimeDirectories(dev);
  const target = await mkdtemp(path.join(root, "preserve-"));
  await rm(dev.dataRoot, { recursive: true });
  await symlink(target, dev.dataRoot);
  await assert.rejects(prepareRuntimeDirectories(dev), /real directory/);
  assert.equal(existsSync(target), true);
});

test("port collisions fail without stopping the existing listener", async (t) => {
  const server = net.createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  await assert.rejects(assertRuntimePortsAvailable({ name: "test DEV", webPort: port, workerPort: port }), /unavailable/);
  assert.equal(server.listening, true);
});

test("invalid runtime profiles and worker origins fail closed", () => {
  assert.throws(() => resolveRuntime({ profile: "typo" }), /Unknown/);
  for (const value of ["https://example.com", "http://127.0.0.1:8887/api", "http://user@localhost:8887", "http://localhost:8887?token=x", ""]) assert.throws(() => resolveWorkerOrigin(value));
});

test("frontend uses the framework's statically exposed public variable", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /resolveWorkerOrigin\(process\.env\.NEXT_PUBLIC_MEDIA_WORKER_ORIGIN\)/);
  assert.doesNotMatch(source, /const WORKER_ORIGIN = "http/);
});
