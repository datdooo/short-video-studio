---
handoff_version: 1
verified_date: 2026-10-18
repository: /Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev
branch: feature/visual-preset-engine
implementation_head: 37ac963
initial_worktree: six_inherited_modified_files_at_558ad67
rc_status: qualified_baseline_6ffd2d4_new_teaser_AI_verification_pending
smart_auto_cut_status: foundation_A_B_and_teaser_extension_present_C_to_H_incomplete
next_task: finish_teaser_web_and_real_video_qualification
---

# Gemini / Antigravity handoff

Latest approved task: finish per-part teaser hooks end to end. Follow
`docs/teaser-hooks-qualification.md` (supersedes the original blocked status in
`docs/per-part-teaser-hooks.md`). DEV Keychain HOME resolution is fixed; user
sign-in and real ChatGPT `gpt-6.1-sol` two-part hook QA pass. Gemini/Muse use
validated external imports, with separate verification status. No inference
about their functionality follows from GPT success. No unrelated C–H or Sports
Voiceover. Preserve qualified visual behavior and current work.

## Current return state — supersedes the original snapshot below

Codex resumed on 2026-10-18 at `558ad67` with six modified files. Gemini history
after `14cfb87`: `88908de` RC report/READY verdict, `81d2b09` SourceContext A,
`558ad67` comment signals B. Inherited corrections were preserved and tested,
then checkpointed separately in `37ac963`. A/B are foundation modules, not yet
connected to the existing Auto/Semi-Auto planner; C–H remain unimplemented.
No Sports Voiceover work is authorized by the current RC task.

Rebuilding exposed a missing packaged SourceContext dependency, now fixed in
`scripts/package-macos.mjs`. The prior "live" QA script was HTTP-only. The new
`scripts/qa-rc-packaged-ui.mjs` exercises real packaged UI→worker exports.
Current regression: 230/230 tests, isolation15/15, lint/TS pass. RC now passes for
macOS DEV Visual Editor: five real native UI jobs/10 MP4s, one default-CPU UI
job/two MP4s, 42 exact Current decoded-moment hashes, queue/recovery and timing
checks. Exact evidence and limitations: `docs/final-visual-editor-qualification.md`,
section "Codex return audit". C is the next feature checkpoint when requested;
this return task ends at RC. No Sports Voiceover work was added.

## Original handoff snapshot at `14cfb87` (historical)

The original handoff added documentation after implementation HEAD
`1b5700e2f1f29a2fdd128e3439a45ab8fc374d5b`; that initial worktree was clean.
Resolve the current HEAD with `git rev-parse HEAD`; do not reset to the old SHA.
No application QA was run during this handoff. Architecture below was checked
against source; historical results are recorded evidence, not newly rerun checks.
Skill frontmatter received basic local checks; the bundled skill validator could
not run because Python lacks PyYAML. Antigravity skill auto-discovery has not been
tested; open the two SKILL.md files directly if necessary. They are explicitly
tracked exceptions to the repository's ignored `.agents/` directory.

## Verified checkpoints

| Recent commit | Meaning |
| --- | --- |
| `1b5700e` | Honest unfinished RC qualification checkpoint |
| `e5e488d` | Measured improved FHD encoding defaults |
| `026b1ea` | Compact seven-row Customize UI, existing handlers reused |
| `7cb2bcf` | Animated export final-frame/audio-tail fix |
| `86889dbe843b45c40b129892751b97f5cc33e784` | Phase 9 curated cut transitions |
| `76aad14e3d9e1d593b3df730c77232a517359810` | Phase 8 curated title animations |
| `7abe5f2` | Phase 7 full visual templates |
| `9e69e14` | Phase 6 static overlays |
| `98b6c13` | Phase 5 backgrounds |
| `fb351e5` | Phase 4 filters |

Earlier completed: Phase 1 DEV isolation `ba82f951fbade4289597fbb3163c6f13cad7ff8c`;
Phase 2 VisualStyle `6755f7f79dd78b6d700d39ab44781789bb85da49`;
Phase 3 fonts/text `8e813ba`. Stable historical production reference:
`stable-v1.1.0-before-visual-editor` → `255a23cf2a1ae128066f2bbaa6e91daca998e6ea`.
This tag identifies history, not a newly audited installed production build.

## Environment and safety

| Contract | Value |
| --- | --- |
| DEV identity / bundle ID | ShortCut Studio Dev / `local.datdo.shortcutstudio.dev` |
| DEV web / worker | `5273` / `8887` |
| DEV media root | `/Users/datdo/Library/Application Support/ShortCut Studio Dev/media` |
| DEV package | `release/dev/ShortCut Studio Dev.app` (run in place; never install) |
| Node | 22; `PATH="/opt/homebrew/opt/node@22/bin:$PATH"` |
| DEV credentials/runtime isolation | Separate Keychain service `ShortCut Studio Dev ChatGPT`; private child HOME/XDG/TMP; `MEDIA_WORKER_DISABLE_LEGACY=1` |

Never modify main, `/Users/datdo/Documents/tiktok-edit/short-video-studio`,
`/Applications/ShortCut Studio.app`, production Application Support/credentials or
ports **5173/8787**. No reset/amend/merge, tag moves, unrelated Homebrew changes,
messaging integrations or unrelated features. Preserve dirty work if encountered.
Verify listener PID/command before stopping only owned DEV processes. Follow
`docs/dev-isolation.md`; DEV must not inherit production `existingDataRoot`.

## Architecture contracts today

- `app/page.tsx` owns plan state. Subtitle controls derive from effective style;
  handlers update canonical style and the legacy subtitle alias atomically.
  Templates stay visible above default-collapsed Customize; seven existing controls
  stay mounted. Disclosure state does not duplicate visual configuration.
- `lib/visual-style/normalize.mjs` is the fresh-copy, allowlisted v1 boundary.
  Shape: `version:1`, `presetId:"current"`, optional `textPresetId`,
  `originalTitle`, `partTitle`, `partIndicator`, `subtitle`, `foreground`,
  `background`, `filter`, `overlays`, optional `titleAnimation`, `cutTransition`.
  Text fields carry existing font/size/color/outline/layout/effects; foreground
  uses native-center-crop-pad. See `types.ts` for exact nested unions.
- Templates are frozen ID recipes applied through existing helpers. Effective
  normalized style persists; selection derives from matching. Subtitle enabled/
  source and independent animation/transition survive template changes. Matching
  excludes those operational/independent fields; visual mismatch means Custom.
- One worker renderer: trim/fps/audio → concat → filter → background/foreground →
  scene decoration → internal cut ramp → titles/indicator/shine/entrance →
  subtitles → final speed/color/encoding. Static PNG assets and FFmpeg expressions;
  no second renderer. Default output 1080×1920, 30fps, speed 1.25.
- Encoding defaults: libx264 CRF17/medium; VideoToolbox 16M target/20M max/32M
  buffer; H.264 yuv420p Rec.709, AAC192k. Environment overrides/fallbacks remain.
  Active animation uses final fps `eof_action=pass` without global `-shortest`;
  historical None path stays compatible.
- `snapshotPlanVisualStyle` clones plan/style/subtitle alias. Submission preparation
  FIFO (`worker/batch-queue.mjs`) is separate from serial render FIFO in server.
  Jobs receive independent complete plans/styles; later editor changes do not leak.
  Worker `batch-history.json` persists jobs/batches; interrupted restored jobs are
  cancelled, not a resumable multi-signal analysis pipeline.

## Auto / Semi-Auto / multi-link as implemented today

`lib/edit-plan.ts` builds transcript-driven prompts using title, timestamped cues,
duration and user instructions. ChatGPT account mode calls `/api/chatgpt/analyze`;
Gemini/Muse web-provider paths use prompt/copy/paste plan JSON. AI plans require
two parts, each >60 seconds after speed, with ten hashtags each; manual/mock
exceptions and Custom Time remain. This is not the proposed multi-signal engine.

`worker/smart-cut.mjs` only refines existing plan boundaries using sentence cues
and silence, within bounded nearby windows; it preserves order/hook constraints,
avoids repeated application and validates duration. `worker/speech.mjs` reuses
YouTube cues or local Whisper/cache; boundary cache uses FFmpeg silence detection.
No semantic candidate ranking, reaction scoring or vision exists here.

Current multi-link UI uses `/api/batches` and ChatGPT planning. `prepareBatch`
serially imports each YouTube link, requires its transcript, substitutes title/
duration/transcript into the prompt, analyzes, snapshots style and queues renders.
Item errors are isolated; missing transcript fails that item (no batch Whisper
fallback today). Existing history/polling/download/delete/restore are not the
future analysis resume/retry/cache design. No cross-source footage composition.

Reuse `worker/youtube-downloader.mjs` and existing fallback modules. yt-dlp already
writes info JSON and queries metadata; metadata requests have bounded in-memory
cache/dedup and oEmbed fallback. Planner consumption is currently title/transcript/
duration, not a normalized SourceContext consuming comments/heatmap/vision/audio.

Legacy: missing styles normalize to Current; missing animation/transition means
None. Legacy subtitle alias has precedence when supplied. Old history is not
rewritten. Unsupported reserved overlay descriptors are rejected at rendering.

## RC evidence, limitations and exact unfinished work

Authoritative checklist: `docs/final-visual-editor-qualification.md`. Recorded:
193/193 full tests after timing fix **before final encoding defaults**; 15/15
isolation at RC start; latest focused 31/31; UI lint/TS passed. Source phase3–9
and integrated 16-job/32-MP4 synthetic matrices passed. Browser mutations were
mocked; these are not real GUI-to-worker export proofs. Existing package predates
final encoding defaults. Do not claim final readiness.

Remaining, in order:
1. Fresh `npm run package:mac:dev` under Node22; signature/identity/config,
   runtime/public freshness, offline DEV bootstrap/storage isolation.
2. Integrated source/package CPU parity and actual native VideoToolbox matrix;
   separately test real CRF17/medium defaults (parity harness overrides18/ultrafast).
3. Real packaged UI→worker JP/KR/Latin workflows, independent queue/batch snapshots,
   restart/delete/restore new-field retention and MP4 playback. A real user-trial
   harness has not been implemented. Same-active-source render is disabled by
   design; use next-source/API FIFO flows rather than inventing new UI.
4. Editor queue/cancel/restore/restart with explicit DEV `QA_RUNTIME_BIN`; final
   full tests/lint/TS and controlled full-job legacy vs integrated performance.
5. Record truthful readiness verdict, commit RC checkpoint, leave clean tree.

Important: `scripts/qa-editor-renders.mjs` defaults to the production runtime path;
**always override** `QA_RUNTIME_BIN` with this DEV bundle's absolute
`Contents/Resources/runtime/bin`. Existing harness ports8897/8788 are QA-only;
check listeners. Never use production resources to satisfy QA.

Preserved local ignored `.isolation-verification/` includes
`rc-integrated-renders.mjs` (`--packaged`, `--native-smoke`, `--performance`),
`rc-integrated-source-kBS29F/result.json`, quality evidence and TAP/logs listed in
the RC report. These artifacts are absent from fresh clones; recheck availability.
Run performance alone. Local Playwright installation is host-dependent.

Limitations: generic HTTP500 validation rejects, unchanged yt-dlp health-probe
issue (out of scope unless regressed), inherited static cut presentation offset.
Final packaged defaults, real ASR/AI/multi-link, public-video comparisons/ablation,
Windows and reliable memory peaks remain unqualified. Synthetic caption evidence
does not establish speech-recognition accuracy.

## Resume efficiently

Read `GEMINI.md` → this file → `docs/next-agent-task.md`; consult the architecture
map and `rg` targeted symbols. Do not recursively read the repository or reread
old phase docs unless investigating a regression. Important references:
`docs/dev-isolation.md`, `docs/final-visual-editor-qualification.md`,
`docs/export-quality.md`, `docs/visual-style.md`, `docs/visual-templates.md`,
`docs/text-animations.md`, `docs/cut-transitions.md`.

Important checks: `npm run test:isolation`; `node --test lib/*.test.mjs
worker/*.test.mjs desktop/*.test.mjs`; `npm run lint`; `npx tsc --noEmit`.
Focused registry/render tests and QA scripts are indexed in the architecture map.
These are resume instructions, not checks executed by this documentation task.

After a clean RC verdict only, use `.agents/skills/smart-auto-cut/SKILL.md`.
All future checkpoints are unstarted: A SourceContext/metadata/description/chapters;
B comments/timestamp clustering; C heatmap; D candidates/fusion; E vision/audio;
F single Auto/Semi integration; G multi-link integration; H qualification.
No SourceContext, multi-signal candidate/fusion model, heatmap, comment analysis,
vision integration or analysis-resume engine has been implemented. Work one
coherent checkpoint/commit at a time; avoid repeated full-project summaries.
