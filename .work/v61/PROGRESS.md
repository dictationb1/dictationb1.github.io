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
