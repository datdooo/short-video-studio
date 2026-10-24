# Beta 1105 packaging handoff — 2026-10-24

Version `1.1.0-beta.1`, build `1105`, macOS arm64. Source branch
`beta/maintenance`, parent checkpoint `0708d250a98a252996b3f2f41ba66d433301547a`.
The exact packaging checkpoint is embedded as `commit` in app config.json.

Targets: fixed `release/beta/ShortCut Studio Beta.app` and
`/Applications/ShortCut Studio Beta.app`. Retain the previous release bundle
and previous installed bundle for rollback. Never stop an active app automatically.

Includes all inherited 1104 changes plus the source fixes documented in
`BETA-PROJECT-SWEEP-2026-10-24.md` and
`BETA-UI-PROGRESS-REVIEW-2026-10-24.md`: media HTTP streams/ranges, JSON error
handling, bounded polling/auth lifecycle, subtitle cancellation, Batch cancellation,
music publication/audition/list refresh, library scan memoization, manual browser
bridge lifecycle, analysis cache ownership, progress labels/stopping state,
footer error details and narrow drawer keyboard isolation.

Mandatory frontend compilation, standalone runtime packaging, native dependency
audit and strict deep ad-hoc codesign remain enabled. Static verification compares
source/runtime modules, relative worker import closure, fonts, extension and
compiled UI markers. Installed bundle must match the verified release bundle.

Beta profile, ports 5373/8987, support/data root and credential namespace remain
unchanged. No user data or credentials are copied or modified. DEV and production
are untouched. Windows installer remains the earlier build.

No tests, live AI, ASR, video download, render or browser automation are run.
Build/static success does not establish UI/runtime correctness, render quality,
provider operation or performance. Manual acceptance remains required.
