# Smart Dictation Player tests

These packages are development-only. `index.html`, `data.html` and `data/index.html` load none of them and contain strict ES5 application JavaScript.

## Nine v48 release gates

From the repository root:

```sh
npm ci --prefix tests
node tests/check.cjs
node --test tests/upgrade.test.cjs
node tests/phase1.cjs
node tests/browser.cjs
node tests/upgrade-browser.cjs
node tests/e2e.cjs
node tests/server.cjs
node tests/live-lab.cjs
node tests/audit-v42.cjs
```

- `check.cjs` extracts and parses the app and both data-route scripts as ES5, rejects static `<link>` tags and enforces the byte budgets.
- `upgrade.test.cjs` verifies v48/5.4.0 metadata, Session 8 and archived Session 7, spelling pairs, Oxford/Youdao/Google routing, 150/650 ms timing, 0 KB Pass 2, 0.72× replay, rolling preloads, 50 ms headless completion, Sinhala chunks and the interactive data pages.
- `phase1.cjs` retains boot, recovery, PIN, editor, sharing, accessibility and fake-timer dictation regressions. Historical before/after cases skip if commit `7577968` is not present.
- `browser.cjs` and `upgrade-browser.cjs` exercise real Chromium layout, wallpaper, Liquid Glass, credit, PIN, sharing, typing, results and media behavior.
- `e2e.cjs` drives complete fresh/old-storage flows at phone and desktop sizes, including ordered remote audio, resume, comments and offline behavior. `SDP_E2E_ONLY=old|offline|iphone|360|1280` selects a subset.
- `server.cjs` executes the Apps Script against mock Sheet, Cache, Properties and Lock services. It does not verify a live Google deployment.
- `live-lab.cjs` boots two independent devices against a local repository server and in-process ntfy emulator, then verifies publishing, live receipt, completion and honest offline status.
- `audit-v42.cjs` retains its historical filename but is the v48 real-Chromium audio audit. It records remote media, checks countdown/word timing and same-element replay, and verifies clean failure completion without device speech.

## Remote-audio mocks

The tests never require the deleted `audio/` pack, an audio manifest, generated waveforms or a device voice. Browser and jsdom harnesses record Oxford, Youdao and Google URLs and simulate media completion. Some tests intentionally exercise ordered fallbacks and late stale errors. These mocks verify application sequencing, not audible pronunciation or a remote host's availability.

No test needs real cloud credentials. Raw traces, screenshots and extracted scripts stay in ignored `tests/artifacts/`.

## Chromium on a minimal Linux image

The runner uses `@sparticuz/chromium`; `SDP_BROWSER_BIN` can select an installed Chrome/Chromium executable instead. On a system missing NSS/NSPR libraries:

```sh
mkdir -p tests/artifacts/chromium-libs
node -e 'const fs=require("fs"),z=require("zlib");fs.writeFileSync("tests/artifacts/al2023.tar",z.brotliDecompressSync(fs.readFileSync("tests/node_modules/@sparticuz/chromium/bin/al2023.tar.br")))'
tar -xf tests/artifacts/al2023.tar -C tests/artifacts/chromium-libs
export LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
node tests/browser.cjs
node tests/upgrade-browser.cjs
node tests/e2e.cjs
node tests/audit-v42.cjs
```

`tests/chromium-env.cjs` normally performs this setup automatically. These are Chromium tests, not evidence from Firefox, WebKit, a physical iPhone or a real mobile keyboard. `SDP_BROWSER=webkit` can select a separately installed WebKit for `upgrade-browser.cjs` on a suitable development machine.

`QA_REPORT.md` and `PHASE1_QA.md` contain historical observations unless their current-release note says otherwise. A configured workflow or an old artifact is not evidence that the current candidate passed; use the exit status of the nine commands above.
