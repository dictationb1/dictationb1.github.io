# Release gates — Smart Dictation Player v0.0.1.a

Nine gates, all runnable from the repository root with Node 22 and Chromium
(bundled through `@sparticuz/chromium`). Every gate exits `0` with `0 FAIL` on a
release; each assertion block cites its contract as `// contract: docs/...`.

| Gate | File | What it proves |
| --- | --- | --- |
| G1 | `check.cjs` | H1 byte budgets, strict ES5 via acorn, byte-identical `/data` pair, preserved classroom payload SHA-256, secret scan, zero retired v42–v60 ids |
| G2 | `upgrade.test.cjs` | Version constants, `SDP_ENC_V2` (PBKDF2 250k / AES-GCM-256), one-time legacy migration, `version.json` reconciliation, GitHub Contents + GAS relay payloads |
| G3 | `phase1.cjs` | jsdom behaviour: corrupt-JSON recovery, Studio PIN lockout, first-visit guide, 30-word Paper/Typing runs, EN/SI purity |
| G4 | `server.cjs` | Preserved Apps Script backend (`data/gas-source.txt`) against mock Sheets/Cache/Lock services |
| G5 | `browser.cjs` | Chromium layout: 54px matte header, single-active-screen routing, 30 cards, Paper/Typing input law, beat ring colours, data toast |
| G6 | `upgrade-browser.cjs` | Chromium upgrade v60 → 0.0.1.a: stale cache purge, preserved caches, single boot reload, offline shell |
| G7 | `e2e.cjs` | Chromium student journeys: guide → Paper run → 24/30 self-check → retry missed, Typing run, legacy migration, Practice + Settings order |
| G8 | `live-lab.cjs` | Chromium two-device sync: Studio publish on A lands on B without touching B's progress |
| G9 | `audit-v42.cjs` | Audio priority chain, beat state text, one-utterance `Speech.say`, same-element `<audio>` replay |

Run them all:

```bash
npm ci --prefix tests
npm run gates --prefix tests
```

`node tests/check.cjs --allow-pending` is a phase-run convenience while modules
are still landing; the release run is strict and requires every H1 file.
