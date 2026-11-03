# Beta maintenance rules

- Read AGENTS.md first. This checkout is ShortCut Studio Beta, branch `beta/maintenance`; verify cwd, HEAD, status and diff before edits.
- DEV is a separate checkout. Do not follow historical DEV paths/profile instructions in archived reports or merge Beta wholesale into DEV/main.
- Use Node 22. Beta ports are 5373/8987; app is `release/beta/ShortCut Studio Beta.app`. Preserve Beta data root; never read/copy credentials or write DEV/production data. ChatGPT Auto uses user-installed Codex CLI (`codex login`, `codex exec`), model `gpt-6.1-sol` / `low`; in-app OAuth and its credential store are removed.
- Current architecture and verified limits: `docs/work-order-2026-11-03.md`, `docs/test-baseline-2026-11-03.md`; package provenance: `docs/releases/beta-1124.md`.
- Preserve drafts, manual edits and existing changes. No reset/clean/amend/merge/push or installed-app update without user authorization. Never kill an app with unsaved work.
- Reuse current domain hooks/routes/render modules; preserve source timestamps, AI criteria/model/reasoning and engine unless explicitly requested.
- Follow the user's latest limits on tests/build/render/network. Use focused synthetic checks for small fixes and report actual results, not assumed runtime/CI success.
