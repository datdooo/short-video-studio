import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import path from "node:path";
import { ANALYSIS_MODEL, ANALYSIS_REASONING } from "../lib/ai-reasoning.mjs";
import { providerError } from "./provider-response.mjs";

/** Transport id stored in cache keys so results from other transports are never reused. */
export const CODEX_TRANSPORT = "codex-cli-v1";
const OUTPUT_LIMIT = 1024 * 1024;
const STATUS_TTL_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const MAX_IMAGES = 24;

const executableNames = (platform) => (platform === "win32" ? ["codex.exe", "codex.cmd"] : ["codex"]);
const pathFor = (platform) => (platform === "win32" ? path.win32 : path);

/** Absolute candidates only: a packaged app often starts with a minimal PATH. */
export function codexCandidates({ env = process.env, platform = process.platform, home = userInfo().homedir } = {}) {
  const p = pathFor(platform), names = executableNames(platform);
  const sep = platform === "win32" ? ";" : ":";
  const dirs = [];
  for (const entry of String(env.PATH || "").split(sep)) if (entry && p.isAbsolute(entry)) dirs.push(entry);
  if (platform === "darwin") dirs.push("/opt/homebrew/bin", "/usr/local/bin", p.join(home, ".local", "bin"));
  else if (platform === "win32") {
    for (const base of [env.LOCALAPPDATA, env.APPDATA, env.ProgramFiles])
      if (base && p.isAbsolute(base)) dirs.push(p.join(base, "Programs", "codex"), p.join(base, "npm"));
  } else dirs.push("/usr/local/bin", "/usr/bin", p.join(home, ".local", "bin"));
  const found = names.flatMap((name) => dirs.map((dir) => p.join(dir, name)));
  if (platform === "darwin")
    found.push("/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex");
  return [...new Set(found)];
}

export function resolveCodexBinary({ env = process.env, platform = process.platform, exists = existsSync } = {}) {
  const explicit = env.SHORTCUT_CODEX_BIN, p = pathFor(platform);
  if (explicit) {
    if (!p.isAbsolute(explicit) || !executableNames(platform).includes(p.basename(explicit)))
      throw Object.assign(Error("SHORTCUT_CODEX_BIN phải là đường dẫn tuyệt đối tới codex."), { code: "CODEX_NOT_FOUND" });
    return exists(explicit) ? explicit : null;
  }
  for (const candidate of codexCandidates({ env, platform })) {
    try {
      if (exists(candidate) && statSync(candidate).isFile()) return candidate;
    } catch {
      /* Try the next candidate. */
    }
  }
  return null;
}

/** Child environment: only what Codex needs. The worker's Beta HOME is NOT the user's Codex login. */
export function codexEnvironment({ env = process.env, platform = process.platform, home = userInfo().homedir, tmp } = {}) {
  const sep = platform === "win32" ? ";" : ":";
  const p = pathFor(platform);
  const basePath = (env.PATH || "").split(sep).filter((entry) => entry && p.isAbsolute(entry));
  const extra = platform === "darwin" ? ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] : [];
  const child = {
    PATH: [...new Set([...basePath, ...extra])].join(sep),
    HOME: home,
    LANG: env.LANG || "en_US.UTF-8",
    ...(tmp ? { TMPDIR: tmp, TEMP: tmp, TMP: tmp } : {}),
  };
  if (platform === "win32") {
    for (const key of ["SystemRoot", "ComSpec", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "ProgramFiles"])
      if (env[key]) child[key] = env[key];
    child.USERPROFILE = env.USERPROFILE || home;
  }
  if (env.CODEX_HOME && p.isAbsolute(env.CODEX_HOME)) child.CODEX_HOME = env.CODEX_HOME;
  return child;
}

/**
 * Fixed argv. Everything model-controlled stays out of the command line: prompt goes through
 * stdin, schema/output are files in a private job directory.
 */
export function codexArguments({ model = ANALYSIS_MODEL, effort = ANALYSIS_REASONING, schemaFile, outputFile, images = [], cwd }) {
  if (images.length > MAX_IMAGES) throw Object.assign(Error("CODEX_INPUT: quá nhiều ảnh."), { code: "CODEX_INPUT" });
  return [
    "exec",
    "-m", model,
    "-c", `model_reasoning_effort=${JSON.stringify(effort)}`,
    "-c", 'web_search="disabled"',
    "--disable", "browser_use",
    "--disable", "browser_use_external",
    "--disable", "browser_use_full_cdp_access",
    "--disable", "computer_use",
    "--disable", "apps",
    "--sandbox", "read-only",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ignore-rules",
    "--color", "never",
    "-C", cwd,
    ...(schemaFile ? ["--output-schema", schemaFile] : []),
    "-o", outputFile,
    ...images.map((file) => `--image=${file}`),
    "-",
  ];
}

function killTree(child, platform = process.platform) {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* Already gone. */
    }
  }
  setTimeout(() => {
    try {
      if (child.exitCode !== null) return;
      if (platform === "win32") child.kill();
      else process.kill(-child.pid, "SIGKILL");
    } catch {
      /* Already gone. */
    }
  }, 3000).unref();
}

/** Bounded child-process runner. Never logs prompt, stdout or stderr. */
export function runProcess(binary, args, { input, cwd, env, signal, timeoutMs = DEFAULT_TIMEOUT_MS, platform = process.platform } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error("CODEX_ABORTED"), { code: "CODEX_ABORTED" }));
    const child = spawn(binary, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      detached: platform !== "win32",
      shell: platform === "win32" && /\.cmd$/i.test(binary),
    });
    let stdout = "", stderr = "", timedOut = false, settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn(value);
    };
    const onAbort = () => {
      killTree(child, platform);
      finish(reject, Object.assign(new Error("CODEX_ABORTED"), { code: "CODEX_ABORTED" }));
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child, platform);
    }, timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    const append = (current, chunk) => (current.length >= OUTPUT_LIMIT ? current : (current + chunk).slice(0, OUTPUT_LIMIT));
    child.stdout.on("data", (chunk) => (stdout = append(stdout, chunk.toString("utf8"))));
    child.stderr.on("data", (chunk) => (stderr = append(stderr, chunk.toString("utf8"))));
    child.on("error", (error) => finish(reject, Object.assign(new Error("CODEX_SPAWN"), { code: "CODEX_NOT_FOUND", cause: error })));
    child.on("close", (code) => finish(resolve, { code, stdout, stderr, timedOut }));
    child.stdin.on("error", () => {});
    child.stdin.end(input ?? "");
  });
}

/** Stable classification from the CLI's bounded text; never copy raw text to callers. */
export function classifyCodexFailure({ code, stderr = "", stdout = "", timedOut = false }) {
  if (timedOut) return "PROVIDER_TIMEOUT";
  const text = `${stderr}\n${stdout}`.toLowerCase();
  if (/not logged in|log in|login|unauthorized|401|403|token (is )?(expired|invalid)|sign in/.test(text)) return "PROVIDER_AUTH";
  if (/quota|usage limit|rate.?limit|429|too many requests/.test(text))
    return /quota|usage limit/.test(text) ? "PROVIDER_QUOTA" : "PROVIDER_RATE_LIMIT";
  if (/model.*(not found|unavailable|not available|does not exist|unsupported)|unknown model/.test(text)) return "MODEL_UNAVAILABLE";
  if (/reasoning.*(unsupported|invalid|not supported)|effort/.test(text)) return "REASONING_CONFIGURATION";
  if (/context length|payload too large|too many tokens|413/.test(text)) return "PROVIDER_PAYLOAD";
  if (/network|dns|econn|enotfound|timed out|timeout|connection/.test(text)) return "PROVIDER_NETWORK";
  return code === 0 ? "PROVIDER_OUTPUT_JSON_INVALID" : "PROVIDER_RESPONSE_FAILED";
}

function tokenUsage(stdout, stderr) {
  const match = /tokens used\s*\n?\s*([\d.,]+)/i.exec(`${stderr}\n${stdout}`);
  const total = match ? Number(match[1].replace(/[.,]/g, "")) : NaN;
  return Number.isFinite(total) ? { totalTokens: total } : undefined;
}

export function codexPromptText({ instructions, content }) {
  const text = Array.isArray(content)
    ? content.map((part) => (part?.type === "input_text" ? String(part.text ?? "") : "")).join("\n")
    : String(content ?? "");
  return [
    "You are a precise source-accurate short-form video editor, NOT a coding agent.",
    "Do not run commands, edit files, browse or use any tool. Use only the text below and any attached images.",
    "Return ONLY one JSON object that matches the provided output schema.",
    "",
    "INSTRUCTIONS:",
    instructions || "Return only the requested edit plan.",
    "",
    "INPUT:",
    text,
  ].join("\n");
}

/** Manual-flow TXT sent as-is: the same prompt a person would paste, answered with the same JSON. */
export function codexTxtPromptText({ prompt, stillsNote = "" }) {
  return [
    "You are answering the editing request below exactly as you would in a web chat.",
    "Do not run commands, edit files, browse or use any tool. Use only the text below and any attached images.",
    ...(stillsNote ? [stillsNote] : []),
    "Reply with the final JSON only, exactly in the format the request asks for.",
    "",
    "REQUEST:",
    String(prompt ?? ""),
  ].join("\n");
}

/** One worker-owned domain; mirrors the former ChatGPT transport contract. */
export function createCodexCli(read = () => ({}), options = {}) {
  const { platform = process.platform, run = runProcess, resolve = resolveCodexBinary, now = Date.now } = options;
  let cached = null, queue = Promise.resolve();

  const environment = () => {
    const { tmp } = read() || {};
    return codexEnvironment({ env: process.env, platform, tmp });
  };

  async function status({ force = false } = {}) {
    if (!force && cached && now() - cached.at < STATUS_TTL_MS) return cached.value;
    const value = { installed: false, loggedIn: false, version: null, model: ANALYSIS_MODEL, reasoning: ANALYSIS_REASONING };
    try {
      const binary = resolve({ platform });
      if (binary) {
        value.installed = true;
        const env = environment();
        const version = await run(binary, ["--version"], { env, timeoutMs: 5000, platform });
        value.version = /\d+\.\d+\.\d+/.exec(version.stdout)?.[0] || null;
        const login = await run(binary, ["login", "status"], { env, timeoutMs: 8000, platform });
        value.loggedIn = login.code === 0 && /logged in/i.test(`${login.stdout}\n${login.stderr}`);
      }
    } catch {
      /* Report not installed / not logged in; never throw from a health probe. */
    }
    cached = { at: now(), value };
    return value;
  }

  /** Last known state without spawning anything; refreshes in the background when stale. */
  function peek() {
    if (!cached || now() - cached.at >= STATUS_TTL_MS) void status({ force: true });
    return cached ? cached.value : null;
  }

  async function ensureCodexReady({ force = false } = {}) {
    const state = await status({ force });
    if (!state.installed)
      throw Object.assign(new Error("CODEX_NOT_FOUND: Chưa tìm thấy Codex CLI. Cài Codex rồi mở lại app."), {
        code: "CODEX_NOT_FOUND",
        status: 503,
      });
    if (!state.loggedIn)
      throw Object.assign(new Error("PROVIDER_AUTH: Codex chưa đăng nhập. Chạy `codex login` trong Terminal rồi thử lại."), {
        code: "PROVIDER_AUTH",
        status: 401,
      });
    return state;
  }

  /** Same result shape as the former OAuth transport. `images` are absolute PNG/JPEG paths. */
  function analyzeWithCodexPlan(body, signal, content, reasoningPolicy, images = []) {
    const task = queue.then(() => execute(body, signal, content, reasoningPolicy, images));
    queue = task.catch(() => {});
    return task;
  }

  async function execute(body, signal, content, reasoningPolicy, images) {
    signal?.throwIfAborted();
    const model = body.model || ANALYSIS_MODEL;
    if (model !== ANALYSIS_MODEL)
      throw new Error(`MODEL_UNAVAILABLE: App đã chốt ${ANALYSIS_MODEL}; không tự chuyển model khác.`);
    const effort = reasoningPolicy?.effort || ANALYSIS_REASONING;
    if (effort !== ANALYSIS_REASONING)
      throw Object.assign(new Error(`REASONING_CONFIGURATION: Phân tích video chỉ dùng ${ANALYSIS_REASONING}.`), { code: "REASONING_CONFIGURATION" });
    const binary = resolve({ platform });
    if (!binary) throw Object.assign(new Error("CODEX_NOT_FOUND: Chưa tìm thấy Codex CLI."), { code: "CODEX_NOT_FOUND", status: 503 });
    const { tmp } = read() || {};
    const jobDir = await mkdtemp(path.join(tmp || tmpdir(), "codex-job-"));
    const started = performance.now();
    try {
      const rawTxt = typeof body.txtPrompt === "string";
      const schemaFile = rawTxt ? undefined : path.join(jobDir, "schema.json"), outputFile = path.join(jobDir, "out.json");
      if (schemaFile) await writeFile(schemaFile, JSON.stringify(body.schema), { mode: 0o600 });
      const args = codexArguments({ model, effort, schemaFile, outputFile, images, cwd: jobDir });
      const result = await run(binary, args, {
        input: rawTxt
          ? codexTxtPromptText({ prompt: body.txtPrompt, stillsNote: body.stillsNote })
          : codexPromptText({ instructions: body.instructions, content: content || body.input }),
        cwd: jobDir,
        env: environment(),
        signal,
        timeoutMs: Number(process.env.SHORTCUT_CODEX_TIMEOUT_MS) > 0 ? Number(process.env.SHORTCUT_CODEX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS,
        platform,
      });
      const meta = { transport: CODEX_TRANSPORT, exitCode: result.code, providerMs: Math.round(performance.now() - started) };
      if (result.code !== 0 || result.timedOut) throw providerError(classifyCodexFailure(result), meta);
      let text;
      try {
        text = await readFile(outputFile, "utf8");
      } catch {
        throw providerError("PROVIDER_OUTPUT_JSON_INVALID", meta);
      }
      let plan;
      if (rawTxt) {
        if (!text.trim()) throw providerError("PROVIDER_OUTPUT_JSON_INVALID", meta);
      } else {
        try {
          plan = JSON.parse(text.trim());
        } catch {
          throw providerError("PROVIDER_OUTPUT_JSON_INVALID", meta);
        }
      }
      return {
        ...(rawTxt ? { text: text.trim() } : { plan }),
        model,
        reasoning: { requested: effort, actual: effort, source: reasoningPolicy?.source || "owner-pin" },
        serviceTier: { requested: "default", actual: "default" },
        usage: tokenUsage(result.stdout, result.stderr),
        transport: CODEX_TRANSPORT,
      };
    } finally {
      await rm(jobDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  return { status, peek, ensureCodexReady, analyzeWithCodexPlan, resolveBinary: () => resolve({ platform }) };
}
