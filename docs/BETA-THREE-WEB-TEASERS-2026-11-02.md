# Three teaser choices per manual-web main — source only

Baseline: `beta/maintenance`, `592eb19a092aec41c7c39e67f6cdb0dfbf216094` (build 1122).

## Finding and scope

The previous active manual policy explicitly requested two choices, made a third optional and allowed one when evidence was insufficient. Separately, import removes duplicate or invalid proposals. Source therefore permits an asymmetric list; the exact reason for the user's latest one-vs-two result cannot be determined without that full JSON and validation outcome.

This change applies to manual ChatGPT/Gemini/Muse full-plan TXT and the existing hook-only prompt helper. Auto/custom AI one-winner requests are unchanged. No model, reasoning, main cut algorithm, durations, citations, manual freedoms or mediaReview gate is changed.

## Changes

- `lib/teaser-import.mjs`: request three distinct, ranked candidates for EACH enabled final main: winner plus two alternatives. Search the whole retained main; quiet material and a good first option do not make the third optional. Never fill three slots with endpoint variants, an event from the wrong part or invented evidence.
- Manual schema requests two alternatives normally. Its explicit genuine-insufficiency branch permits fewer only with a nonempty limitations explanation, keeping prompt/schema consistent and preventing a fabricated third candidate. Existing importer accepts valid older/shorter results; no new count-only blocker, repair or extra AI call is added.
- When import retains fewer than three, its existing limitations/details now state `N/3` valid, how many AI sent and any rejection/duplicate codes. It does not silently claim all three succeeded or retain invalid candidates. The original selected/alternative ranking and source/range/evidence validation remain in place. No extra banner, popup or candidate-list component is needed: the existing review catalog already supports winner plus two alternatives.
- `lib/muse-plan.mjs` and declarations: TXT version v22. Explicit TXT download already regenerates older cached exports rather than re-exporting their old count instruction. Existing plans and saved JSON are not relabeled as a three-candidate result.
- `worker/external-prompt-snapshot.mjs`: reconstruct known v19-v21 teaser rule wording for compatible old-snapshot fingerprint checks. Only the old count/ranking wording is substituted; current shared main, evidence and duration rules still have to match. All source/request/transcript/main/captions/user requirements and analysisKey guards remain exact. No rebinding an old result to new data.

## Acceptance after a separately requested build

1. Generate a new TXT for each manual-web provider: v22, three choices per enabled part, short explanations and matching schema; no viewing declaration requirement.
2. Import three valid, distinct choices per main: each review list shows its winner plus two alternatives; applying any alternative keeps the exact source range/evidence.
3. Import fewer choices or one invalid/duplicate choice: keep supported candidates, show `N/3` with received/rejected counts in details; no fabricated candidate, no automatic retry.
4. Existing v19-v21 JSON/context can still import only while all original fingerprints match. Existing drafts/manual edits and disabled/custom teasers retain their treatment.
5. Auto still requests one winner. MAIN, teaser bounds/citations and manual editing rights remain unchanged.

Before packaging: source/diff review only; no tests, standalone lint/typecheck, AI, ASR, download, browser automation or render. Candidate quality/count adherence and UI runtime acceptance are unverified.

## Authorized package 1123

User requested build/update. Package 1123 targets the fixed release and Applications Beta bundles, with build 1122 retained for rollback. A local clean checkpoint is required by the packager and recorded in app config; no push/merge. Preserve compiler/native-audit/codesign guards. Profile beta, ports 5373/8987, data root, credentials and existing drafts/media remain unchanged. The release receipt `macos-build-1123-receipt.json` records the actual package/import-closure checks and install result. No tests, standalone lint/typecheck, AI, ASR, download, browser automation or render; runtime acceptance remains pending.
