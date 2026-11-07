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

const beta = options => resolveRuntime({home, platform: "darwin", ...options});

test("Beta defaults preserve their own identity, fixed ports, storage and frontend origin", () => {
  const runtime = beta();
  assert.equal(runtime.name, "ShortCut Studio");
  assert.equal(runtime.bundleId, "local.datdo.shortcutstudio");
  assert.equal(runtime.webPort, 5373);
  assert.equal(runtime.workerPort, 8987);
  assert.equal(runtime.dataRoot, path.join(home, "Library", "Application Support", "ShortCut Studio", "media"));
  assert.equal(resolveWorkerOrigin(), runtime.workerOrigin);
  assert.equal(runtimeEnvironment(runtime, {}).MEDIA_WORKER_DISABLE_LEGACY, "1");
  for (const profile of ["production", "development"]) assert.throws(() => beta({profile}), /only supports the Beta profile/);
  assert.throws(() => beta({existingDataRoot: "/old/worker-data"}), /cannot use an existing/);
});

test("Beta environment removes inherited credentials, DEV paths and production ports", () => {
  const runtime = beta();
  const env = runtimeEnvironment(runtime, {
    MEDIA_WORKER_PORT: "8787", PORT: "5173", MEDIA_WORKER_DATA_DIR: "/stable/worker-data", MEDIA_WORKER_DISABLE_LEGACY: "0",
    MEDIA_WORKER_LEGACY_DATA_DIR: "/stable/worker-data", NEXT_PUBLIC_MEDIA_WORKER_ORIGIN: "http://127.0.0.1:8787",
    CHATGPT_KEYCHAIN_SERVICE: "ShortCut Studio ChatGPT", OPENAI_API_KEY: "fake", GOOGLE_APPLICATION_CREDENTIALS: "/stable/credentials",
    YOUTUBE_COOKIES_FILE: "/stable/cookies.txt", YOUTUBE_COOKIES_FROM_BROWSER: "chrome", FONTCONFIG_FILE: "/stable/fontconfig.xml",
    XDG_CACHE_HOME: "/stable/cache", HOME: home, NODE_OPTIONS: "--import /stable/code.mjs",
  });
  assert.equal(env.PORT, "5373"); assert.equal(env.MEDIA_WORKER_PORT, "8987");
  assert.equal(env.MEDIA_WORKER_DISABLE_LEGACY, "1"); assert.equal(env.MEDIA_WORKER_DATA_DIR, runtime.dataRoot);
  assert.equal(resolveWorkerOrigin(env.NEXT_PUBLIC_MEDIA_WORKER_ORIGIN), "http://127.0.0.1:8987");
  assert.equal(env.CHATGPT_KEYCHAIN_SERVICE, undefined);
  assert.ok(env.HOME.includes("ShortCut Studio")); assert.ok(env.TMPDIR.includes("ShortCut Studio"));
  for (const key of ["OPENAI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "YOUTUBE_COOKIES_FILE", "YOUTUBE_COOKIES_FROM_BROWSER", "MEDIA_WORKER_LEGACY_DATA_DIR", "FONTCONFIG_FILE", "NODE_OPTIONS"]) assert.equal(env[key], undefined, key);
});

test("Beta packaging cannot target DEV/production or retain an existing data root", () => {
  const target = macPackageTarget({projectRoot, beta: true});
  assert.equal(target.outputAppPath, path.join(projectRoot, "release", "beta", "ShortCut Studio.app"));
  assert.equal(target.runtime.bundleId, "local.datdo.shortcutstudio");
  assert.deepEqual(target.config, {profile: "beta", webPort: 5373, workerPort: 8987, existingDataRoot: null});
  for (const options of [{}, {development: true}, {beta: true, development: true}, {beta: true, compatible26: true}]) {
    assert.throws(() => macPackageTarget({projectRoot, ...options}), /Use --beta/);
  }
});

test("runtime resolution creates nothing; Beta directories are created only under the mock support root", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "shortcut-isolation-"));
  t.after(() => rm(root, {recursive: true, force: true}));
  const supportRoot = path.join(root, "ShortCut Studio");
  const runtime = beta({supportRoot});
  assert.equal(existsSync(supportRoot), false);
  await prepareRuntimeDirectories(runtime);
  assert.equal(existsSync(runtime.dataRoot), true);
  assert.equal(existsSync(runtimeEnvironment(runtime, {}).HOME), true);
  assert.equal(existsSync(path.join(root, "ShortCut Studio Dev")), false);
});

test("unexpected Beta directory links fail closed without modifying their targets", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "shortcut-isolation-link-"));
  t.after(() => rm(root, {recursive: true, force: true}));
  const runtime = beta({supportRoot: path.join(root, "ShortCut Studio")});
  await prepareRuntimeDirectories(runtime);
  const target = await mkdtemp(path.join(root, "preserve-"));
  await rm(runtime.dataRoot, {recursive: true});
  await symlink(target, runtime.dataRoot, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(prepareRuntimeDirectories(runtime), /real directory/);
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
  assert.throws(() => resolveRuntime({ profile: "typo" }), /only supports the Beta profile/);
  for (const value of ["https://example.com", "http://127.0.0.1:8887/api", "http://user@localhost:8887", "http://localhost:8887?token=x", ""]) assert.throws(() => resolveWorkerOrigin(value));
});

test("frontend uses the framework's statically exposed public variable", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const source = await readFile(new URL("../lib/api/worker-client.ts", import.meta.url), "utf8");
  assert.match(page, /from ["']@\/lib\/api\/worker-client["']/);
  assert.match(source, /resolveWorkerOrigin\(process\.env\.NEXT_PUBLIC_MEDIA_WORKER_ORIGIN\)/);
  assert.doesNotMatch(page + source, /const WORKER_ORIGIN = "http/);
});
