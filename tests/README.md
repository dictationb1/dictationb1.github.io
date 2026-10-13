# Smart Dictation Player tests

These are **development-only** dependencies. `index.html` remains a standalone vanilla ES2017 app and loads none of them.

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
