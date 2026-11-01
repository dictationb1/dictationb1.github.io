# v60 (9.0.0.4) — PROGRESS

## P2 — CHROME + AUDIO FIXES (done)
- Bug 6 root cause found in learning-tools `say(text, slow)`: `sp.say(String(text), slow ? 0.72 : 1)` -> now `sp.say([String(text)], { rate: ... }, function(){})`.
- Added `v604Speech()` wrapper: `if (typeof items === 'string') items = [items];` on SDPCore.Speech.say.
- Added `v604SweepTopbar()` (moves every non-cluster/non-actions child of .topbar into #sdpLegacyKeeper, keeps #brandName/#brandSub/#sdpVerPill inside #sdpBrandCluster).
- Added `v604Credit()` (#creditDocked re-parented to #screen-home, inline position static).
- Added `v604LegacyText()` + CSS to hide `Session progress*` / `Smart Dictation Player v58*` blocks, `#staticFooter`, `.v58-footer`, `.v58-session-prog`, `.v58-bento`.
- CSS block appended at the end of #sdpNextGenCss (wins cascade) implementing the full-bleed fixed 56px `.topbar`.
- boot() calls v604All() immediately and at 900/2000/4000ms; sets `data-v60-ready="1"`.
- Adapted anchors: `#sdpBtnTestVoice` does not exist -> the real control is `#sdpTestVoice` (label `T4('test')` = "Test voice"); `#sdpTopVoiceBtn` keeps its startDictation() behaviour (reported in P6).
- Cheap check PASS.

## P1 — VERSION BUMP + FOUC CLOAK (done)
- `#sdpPrePaintCloak` injected in `<head>` right after `#sdpSwBoot`; 900ms fallback timer added inside `#sdpSwBoot`.
- Version 9.0.0.3 -> 9.0.0.4 in: data/{version,config,session,elevenlabs-audio,media-manifest}.json (2 each), sw.js (5), data/data-meter.js (1), data/learning-tools.js (3), data/studio.js (1), index.html (6), data.html (1) + data/index.html copy.
- Version-string assertions updated in tests/check.cjs, upgrade.test.cjs, server.cjs, audit-v42.cjs, live-lab.cjs, phase1.cjs.
- Cheap check PASS (G1 + G2).

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
- [x] P1 version 9.0.0.4 + pre-paint FOUC cloak (index 485175 B; all stamps 9.0.0.4 incl. data-meter/learning-tools/studio/sw; cloak injected after #sdpSwBoot with 900ms fallback)
- [x] P2 Speech.say/topbar/creditDocked/legacy timers (learning-tools 254801 B; .topbar now exactly 2 children; #creditDocked static inside #screen-home; say() passes arrays; Speech.say string wrapper; data-v60-ready set)
- [ ] P3 blank Words tab, Settings leaks, Practice styling
- [ ] P4 dictation cockpit split-screen + scroll lock
- [ ] P5 regression gates
- [ ] P6 docs, PR, merge
