# v60-9003 PROGRESS

Branch (this session): `arena/2b3130b8-dictationb1-github-io` (spec branch `feat/v60-nextgen-9-0-0-3` did not exist;
by session policy I must stay on the session branch — spec W2 fallback "keep the session's own branch and use it everywhere").
Base commit: `8f1f452 Merge pull request #108 from dictationb1/arena/42d54228-dictationb1-github-io`
(not in the expected list `ab2303b` / `548c641` — continued, as instructed).

## Baseline sizes (bytes)
| file | bytes |
|---|---|
| index.html | 483923 |
| data.html | 59845 |
| data/index.html | 59845 |
| data/learning-tools.js | 158911 |
| data/studio.js | 104567 |
| sw.js | 5991 |

node v22.22.3. `npm ci --prefix tests` OK.
Cheap check on untouched baseline: **PASS** (check.cjs exit 0; upgrade.test.cjs 25/25 pass).

## Browser probe
No `~/.cache/ms-playwright`; no system chromium on PATH. `@sparticuz/chromium` + `playwright-core` ship in tests/node_modules
via `tests/chromium-env.cjs`. Probe of G5 (`node tests/browser.cjs`): ran 52 checks, exit=1, 1 pre-existing FAIL
("v53 the admin panel is the 3-card Professor Studio with the credit lock banner") — recorded as a pre-existing baseline
failure, NOT ENV-BLOCKED (Chromium works).

## Phases
- [x] P0 preflight and helpers
- [ ] P1 version 9.0.0.3, fault-tolerant SW, head cache eviction
- [ ] P2 index.html top-gap cleanup + studio flash/vault hardening
- [ ] P3 cascade supremacy, global chrome, wrapped Screens.home
- [ ] P4 wrapped cockpit, priority-1 settings, words explorer, Sinhala i18n
- [ ] P5 lockstep test gates + absence assertions
- [ ] P6 docs, PR, merge

## Gates
| gate | command | status |
|---|---|---|
| G1 | node tests/check.cjs | |
| G2 | node --test tests/upgrade.test.cjs | |
| G3 | node tests/phase1.cjs | |
| G4 | node tests/server.cjs | |
| G5 | node tests/browser.cjs | pre-existing FAIL x1 (baseline) |
| G6 | node tests/upgrade-browser.cjs | |
| G7 | node tests/e2e.cjs | |
| G8 | node tests/live-lab.cjs | |
| G9 | node tests/audit-v42.cjs | |
