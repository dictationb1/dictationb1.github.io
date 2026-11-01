# v60 (9.0.0.4) — PROGRESS

## P0 — PREFLIGHT
- Repo: dictationb1/dictationb1.github.io (verified via `gh api repos/... --jq .full_name`).
- HEAD at start: `ef6cdfa` (Merge pull request #109) — expected baseline, OK.
- BRANCH NOTE (W2 fallback): `origin/fix/v60-nextgen-9-0-0-4` does not exist, but this Arena
  session is pinned to `arena/add38459-dictationb1-github-io` and must not create/push any
  other branch. Per the spec's own W2 fallback ("keep the session's own branch and use it
  everywhere instead") ALL work is committed/pushed to `arena/add38459-dictationb1-github-io`.
- node v22.22.3. `npm ci --prefix tests` run (tests/node_modules was missing) -> exit 0.
- Baseline sizes (bytes): index.html 484800 | data.html 59845 | data/index.html 59845 |
  data/learning-tools.js 247504 | data/studio.js 106144 | sw.js 7100.
- Baseline `<CHEAP_CHECK>`: PASS (check.cjs exit 0 "ALL v60 STATIC CHECKS PASSED";
  upgrade.test.cjs 25/25 pass).
- Baseline gates probed: G1 PASS, G2 PASS, G5 `node tests/browser.cjs` PASS (exit 0, 115.9s).
  Chromium binaries ARE available (playwright-core + @sparticuz/chromium, tests/chromium-env.cjs).
- Note: `version.json` does not exist at repo root; the only metadata files are
  `data/version.json`, `data/config.json`, `data/session.json`. Adaptation: P1/P6 update those.
- Note: tests/check.cjs ceiling for data.html is 65000 (spec R2 says 60000) — we stay <= 60000.
- Helpers created: .work/v60-9004/{SPEC.md,peek.cjs,patchlib.cjs,strgen.cjs}.

## Phase status
- [x] P0 preflight and helpers
- [ ] P1 version 9.0.0.4 + pre-paint FOUC cloak
- [ ] P2 Speech.say/topbar/creditDocked/legacy timers
- [ ] P3 blank Words tab, Settings leaks, Practice styling
- [ ] P4 dictation cockpit split-screen + scroll lock
- [ ] P5 regression gates
- [ ] P6 docs, PR, merge
