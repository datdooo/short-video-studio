import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  classifyCodexFailure,
  codexArguments,
  codexCandidates,
  codexEnvironment,
  createCodexCli,
  resolveCodexBinary,
} from "./codex-cli.mjs";

const SCRIPT = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const dir = __dirname;
const argv = process.argv.slice(2);
const mode = (() => { try { return fs.readFileSync(path.join(dir, "mode.txt"), "utf8").trim(); } catch { return "ok"; } })();
fs.appendFileSync(path.join(dir, "calls.log"), JSON.stringify({ argv, at: Date.now(), home: process.env.HOME, hasToken: Object.keys(process.env).some((k) => /TOKEN|SECRET/.test(k)) }) + "\\n");
if (argv[0] === "--version") { console.log("codex-cli 9.9.9"); process.exit(0); }
if (argv[0] === "login") {
  if (mode === "logged-out") { console.error("Not logged in"); process.exit(1); }
  console.log("Logged in using ChatGPT"); process.exit(0);
}
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  fs.writeFileSync(path.join(dir, "stdin.txt"), input);
  const out = argv[argv.indexOf("-o") + 1];
  if (mode === "auth") { console.error("401 Unauthorized: please log in"); process.exit(1); }
  if (mode === "sleep") { setInterval(() => {}, 1000); return; }
  if (mode === "slow") { setTimeout(() => { fs.writeFileSync(out, '{"ok":true}'); console.log("tokens used\\n1,234"); process.exit(0); }, 150); return; }
  if (mode === "badjson") { fs.writeFileSync(out, "not json"); process.exit(0); }
  fs.writeFileSync(out, JSON.stringify({ answer: input.includes("HELLO") }));
  console.error("tokens used\\n14,380");
});
`;

async function fixture(mode = "ok") {
  const dir = await mkdtemp(path.join(tmpdir(), "fake-codex-"));
  const binary = path.join(dir, "codex");
  await writeFile(binary, SCRIPT);
  await chmod(binary, 0o755);
  await writeFile(path.join(dir, "mode.txt"), mode);
  const tmp = path.join(dir, "tmp");
  await import("node:fs/promises").then((fs) => fs.mkdir(tmp));
  return {
    dir, binary, tmp,
    mode: (value) => writeFile(path.join(dir, "mode.txt"), value),
    calls: async () => (await readFile(path.join(dir, "calls.log"), "utf8").catch(() => "")).split("\n").filter(Boolean).map((line) => JSON.parse(line)),
    cleanup: () => rm(dir, { recursive: true, force: true }),
    bridge: () => createCodexCli(() => ({ tmp }), { resolve: () => binary }),
  };
}

test("argv is fixed: prompt never on the command line, images by --image=, '-' last", () => {
  const args = codexArguments({ schemaFile: "/j/s.json", outputFile: "/j/o.json", images: ["/j/a.png", "/j/b.png"], cwd: "/j" });
  assert.equal(args[0], "exec");
  assert.deepEqual(args.slice(args.indexOf("-m"), args.indexOf("-m") + 2), ["-m", "gpt-6.1-sol"]);
  assert.ok(args.includes('model_reasoning_effort="low"'));
  for (const flag of ["--sandbox", "read-only", "--ephemeral", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "--output-schema", "-o", "-C"])
    assert.ok(args.includes(flag), flag);
  assert.ok(args.includes("--image=/j/a.png") && args.includes("--image=/j/b.png"));
  assert.equal(args.at(-1), "-");
  assert.ok(!args.some((a) => /danger|bypass|full-access/.test(a)));
  assert.throws(() => codexArguments({ schemaFile: "s", outputFile: "o", cwd: "c", images: Array.from({ length: 25 }, (_, i) => `/i${i}.png`) }), /ảnh/);
});

test("child environment uses the real home and drops secrets", () => {
  const env = codexEnvironment({
    env: { PATH: "/usr/bin:relative", HOME: "/Beta/home", ANTHROPIC_API_KEY: "x", SOME_TOKEN: "y", LANG: "vi_VN.UTF-8", CODEX_HOME: "/Users/u/.codex" },
    platform: "darwin", home: "/Users/u", tmp: "/tmp/job",
  });
  assert.equal(env.HOME, "/Users/u");
  assert.equal(env.TMPDIR, "/tmp/job");
  assert.equal(env.CODEX_HOME, "/Users/u/.codex");
  assert.ok(!("ANTHROPIC_API_KEY" in env) && !("SOME_TOKEN" in env));
  assert.ok(!env.PATH.split(":").includes("relative"));
  assert.ok(env.PATH.includes("/opt/homebrew/bin"));
  assert.deepEqual(codexEnvironment({ env: { CODEX_HOME: "relative" }, platform: "linux", home: "/h" }).CODEX_HOME, undefined);
});

test("binary resolution is explicit, absolute and platform-aware", () => {
  assert.throws(() => resolveCodexBinary({ env: { SHORTCUT_CODEX_BIN: "codex" }, platform: "darwin" }), /tuyệt đối/);
  assert.throws(() => resolveCodexBinary({ env: { SHORTCUT_CODEX_BIN: "/bin/sh" }, platform: "darwin" }), /tuyệt đối/);
  assert.equal(resolveCodexBinary({ env: { SHORTCUT_CODEX_BIN: "/x/codex" }, platform: "darwin", exists: () => true }), "/x/codex");
  assert.equal(resolveCodexBinary({ env: { SHORTCUT_CODEX_BIN: "/x/codex" }, platform: "darwin", exists: () => false }), null);
  const mac = codexCandidates({ env: { PATH: "/a:b" }, platform: "darwin", home: "/h" });
  assert.ok(mac.includes("/opt/homebrew/bin/codex") && mac.some((c) => c.includes("ChatGPT.app")));
  assert.ok(!mac.includes("b/codex"));
  const win = codexCandidates({ env: { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local", PATH: "" }, platform: "win32", home: "C:\\Users\\u" });
  assert.ok(win.some((c) => c.endsWith("codex.exe")));
});

test("status reports installed/logged-in without throwing", async () => {
  const f = await fixture();
  try {
    const bridge = f.bridge();
    assert.deepEqual(await bridge.status(), { installed: true, loggedIn: true, version: "9.9.9", model: "gpt-6.1-sol", reasoning: "low" });
    await f.mode("logged-out");
    assert.equal((await bridge.status({ force: true })).loggedIn, false);
    await assert.rejects(bridge.ensureCodexReady(), (e) => e.code === "PROVIDER_AUTH" && /codex login/.test(e.message));
    const missing = createCodexCli(() => ({}), { resolve: () => null });
    assert.equal((await missing.status()).installed, false);
    await assert.rejects(missing.ensureCodexReady(), (e) => e.code === "CODEX_NOT_FOUND");
  } finally {
    await f.cleanup();
  }
});

test("analyze returns the schema JSON, uses the real home, cleans its job directory", async () => {
  const f = await fixture();
  try {
    const result = await f.bridge().analyzeWithCodexPlan(
      { schema: { type: "object" }, instructions: "Be precise" },
      undefined,
      [{ type: "input_text", text: "HELLO world" }],
      { effort: "low", source: "owner-pin" },
    );
    assert.deepEqual(result.plan, { answer: true });
    assert.equal(result.model, "gpt-6.1-sol");
    assert.deepEqual(result.usage, { totalTokens: 14380 });
    assert.equal(result.transport, "codex-cli-v1");
    const [call] = (await f.calls()).filter((c) => c.argv[0] === "exec");
    assert.equal(call.hasToken, false);
    assert.notEqual(call.home, "/nonexistent");
    const prompt = await readFile(path.join(f.dir, "stdin.txt"), "utf8");
    assert.match(prompt, /Be precise/);
    assert.match(prompt, /HELLO world/);
    assert.ok(!call.argv.join(" ").includes("HELLO"), "prompt must not appear in argv");
    assert.deepEqual((await readdir(f.tmp)).filter((n) => n.startsWith("codex-job-")), []);
  } finally {
    await f.cleanup();
  }
});

test("model and reasoning are pinned, never switched", async () => {
  const f = await fixture();
  try {
    const bridge = f.bridge();
    await assert.rejects(bridge.analyzeWithCodexPlan({ model: "other", schema: {} }, undefined, "x"), /MODEL_UNAVAILABLE/);
    await assert.rejects(bridge.analyzeWithCodexPlan({ schema: {} }, undefined, "x", { effort: "high" }), (e) => e.code === "REASONING_CONFIGURATION");
    assert.deepEqual((await f.calls()).filter((c) => c.argv[0] === "exec"), []);
  } finally {
    await f.cleanup();
  }
});

test("failures map to the existing provider error codes", async () => {
  const f = await fixture();
  try {
    const bridge = f.bridge();
    await f.mode("auth");
    await assert.rejects(bridge.analyzeWithCodexPlan({ schema: {} }, undefined, "x"), (e) => e.code === "PROVIDER_AUTH");
    await f.mode("badjson");
    await assert.rejects(bridge.analyzeWithCodexPlan({ schema: {} }, undefined, "x"), (e) => e.code === "PROVIDER_OUTPUT_JSON_INVALID");
    assert.deepEqual((await readdir(f.tmp)).filter((n) => n.startsWith("codex-job-")), []);
  } finally {
    await f.cleanup();
  }
});

test("timeout and abort stop the child process", async () => {
  const f = await fixture("sleep");
  const previous = process.env.SHORTCUT_CODEX_TIMEOUT_MS;
  try {
    process.env.SHORTCUT_CODEX_TIMEOUT_MS = "300";
    await assert.rejects(f.bridge().analyzeWithCodexPlan({ schema: {} }, undefined, "x"), (e) => e.code === "PROVIDER_TIMEOUT");
    delete process.env.SHORTCUT_CODEX_TIMEOUT_MS;
    const controller = new AbortController();
    const pending = f.bridge().analyzeWithCodexPlan({ schema: {} }, controller.signal, "x");
    setTimeout(() => controller.abort(), 200);
    await assert.rejects(pending, (e) => e.code === "CODEX_ABORTED");
    await assert.rejects(f.bridge().analyzeWithCodexPlan({ schema: {} }, AbortSignal.abort(), "x"), Error);
    assert.deepEqual((await readdir(f.tmp)).filter((n) => n.startsWith("codex-job-")), []);
  } finally {
    if (previous === undefined) delete process.env.SHORTCUT_CODEX_TIMEOUT_MS;
    else process.env.SHORTCUT_CODEX_TIMEOUT_MS = previous;
    await f.cleanup();
  }
});

test("requests run one at a time", async () => {
  const f = await fixture("slow");
  try {
    const bridge = f.bridge();
    await Promise.all([1, 2, 3].map(() => bridge.analyzeWithCodexPlan({ schema: {} }, undefined, "x")));
    const execs = (await f.calls()).filter((c) => c.argv[0] === "exec");
    assert.equal(execs.length, 3);
    for (let i = 1; i < execs.length; i++) assert.ok(execs[i].at - execs[i - 1].at >= 120, "serial execution");
  } finally {
    await f.cleanup();
  }
});

test("failure classification never copies raw text", () => {
  const cases = [
    [{ code: 1, stderr: "Not logged in" }, "PROVIDER_AUTH"],
    [{ code: 1, stderr: "usage limit reached" }, "PROVIDER_QUOTA"],
    [{ code: 1, stderr: "429 too many requests" }, "PROVIDER_RATE_LIMIT"],
    [{ code: 1, stderr: "model gpt-x not found" }, "MODEL_UNAVAILABLE"],
    [{ code: 1, stderr: "connection reset" }, "PROVIDER_NETWORK"],
    [{ code: 1, stderr: "boom" }, "PROVIDER_RESPONSE_FAILED"],
    [{ code: 0 }, "PROVIDER_OUTPUT_JSON_INVALID"],
    [{ code: null, timedOut: true }, "PROVIDER_TIMEOUT"],
  ];
  for (const [input, expected] of cases) assert.equal(classifyCodexFailure(input), expected, JSON.stringify(input));
});
