# v61 / 9.0.1.0 — progress and decisions

## Baseline / P0

- Repository verified: `dictationb1/dictationb1.github.io`.
- Starting HEAD: `3066550c035bc7281443cc2689ecd69ae7c8d04b` (expected v9.0.0.4).
- Working branch: `arena/3273d397-dictationb1-github-io`. The platform fixes this branch; use it instead of creating/switching to `arena/v61-single-ui`. `origin/arena/v61-single-ui` was absent at preflight.
- Specification and all three helpers saved. Baseline `data.html` and `data/index.html` are identical. All six guide MP3 placeholders measured exactly 11 bytes.
- Sizes: index 485175; learning 269514; studio 106144; meter 21246; data.html 59845; data/index.html 59845; sw 7100 bytes.
- Anchor inventory: `anchors.md`. Counts are matching-line counts plus exact occurrence counts, not interchangeable on minified files. Adapt surgery to measured current anchors.
- Initial check: FAIL (exit 1), missing `acorn`. Initial upgrade: FAIL (exit 1), missing `jsdom`. Logs `/tmp/p0-check.log`, `/tmp/p0-up.log`.
- Initial Chromium probe: no `chromium`, `chromium-browser`, `google-chrome`, or Playwright cache. Playwright/Puppeteer npm packages also absent. Browser availability will be retried in P6; missing dependencies will be installed where permitted.

## Checklist

- [ ] P0 preflight, helpers, anchors, baseline gates, commit/push
- [ ] P1 release gates migrated, security/behavior coverage retained
- [ ] P2 engine extraction and clean index/static CSS
- [ ] P3 single SDP61 module; R6 enforced at every subsequent commit
- [ ] P4 speech, focus, synchronization and honest audio/version alignment
- [ ] P5 one-screen cockpit and assessment loop
- [ ] P6 nine release gates, changelog, work cleanup, one PR; merge only if all pass

## Decisions

1. Preserve the platform-assigned branch (explicit W2 fallback and platform requirement).
2. Read minified files only through bounded windows; edit with verified Node scripts. Never weaken security or behavioral tests to obtain green gates.
3. Use one extracted base engine and one learning owner, not additional wrappers. Preserve existing storage, authentication, encryption, lecturer and student APIs.

### Dependency installation and gate retry

```text
npm warn deprecated whatwg-encoding@2.0.0: Use @exodus/bytes instead for a more spec-conformant and faster implementation
npm warn deprecated abab@2.0.6: Use your platform's native atob() and btoa() methods instead
npm warn deprecated domexception@4.0.0: Use your platform's native DOMException instead

added 93 packages in 3s
npm notice
npm notice New major version of npm available! 10.9.8 -> 12.2.1
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.1
npm notice To update run: npm install -g npm@12.2.1
npm notice
```


check:
```text
index.html: node --check PASS; ES5 PASS; 485175 / 600000 bytes
data.html: node --check PASS; ES5 PASS; 59845 / 65000 bytes
data/index.html: node --check PASS; ES5 PASS; 59845 / 65000 bytes
secret gate: PASS (15 required files + all tracked text files)
metadata: v60 / 9.0.0.4; media manifest: 4 assets
P0 wiring markers: PASS
v58 markers: PASS
v60.4 FOUC/video-bug markers: PASS
v60 markers: PASS
v59 markers: PASS
v60 next-gen DOM: PASS
ALL v60 STATIC CHECKS PASSED
```

up:
```text
  duration_ms: 0.976904
  type: 'test'
  ...
1..25
# tests 25
# suites 0
# pass 25
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3119.807677
```

No baseline source files changed in P0.

## P1

- All nine named suites retargeted to 9.0.1.0 / v61. Existing PIN, encrypted vault, meter, publication, self-check, and recovery tests retained.
- Added strict ES5/size checks, LEGACY_ABSENT, V61_PRESENT, exact static footer/settings checks, synchronous JSDOM mount, and seven real-browser single-UI probes.
- Historical phase1 tests still use their historical source when available; existing shallow-clone skips remain unchanged. Current-engine assertions use the extracted source.
- Static gate intentionally fails on baseline legacy CSS until surgery. Selected original security behavior tests remain green.
- P1 syntax correction verified; selected encryption/meter/preview regressions rerun before surgery.

## P2

- Extracted the base engine using Acorn-identified statement ranges. Preserved encrypted vault, session-secret scrubbing, GitHub preview publication, remote speech, lecturer and community engines.
- Removed both runtime stylesheet injectors, data-sheet CSS injector, overflow regroup builder, duplicate settings wrapper and legacy footer builder. The new static shell owns layout.
- Replaced the old static CSS with a single mount-keyed dark-zinc stylesheet; all scripts are deferred in the specified order.
- Compatibility-only hidden engine controls retained for optional wallpaper/lecturer APIs; P3 moves them inside the three settings groups and replaces Home/Words/Practice owners.
- Five PIN/secret/vault/publication regression tests pass against the extracted engine. Full v61 gate waits for the single learning owner in P3 and metadata/speech hardening in P4.

## P3

- Replaced the stacked learning file with one ASCII-only ES5 SDP61 owner. Pure Levenshtein and syllable algorithms were extracted from the baseline; UI wrappers, observers, CSS injectors and janitor sweeps were not carried forward.
- One synchronous mount owns Home, Words, six Practice tools, the guide and exactly three Settings groups. Existing lecturer/community engines remain in app-core.
- Preserved weak-word storage and three-correct graduation, paper self-check, printable six-column sheet, explicit recording playback, and IndexedDB/localStorage fallback. Offline downloader now counts successful writes, not attempts.
- R6 greps are zero in all three principal files and all other shipped HTML/JS. Static release gate is pending P4 strict/version alignment; pedagogical tests run independently.

## P4

- Speech.say normalizes null/string/number inputs to whole-item arrays before playback. All four direct engine call sites use array literals; learning calls go through the same pipeline with arrays.
- Removed the +80ms input focus and both ready-sheet paths. Deferred core now boots synchronously after its security/migration definitions and before the learning module mounts.
- Added Cloud.onSync refresh hook, strict global directives, v61/9.0.1.0 metadata/cache stamps, root version manifest, and app-core precaching. Removed all six 11-byte guide placeholders. Data routes remain identical.
- No Sinhala clips or device voice means a disabled honest guide badge; no Youdao Sinhala endpoint or fabricated audio was added.

## P5

- Removed both legacy player builders and installed one cockpit renderer in the extracted engine: phase edge, header/countdown ring, paper slots or typing input, four helpers, compact voice/pause/skip footer, live counters and dynamic word map.
- No .ctrlgrid, #plRing or #plBars remains. Input is never auto-focused. Paper timeout now has an explicit reveal beat. Results use the interactive SDP61 self-check and preserve lecturer weakness analysis.
- Settings controls are retained across synchronous re-renders instead than recreated with duplicate IDs. The static gate's performance-API check accepts whitespace-equivalent ES5 formatting without removing the API requirement.
