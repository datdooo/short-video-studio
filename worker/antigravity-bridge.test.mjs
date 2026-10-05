import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createAntigravityBridge, parseAntigravityResult, geminiQuota, antigravityEnvironment } from "./antigravity-bridge.mjs";

const usage = (remaining = .5) => ({ status: "SUCCESS", command: { data: { groups: [{ name: "Gemini Models", buckets: [{ id: "gemini-weekly", remaining_fraction: remaining, reset_time: "2026-10-11T14:46:25Z" }] }] } } });
const config = (credits = false) => ({ status: "SUCCESS", command: { data: { config: { useG1Credits: credits, modelProvider: "" } } } });
async function fixture(remaining = .5, credits = false) {
  const root = await mkdtemp(path.join(tmpdir(), "shortcut-agy-test-"));
  const calls = [];
  let loginCount = 0;
  const bridge = createAntigravityBridge(root, { binary: "/fake/official/agy", openLogin: async () => { loginCount++; }, run: async (args, options) => {
    calls.push({ args, options });
    if (args.includes("/usage")) return usage(remaining);
    if (args.includes("/config")) return config(credits);
    if (args.includes("/hooks")) {
      const source = path.join(root, "antigravity-profile/workspace/.agents/hooks.json");
      const gate = JSON.parse(await readFile(source, "utf8"))["shortcut-transcript-only"];
      return { status: "SUCCESS", command: { data: { hooks: [{ name: "shortcut-transcript-only", enabled: true, source, actions: [{ event: "PreToolUse", matcher: "*", command: gate.PreToolUse[0].hooks[0].command }] }] } } };
    }
    options?.signal?.throwIfAborted();
    return { status: "SUCCESS", structured_output: { originalTitle: "Test", parts: [{ id: 1 }, { id: 2 }] } };
  } });
  return { root, bridge, calls, get loginCount() { return loginCount; } };
}

test("requires explicit app connect; reuses native login without extracting credentials", async () => {
  const f = await fixture();
  assert.equal((await f.bridge.session()).connected, false);
  await assert.rejects(f.bridge.analyze({ input: "test" }), /Chưa kết nối Antigravity/);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.bridge.connect()).connected, true);
  assert.equal(f.loginCount, 0);
  assert.equal((await f.bridge.session()).quota.remainingPercent, 50);
  const agent = await readFile(path.join(f.root, "antigravity-profile/workspace/.agents/agents/shortcut-video-editor.md"), "utf8");
  assert.match(agent, /tools:\n  - finish/);
  assert.match(agent, /subagent: false/);
});

test("long transcripts go through stdin; schema/model pinned and no permission bypass", async () => {
  const f = await fixture(); await f.bridge.connect();
  const input = "x".repeat(200000);
  const result = await f.bridge.analyze({ input, schema: { type: "object" } });
  const invocation = f.calls.at(-1);
  assert.equal(result.model, "gemini-3.1-pro-high");
  assert.equal(result.plan.parts.length, 2);
  assert.ok(invocation.options.input.includes(input));
  assert.ok(!invocation.args.some((arg) => arg.includes(input)));
  assert.ok(invocation.args.includes("--json-schema"));
  assert.ok(invocation.args.includes("--disable-slash-commands"));
  assert.ok(!invocation.args.includes("--dangerously-skip-permissions"));
});

test("quota zero and enabled credits block generation without a model/API fallback", async () => {
  const f = await fixture(0); await f.bridge.connect();
  await assert.rejects(f.bridge.analyze({ input: "never sent", schema: {} }), /hết quota/);
  assert.ok(f.calls.every(({ args }) => args.includes("-p")));
  const paid = await fixture(.5, true);
  assert.equal((await paid.bridge.connect()).connected, false);
  assert.equal(paid.loginCount, 0);
  await assert.rejects(paid.bridge.analyze({ input: "never sent", schema: {} }), /Tắt Use AI Credits/);
});

test("disconnect unlinks this app only, preserving old credentials and native account", async () => {
  const f = await fixture(); await f.bridge.connect();
  const unrelated = path.join(f.root, "old-google-credentials.json");
  await writeFile(unrelated, "test-only-keep");
  const before = f.calls.length;
  assert.equal((await f.bridge.disconnect()).connected, false);
  assert.equal(f.calls.length, before);
  assert.equal(await readFile(unrelated, "utf8"), "test-only-keep");
});

test("aborted work never sends a new prompt", async () => {
  const f = await fixture(); await f.bridge.connect();
  const controller = new AbortController(); controller.abort(new Error("User stopped"));
  const before = f.calls.length;
  await assert.rejects(f.bridge.analyze({ input: "test", schema: {} }, controller.signal), /User stopped/);
  assert.equal(f.calls.length, before);
});

test("parses schema/envelope/fenced JSON and rejects unsuccessful or invalid replies", () => {
  assert.deepEqual(parseAntigravityResult({ status: "SUCCESS", response: "```json\n{\"parts\":[]}\n```" }), { parts: [] });
  assert.throws(() => parseAntigravityResult({ status: "ERROR", error: "quota" }), /quota/);
  assert.throws(() => parseAntigravityResult({ status: "SUCCESS", response: "not JSON" }), /JSON/);
  assert.equal(geminiQuota(usage(0)).remainingPercent, 0);
  assert.equal(geminiQuota({}), null);
  assert.equal(antigravityEnvironment().AGY_CLI_DISABLE_AUTO_UPDATE, "1");
});

test("native hook denies filesystem, commands, web, MCP and delegation; only finish allowed", () => {
  const gate = path.join(import.meta.dirname, "antigravity-tool-gate.mjs");
  for (const name of ["run_command", "view_file", "write_to_file", "search_web", "invoke_subagent", "call_mcp_tool", "finish"]) {
    const result = spawnSync(process.execPath, [gate], { input: JSON.stringify({ toolCall: { name, args: {} } }), encoding: "utf8" });
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).decision, name === "finish" ? "allow" : "deny");
  }
  assert.equal(JSON.parse(spawnSync(process.execPath, [gate], { input: "invalid", encoding: "utf8" }).stdout).decision, "deny");
});

test("missing tool gate fails closed before a transcript can be submitted", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "shortcut-agy-missing-gate-"));
  let promptSent = false;
  const bridge = createAntigravityBridge(root, { binary: "/fake/agy", run: async (args) => {
    if (args.includes("/usage")) return usage();
    if (args.includes("/config")) return config();
    if (args.includes("/hooks")) return { status: "SUCCESS", command: { data: { hooks: [] } } };
    promptSent = true; throw new Error("Must not get here");
  } });
  await bridge.connect();
  await assert.rejects(bridge.analyze({ input: "private transcript", schema: {} }), /chốt chặn tool/);
  assert.equal(promptSent, false);
});
