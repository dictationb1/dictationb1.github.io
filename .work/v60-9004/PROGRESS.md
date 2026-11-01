# v60 / 9.0.0.4 execution record

## Resume and decisions
- Session branch is fixed by Arena: `arena/f3dc9865-dictationb1-github-io`. All commits/pushes/PRs use it, never `fix/v60-nextgen-9-0-0-4`.
- Repository verified: `dictationb1/dictationb1.github.io`; baseline `ef6cdfa` (expected).
- `git fetch origin --prune` succeeded; only `origin/main` exists. No previous target branch or progress to resume.
- Node v22.22.3. `tests/node_modules` was absent; `npm ci --prefix tests` succeeded.
- Browser probe: no Chromium/Chrome/Firefox executable found in PATH/common locations. Browser provisioning will be attempted from permitted sources; no product changes for environment failures.
- GitHub probe `gh api repos/dictationb1/dictationb1.github.io --jq .full_name`: PASS.
- Root `version.json` is absent at baseline; inspect version endpoint conventions and create a consistent root manifest in P1.
- No adapted patch anchors so far. IDs, storage keys, ES5, security, SW strategies and byte budgets are preserved.

## Baseline bytes
| File | Bytes |
| --- | ---: |
| index.html | 484800 |
| data.html | 59845 |
| data/index.html | 59845 |
| data/learning-tools.js | 247504 |
| data/studio.js | 106144 |
| sw.js | 7100 |

`index.html` growth safety limit: 499800 bytes (baseline + 15000), below global 598000 ceiling.
`data.html` and `data/index.html` must stay <=60000 and byte-identical.

## Phases
- [x] P0: repository/baseline verified; spec + peek/patchlib/strgen/size helpers saved; sizes PASS; baseline cheap check PASS (25/25 upgrade tests). Commit/push checkpoint follows.
- [x] P1: all manifest/runtime version stamps 9.0.0.4, root manifest, SW cache version, head cloak and 900ms fallback (before early return). Sizes + cheap check PASS (25/25).
- [ ] P2: speech/chrome/credit/legacy render cleanup
- [ ] P3: Words/settings/practice
- [ ] P4: cockpit/start/scroll
- [ ] P5: regression tests and G1..G9
- [ ] P6: release notes, helper cleanup, final check, one PR, conditional merge

## Gates
Baseline cheap check: PASS (`/tmp/p0-cheap.log`, exit 0).
P0 size and data identity: PASS.
G1..G9 release results: pending P5.

NEXT: P2. Inspect chrome/audio and legacy timer anchors with peek.cjs.

P1 scope decision: existing checks require data/elevenlabs-audio.json, data/media-manifest.json and data/data-meter.js to share the release version; these and SDPVersion in learning-tools.js were bumped too. Root version.json is a copy of the canonical data manifest. No adapted anchors. index.html=485159 (+359); data routes=59845, identical.
