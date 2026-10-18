# DEV workspace cleanup — 2026-10-18

Feature development is paused. Work was limited to
`/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.

## Git blocker predates cleanup

The checkout exists, but `.git` is a file pointing to
`/Users/datdo/Documents/tiktok-edit/short-video-studio/.git/worktrees/short-video-studio-visual-dev`.
That directory and its parent checkout no longer exist. `git branch
--show-current`, `git rev-parse HEAD`, `git status --short` and `git worktree list
--porcelain` all fail with “not a git repository”.

Expected branch: `feature/visual-preset-engine`. Last recorded pre-cleanup base:
`ea86de7f49ead566ed9d4adec77eb894c4174615`; these are historical context, **not a
verified current branch/HEAD**. No Git init, reset, clean, prune, garbage collection,
branch deletion or commit was performed. Commit history cannot be verified from
this broken pointer. Restore the missing Git store from a verified backup before
assuming normal Git operations are possible. Do not initialize a replacement
repository and describe that as history recovery.

## Space and disposable artifacts

`du -sk` allocated workspace size: **14,782,521,344 → 3,777,257,472 bytes**
(13.77 → 3.52 GiB), net reduction **11,005,263,872 bytes / 10.25 GiB**.
Filesystem free space rose 82,739,200,000 → 93,388,800,000 bytes during this work.
The latter is a system-wide observation affected by other activity/APFS; it is
not an exact attribution to individual removed files. Final small documentation
and audit additions can change these measurements by a few KiB.

Removed only validated reproducible artifacts:

- 26 `release/dev/.build-*` staging directories: old `previous-build.app`,
  abandoned DEV staging apps, or empty directories. Their DEV config was checked;
  the latest app passed deep strict codesign verification before deletion.
- 1,557 generated synthetic QA media files, 3,431,993,311 content bytes. Uploaded
  fixture copies were verified byte-for-byte against the scripted synthetic
  fixture before removing their synthetic render derivatives. Report paths to
  those media files are intentionally historical after cleanup.
- 94,157 disposable `.cache-12` font cache files, 270,012,856 content bytes, only
  under QA `font-cache`/`fontconfig` directories. Symlinks were never followed.
- Root `dist` (119,025,664 allocated bytes), a reproducible build independent of
  the self-contained latest app. Source development/build dependencies remain.

No generic `rm` glob or repository-wide cleaner was used. The local audit rejects
wrong roots, symlink traversal, changed inputs, live stage references and recovery
archive overwrites. Path/hash manifests are retained. No media or cache in normal
DEV Application Support was removed.

## Preserved

| Item | Approximate size | Reason |
| --- | --- | --- |
| `.isolation-verification` | 2.24 GiB | Original baseline code/assets, reports, screenshots, failure evidence and real media; important while Git history is unavailable |
| `node_modules` | 946 MiB | Required source dependencies; no reinstall |
| `release/dev/ShortCut Studio Dev.app` | 263 MiB | Latest usable self-contained DEV package, retained in place |
| `.local-tools` | 71 MiB | Required yt-dlp tooling/bundle; retained |
| External DEV Application Support | 2.48 GiB | User sources, exports, saved plans/history and application state, untouched |

All source/unfinished implementation files were hashed before and after cleanup
and matched. The only later intentional source-tree changes are this report and
the pause notice in `docs/next-agent-task.md`. No product implementation changed.

Additional recovery copies, inside the private ignored audit directory:

- `source-before.tar.gz`: 368 current source/config/assets files, 14,597,692 bytes.
- `old-package-code.tar.gz`: 4,517 older package code/config/frontend/assets entries,
  content-deduplicated, 22,921,582 bytes. Reproducible bundled runtimes/dependencies
  were excluded. Both archives were fully decompressed/checked before deletion.
- These preserve available files, **not the missing Git object database**.

Preserved all `teaser-finish` evidence, including both video fixtures, prompt
nonces/source contexts, original Muse response, rejected Gemini response, failure
screenshots, snapshots, and test/package logs. The user confirmed Muse received
video plus prompt; this does not establish an API adapter. New valid Gemini output
and final real-video render qualification remain unresolved; no completion claim
was added. See the local `preserved-evidence.md` for the concise evidence summary.

The real 648.58s QA source subtree
`animation-source-nxt3Uh/media/sources/0ca1b9d5-81cf-41a2-99f2-da8b681c0800`
was explicitly protected, including its real media and derivatives. All caption,
job and source metadata, baseline code, QA JSON/TAP/logs/scripts and PNG/contact
sheets remain. Databases, credentials and Keychains were not accessed or changed.

## Processes, launcher and lightweight verification

- No owned DEV app/build/QA/FFmpeg/web/worker process or listener on5273/8887
  existed at the start. No orphan process needed stopping. Chrome, bridge and
  other applications were left alone. No claim of CPU savings from branch deletion.
- Latest app codesign deep/strict validation passes; bundled Node is22.23.3.
  Packaged bootstrap/runtime config/server/credential store/import helper match
  current source byte-for-byte.
- A bounded packaged frontend-only smoke returned HTTP200 on127.0.0.1:5273 and
  stopped cleanly. It did not start the worker, recover jobs, render, call an AI
  provider or read credentials. No DEV listeners/processes remained afterward.
- Source and packaged normal launcher resolve HOME/CFFIXED_USER_HOME to
  `/Users/datdo/Library/Application Support/ShortCut Studio Dev/home`, **not** a
  mock QA HOME. Ports5273/8887, DEV media root, DEV credential service and disabled
  legacy lookup remain correct. The credential-only real-account HOME exception
  from the earlier login fix remains unchanged. No live process environment was
  available to inspect because the app was not running; no full environment dump.
- Focused runtime/credential isolation tests:17/17 pass. Initial sandbox run was
 16/17 because loopback bind was denied (EPERM); permitted rerun passed. Keychain
  operations in these tests are mocked. Unsafe-path/archive-overwrite guards pass.
- No package rebuild, full regression, expensive QA or feature implementation.
  Startup/export reliability beyond this frontend smoke is not requalified here.

## Resume and prevent recurrence

1. Keep feature work paused until requested. Recover/verify Git metadata first;
   do not prune unavailable metadata or assume a clean worktree.
2. Read `docs/teaser-hooks-qualification.md` together with the preserved local
   evidence summary; the older report has pending counts/results. Do not rerun
   paid requests merely to recreate disposable synthetic videos.
3. Packager retains previous builds under `.build-*`; that explains accumulation.
   Future cleanup should use a fresh measured, path-guarded manifest, verify the
   latest app and process references, and retain recovery evidence. This session's
   audit is immutable and refuses to overwrite its preservation archives.
4. Existing `.gitignore` already covers `release`, `dist` and QA scratch; no broader
   ignore rule or automatic deletion was needed. Do not delete user data/cache
   roots, dependencies or runtimes to compensate for stale staging builds.

Audit directory: `.isolation-verification/workspace-cleanup-20261018/`.
Key records: `plan.json`, `result.json`, `final-metrics.json`,
`font-cache-removal.json.gz`, `source-hashes-before.json`, `smoke.json`,
`process-check.json`, `isolation-check.tap`, `safety-checks.json` and
`preserved-evidence.md`. Recovery copies are local, not a remote backup.
