// Official Antigravity PreToolUse hook. Finish is inert; all external actions are denied.
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 1024 * 1024) break;
}
let name;
try { name = JSON.parse(input).toolCall?.name; } catch { /* Fail closed. */ }
process.stdout.write(JSON.stringify(name === "finish"
  ? { decision: "allow" }
  : { decision: "deny", reason: "ShortCut Studio only analyzes the supplied transcript. No filesystem, command, browser, MCP or delegation tools are permitted." }));
