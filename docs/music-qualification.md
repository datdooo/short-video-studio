# Current integration qualification — 2026-10-20

Read `docs/adaptive-teaser-qualification.md` for this update. Historical results
below remain unchanged. Current library54 installed /0 audition-verified /54
uncertain,26 bounded download failures. Source editor music Generate/both-parts/
seek/pause/workspace/regenerate and real MP3 mix checks passed. New warm effect
is foreground-only; legacy rainbow remains available. Current limits128tracks/
1GiB, partial acquisition cache512MiB; no automatic user music deletion.

---

# Music / ducking / rainbow / hook distance — DEV qualification

2026-10-19, `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`,
branch `recovery/visual-dev-reconstructed`; began clean at `179edf2`.
Implementation `186e01a`; preview lifecycle repair `d9911f4`. Final documentation
HEAD is `git log -1`. Updated app is ready for user acceptance, with limits below.
No production install, push, merge, new provider call or YouTube campaign.

## Delivered behavior

- Managed hash-deduplicated local music, default OFF, first enable15%, linear0–100%
  amplitude,0% added silence/100% unity prepared track. Grouped local/catalog picker,
  audition, import and optional per-part track override. Eight official Mixkit title/
  artist/duration/license-link records; **0 installed/verified instrumental tracks**
  in normal DEV. No stock audio was downloaded, auditioned, bundled or committed.
- Local WebRTC GMM VAD + bounded broadband-noise guard;53,014-byte WASM package
  (76KiB apparent installed directory), no large model/cloud/speaker ID. Actual
  shipped engine BSD3-Clause LICENSE/AUTHORS/PATENTS retained despite package MIT
  metadata. Full source <=30min/90s; transient PCM <=57.6MB; cached detector/source
  identity, not volume/style. Unavailable means manual gain with visible limitation.
- Music-only−12dB,100ms pre-roll,50ms attack,300ms hold,600ms recovery; windows merge
  to avoid word gaps pumping. Speech maps retained cuts/padding/hooks at1.25× to
  output time. Music remains normal pitch/speed, continuous and restarted per part.
- Export and rendered-audio preview reuse music gain/headroom/fade/loop helper.
  Source gain stays unchanged; only added music is bounded to available sample
  headroom. Canonical stereo is explicit for AAC. Infinite silent pad on music
  prevents it ever ending/truncating the finite original branch. Current FHD,
  VideoToolbox16M / CPU CRF17 and AAC192k settings are unchanged.
- Original procedural RGB screen rainbow wash under text,0.6s at hook→main with
  clamping and same Canvas bloom math. Hook selector independent of ordinary cuts.
  Fresh teaser policies default rainbow; legacy policies retain historical
  Dip/Flash inheritance, explicit None stays None. No Adobe asset/parity claim.
- New `later-main-v1` selections exclude the first10 rendered MAIN seconds across
  retained non-padding cuts; source gaps do not count. AI/fallback/web prompts and
  imports share permitted intervals. No coherent later cue → explicit unavailable,
  main-only export. Old opening hooks load/flag for explicit reselection; jobs are
  never silently rewritten. Main content/manual locks are preserved.

Architecture, exact schemas, sources/licenses and reuse record:
`docs/background-music.md`. No new audio framework or renderer/download stack.

## Checks actually passed

| Check | Evidence/result |
| --- | --- |
| Full `node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs` | **327/327**, zero failures/skips; `/tmp/shortcut-music-all-final.tap` |
| TypeScript / lint | Node22 `npx tsc --noEmit`, `npm run lint` pass; `/tmp/shortcut-music-{types,lint}-final.log` |
| Focused settings/distance/library/cache contracts |13/13; includes malformed settings, legacy OFF, mute/headroom, immutable snapshots, managed path/symlink/hash checks, failed temporary cleanup, same audio cache across style, cancellation and source/gap distance |
| Local speech→pause→speech | macOS TTS actual spoken waveform,3s pause: detected speech on both sides, pause clear |
| Natural speech evidence | Existing local `real-building-200s.mp4`, Vietnamese narration; available,3 merged intervals,9 detected speech seconds overlapping known158–167s speech; no raw audio/provider upload |
| Loud non-speech | Silence, loud1kHz tone, loud white noise each0s in final detector; raw WebRTC initially falsely marked white noise and prompted the documented guard |
| Actual audio mix | Added-music duck/normal RMS ratio0.25118863 (−12dB), pause ratio1.0; muted output equals original float reference exactly, mixed output matches original+bounded music within2.98e−8 amplitude |
| Audio continuity | Loop/fade, repeated later hook plus original occurrence, no-source-audio mix and complete tail pass; transient fixtures removed |
| Source UI + real FFmpeg export | Import, play/pause/audition, no volume-triggered VAD/AI;40% job snapshot retained when editor moved to5%; two1080×1920 outputs,606 frames each, duration/audio20.221771 /20.214083s; CJK titles and rainbow frame inspected |
| Single DEV package build | Package complete;44 native binaries audited, dependency closure and ad-hoc deep signature verified; VAD WASM and legal notices present |
| Packaged UI | Real bundled VAD invocation, native mixed-audio playback, pause/audition, seek12s→1s across repeated hook mapping, volume isolation, workspace switch stops preview; zero browser errors |
| Normal app launch | Web200, worker OK; actual data root `/Users/datdo/Library/Application Support/ShortCut Studio Dev/media`, not private QA HOME; normal library0 assets /8 links |

Reports/screenshots/short procedural clip are retained under
`.isolation-verification/music/`: `audio-report.json`, `source-ui-report.json`,
`packaged-ui-report.json`, `cjk-leak.png`, phase editor images, transition frames,
`light-leak.mp4`, `normal-launch.json`, `cleanup.json`. These are ignored local QA,
not user media or committed artifacts. No music taste or new live-provider quality
is established by fixture responses. The saved packaged report field named
`unmountStopsAudio` tested workspace hiding (editor stays mounted); the reproducible
script now calls that assertion `workspaceSwitchStopsAudio`.

## Demonstrated fixes / qualification limits

- Initial Web Audio graph clock stalled at0.0107s despite running/ready media in
  Chromium. It was removed; native playback of worker-rendered audio passes. The
  underlying Chromium/driver cause is unproven, not guessed as a native app fault.
- AAC rejected an unspecified two-channel layout; explicit canonical stereo fixed
  it. A 2fps fractional-hook fixture exposed0.2s AV-concat padding; new-policy
  segment bounds now keep606 frames and tail within a frame of20.2s. Old-policy
  render behavior is preserved.
- Switching to Batch hides rather than unmounts editor. Explicit workspace change
  now stops both videos and mixed preview. Preview preparation failure restores
  source playback with an actionable limitation.
- One package/runtime build was followed by a frontend-only repair for that smoke
  finding, re-audit and re-sign. A mistakenly unprofiled frontend build was
  discarded before copying/launching; the correct DEV standalone output was used.
  No production listener/request was started. Runtime binaries were not re-bundled
  or downloaded again. Prior usable app remained until final smoke passed.
- Earlier UI harness failures (inspector response eviction / two Play buttons) were
  corrected without weakening behavior assertions. UI failure reports/screenshots
  remain timestamped. Synthetic/TTS and natural-source evidence are distinguished.
- VAD can still mistake complex music/noise for speech or miss unvoiced speech.
  No benchmark/calibrated accuracy, broad human editorial listening, fresh GPT/
  Gemini/Muse selection verification or full historical RC matrix is claimed.
- Native audio preview is prepared asynchronously/debounced180ms; volume changes
  may take a short preparation delay. Cache/storage/timeout errors are visible.
  Stock-track instrumental verification and final taste/mix/effect aesthetics are
  pending user audition/acceptance, not silently treated as complete.

## Storage and recovery

Observed free filesystem at start77,200,000KiB; after cleanup77,600,000KiB, before
new bundle. Global/APFS free-space changes are not task-exclusive reclaimed space.
Before packaging release/dev1,346,996KiB; after1,354,176KiB, including the latest
276,964KiB app and four preexisting stages intentionally retained. Added dependency
76KiB apparent; concise music QA3,116KiB. No normal DEV stock music was installed.

Removed only owned successful/failed QA data and generated build artifacts:
previous-package staging269,784KiB, compiler scratch136,724KiB, generated repo
`dist`123,208KiB (app copy verified independent) and roughly40,376KiB private QA
HOME before package smoke. Combined measured apparent size ~570,092KiB (~556.7MiB);
this is not an APFS physical-reclamation claim. User sources, exports, plans,
credentials, old QA/recovery archives and four prior stages were not deleted.

Caches: VAD24MiB/14days/512 entries, preview128MiB/14days/64 files with active-session
leases; music library32 tracks/512MiB, no automatic track deletion. Protected data
fills budget → refuse/skip new cache writes. Temporary PCM/import/M4A files clean
on success, failure and cancellation. No full-video intermediate was retained.

Updated branch/history bundle (outside DEV):
`/Users/datdo/Documents/tiktok-edit/short-video-studio-dev-bgm-20261019.bundle`.
Created after final documentation commit; verify record in ignored
`.isolation-verification/music/bundle-report.json` includes bundle SHA256/HEAD and
independent bare-clone `git fsck --full`. It preserves reconstructed history; it
cannot recover the21 unavailable original local checkpoints. Existing backups stay.

## User acceptance

Open in place:
`open "/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev.app"`

1. Download an individual candidate through its official Mixkit page, audition for
   singing/spoken/vocal samples, verify rights and import. Alternatively import your
   own licensed music. Catalog association alone does not verify acoustic identity.
2. Enable BGM, test15%,0%,40%, duck ON/OFF on real speech and noisy/non-speech footage.
   Check pauses, recovery, both parts, audition exclusivity and output seek.
3. Select/reselect a hook later than10 rendered main seconds; verify the original
   occurrence remains later and main/manual locks are unchanged. Old opening hooks
   should warn; explicit reselection is required.
4. Compare Rainbow / Dip / Flash / None at hook→main, leaving internal transitions
   independent. Check CJK/title/subtitle readability and subjective smoothness.
5. Queue a job/batch, change editor track/volume, reopen history and export/playback;
   verify independent snapshots, missing-track errors, duration and complete tail.

The normal DEV app is left running. Production app/data/ports, other projects,
credentials and recovery backups were untouched. No push/merge/production install.
