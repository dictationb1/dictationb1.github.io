# Smart Dictation Player tests

These are **development-only** dependencies. `index.html` remains a standalone vanilla ES5-syntax app and loads none of them.

From the repository root:

```sh
npm ci --prefix tests
npm test --prefix tests
```

`phase1.cjs` includes boot regression tests, before/after fixtures from commit `7577968`, PIN and editor checks, sharing checks, and fake-timer dictation flows. It instruments the app **only in memory**, using a VM; the delivered page does not expose the test internals. `server.cjs` runs the embedded Apps Script with mock Sheet, Cache, Properties and Lock services. These mocks do **not** verify Google's deployment, quotas, permissions, redirects or live network behaviour.

## Chromium / Playwright

```sh
npm run test:browser --prefix tests
```

The runner uses the development-only `@sparticuz/chromium` executable. Alternatively set `SDP_BROWSER_BIN` to an installed Chromium/Chrome executable. This is Chromium testing, not Firefox, WebKit or an actual iPhone.

On a minimal Linux system missing NSS/NSPR libraries, the package includes compatible test libraries. Extract them locally:

```sh
mkdir -p tests/artifacts/chromium-libs
node -e 'const fs=require("fs"),z=require("zlib");fs.writeFileSync("tests/artifacts/al2023.tar",z.brotliDecompressSync(fs.readFileSync("tests/node_modules/@sparticuz/chromium/bin/al2023.tar.br")))'
tar -xf tests/artifacts/al2023.tar -C tests/artifacts/chromium-libs
LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" SDP_QA_OUTPUT="$PWD/tests/artifacts" npm run test:browser --prefix tests
```

The scripts exit nonzero on failed assertions. Screenshots go to `SDP_QA_OUTPUT` or the operating system's temporary directory. Test dependencies and local output are ignored by Git.

See `../QA_REPORT.md` for observed results and the real-device checklist. `../qa/automated-results.json` records the tested file's version, byte count and SHA-256.

## Full end-to-end flow (Chromium)

```sh
LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib" npm run test:e2e --prefix tests
```

`e2e.cjs` drives the real UI at 390x844, 360x640 and 1280x800 with 4x CPU throttling:
fresh storage and storage written by the 1.0.0 build, Home render, build stamp in
Settings, wrong PIN, the default PIN, Monday list plus session number and day, the
"Are you ready?" screen and skippable countdown, every word spoken in order with a
mocked en-GB `speechSynthesis`, auto-save, reload and resume, an anonymous comment
with its result badge, the 30-second spam limit, a private lecturer message, and an
offline boot. `SDP_E2E_ONLY=old|offline|iphone|360|1280` runs a subset.

This is Chromium only. WebKit and Firefox are **not** run: the sandbox has no such
binary and cannot download one, so iPhone Safari and Firefox behaviour is unverified.

## Current Phase 1 candidate

See `../PHASE1_QA.md` for the current release blockers and actually observed outputs.
`node --test tests/upgrade.test.cjs` (from the repository root) adds the parser, migration, voice, PIN and live-performance units. `node tests/upgrade-browser.cjs` runs Chromium at 6x CPU plus axe; `SDP_BROWSER=webkit` selects a real installed WebKit, with phone portrait/landscape viewports. A reduced viewport is only a keyboard proxy, not a real iOS keyboard test.

The new `.github/workflows/ci.yml` installs both engines on CI. A workflow being configured is not evidence it passed. The old report and historical `qa/automated-results.json` do not describe the current candidate.
