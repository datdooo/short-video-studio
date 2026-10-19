---
name: release-candidate
description: Finish the existing ShortCut Studio DEV release-candidate qualification, package and live workflow checks without adding features. Use the recorded unfinished RC checklist and strict production isolation.
---

# Release Candidate qualification

Read `GEMINI.md`, `docs/agent-handoff.md`, `docs/next-agent-task.md`, then only
unfinished items in `docs/final-visual-editor-qualification.md`.
No new features, Smart Auto Cut implementation or unrelated refactor during RC.

Work only in the documented DEV worktree/branch. Use Node22. Never access the
production app/runtime/data/credentials or ports5173/8787; never install DEV.
Verify process ownership before stopping DEV listeners. Use private QA fixtures.

Rebuild only when changed runtime/frontend code or an explicitly requested RC
check requires it. Preserve the latest usable app until the new build passes smoke.
For a requested build from the DEV repository root:

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run package:mac:dev
```

Verify fresh signature/identity/config/assets and offline DEV bootstrap; run
`release/dev/ShortCut Studio Dev.app` in place. Complete source/package CPU and
native VideoToolbox parity plus actual final encoding defaults. Existing parity
harness CRF18/ultrafast is not a defaultCRF17/medium qualification.

Finish actual packaged UI→worker JP/KR/Latin exports, queue/batch snapshots,
cancel/restart/delete/restore and playback. Do not mistake mocked browser mutations
for real exports. `scripts/qa-editor-renders.mjs` has a production runtime default:
always set `QA_RUNTIME_BIN` to the DEV package's absolute
`Contents/Resources/runtime/bin`. Check QA port ownership first.

For a requested full RC qualification, final checks under Node22: `npm run test:isolation`;
`node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs`;
`npm run lint`; `npx tsc --noEmit`. Use focused tests for any blocker fix before
the final suite. Complete controlled full-job performance from the RC report.
Preserve evidence; distinguish historical/new, synthetic/real, CPU/native results.
Record limitations and truthful readiness verdict, commit a coherent RC checkpoint
and leave a clean tree. Smart A–G already have implementations; do not start
unrelated feature work from this qualification skill. Current user scope controls
whether a focused check or the full RC checklist is appropriate.
