# DEV gentle music expansion — 2026-10-20

Base3708a4d, recovery/visual-dev-reconstructed. User requested30–50 actual new
compressed tracks, <=approximately300MiB acquisition, >=70% gentle/general-purpose,
no vocals/rap/voice samples, clear commercial social-video licensing with preference
for no mandatory credit. User will audition; no automated QA or render requested.

## Source and honest screening

Composer-direct individual MP3 downloads from Liborio Conti:

- https://www.no-copyright-music.com/relaxing/
- https://www.no-copyright-music.com/corporate/
- https://www.no-copyright-music.com/happy-inspirational/
- License: https://www.no-copyright-music.com/wp-content/uploads/2023/03/LiborioContiLicense.pdf

The published license permits personal/client/commercial monetized video projects
without mandatory attribution. It prohibits music redistribution, resale,
re-licensing and claiming ownership/registering the music in Content ID. Audio is
therefore installed only in this user's DEV library, never the source repository,
Git, app bundle or a redistributed music collection. Catalog URLs and licensing
metadata alone are versioned. The artist's marketing statements about copyright
claims are not a guarantee; platform claims/Content ID remain possible.

Selection uses official relaxing, light corporate and acoustic catalog/title
information, avoiding known voice-labelled items, horror/action/EDM/comedy themes,
bilateral/432Hz variants and overly long tracks. This is **metadata screening**,
not an audition or proof of instrumental purity, even pacing or taste suitability.
No track is marked auditioned or instrumentalVerified. No speech/VAD shortcut is
used to pretend to detect vocals. The user must listen and reject any uncertain
or unsuitable track. The group label represents intended use, not certification.

## Acquisition and library behavior

`lib/music/gentle-collection.mjs` lists32 selected distinct source URLs,28 intended
for “Nhẹ nhàng / Đa dụng” and4 acoustic/vlog candidates. This is not just a link
catalog: `scripts/install-gentle-music.mjs` downloads and calls the existing
`createMusicLibrary().import`, which checks/probes/decodes as part of normal import,
keeps compressed MP3 bytes and deduplicates by SHA256. It does not change the
library's128-track/1GiB bounds or transform export quality.

The installer is explicitly DEV-path guarded, sequential, abortable, per-request
bounded and accounts for up to300MiB total audio download bytes (including a
previous run's report). Existing hashes/catalog IDs are reused without replacing
metadata/audio. Existing selected track IDs and plans are never edited. Source,
license URL/date/PDF hash, catalog ID, mood, official-download provenance and
`auditioned:false,instrumentalVerified:false` are retained in internal asset JSON.
No credit block is reintroduced in UI or automatically added to video/caption.

Task intermediates are in the ignored
`.isolation-verification/gentle-music-20261020/`; successfully imported/duplicate
files are removed immediately, while license evidence and concise report remain.
Any failed incomplete intermediate is reported and retained unless safely removed
as task-owned data; unrelated download caches/media/exports/backups stay untouched.
No automatic startup acquisition, new cloud service, paid subscription or dependency.

`components/music-panel.tsx` orders installed “Nhẹ nhàng / Đa dụng” assets first
in mood/group/per-part choices without changing settings or selecting a new track.
Search, import, refresh, audition, gain, ducking and preview/export handlers remain.

## Actual result

Completed: **32 new tracks**, **86 total** (was54).

| Measure | Actual |
| --- | --- |
| Library logical bytes before | 256293583 |
| Library logical bytes after | 479384591 |
| Added library bytes | 223091008 (212.76MiB) |
| New audio bytes downloaded | 223045677 (212.71MiB), below300MiB |
| New intended gentle/general tracks | 28/32 (87.5%) |
| Failed imports / duplicate new files | 0 /0 |
| Remaining task MP3 intermediates | 0 |
| Auditioned / instrumental-verified | 0 /0 |

All32 new internal asset records retain official source/license URLs, PDF hash,
date and explicit unverified listening flags. The local/ignored installation
report and composer license PDF remain in
`.isolation-verification/gentle-music-20261020/`. Existing54 assets and track
selections were preserved by hash-aware import (no selection-setting writes).

No sampled/full-track listening, instrumental certification, browser automation,
QA render or provider request was performed. The importer's ordinary ffprobe/full
file decode is format validation, not listening or editorial QA. Logical byte
deltas are not an APFS free-space-recovery claim. The existing compressed-track
loop seam limitation remains unchanged; no new seamless-loop claim.

## Combined DEV build

PASS: one combined Node22 `npm run package:mac:dev` invocation completed with
exit0. Output: `release/dev/ShortCut Studio Dev.app`. Build log (local, not tracked):
`/tmp/shortcut-dev-main-ranges-gentle-music-build-20261020.log`.
Frontend/native launcher/runtime packaging and packager signing completed. No
app launch, test, standalone lint/typecheck, QA render, browser automation or AI/
YouTube verification followed. Build success is not functional qualification.
User manual acceptance is pending; current app was not interrupted.
