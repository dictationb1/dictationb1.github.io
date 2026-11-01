# SYNC_AND_DATA_CONTRACT — Smart Dictation Player v0.0.1.c

Everything that touches bytes on a student's phone, or a byte on GitHub, is
specified here. If code and this document disagree, the document wins and the
code is the bug.

---

## R1 — Version and cache constants

| Constant | Value | Where |
| --- | --- | --- |
| `APP_VERSION` / `SDP.version` | `0.0.1.c` | `index.html`, every module |
| `ver` | `3` | `data/version.json`, `data/config.json`, `data/elevenlabs-audio.json` |
| `schema` | `3` | same |
| `settingsRev` | `3` | same |
| `syncRev` | `1762000000002` | `data/version.json` |
| `SW_VERSION` | `sdp-v0.0.1.c` | `sw.js` |
| `SHELL_CACHE` | `sdp-v0.0.1.c-shell` | `sw.js` |
| `PRESERVE_CACHES` | `['sdp-youdao-v1', 'sdp-audio-clips']` | `sw.js` |

There is exactly one version file: `data/version.json`. Never a root `/version.json`.

---

## R2 — `window.SDP` boot and reconciliation

```
boot()  →  GET ./data/version.json?t=<ms>   (cache: no-store)
        →  GET ./data/config.json?t=<ms>
        →  GET ./data/session.json?t=<ms>
        →  applyPayloads()  →  30 normalised words  →  'sdp:ready'
```

A hung request is finished by a 6,000 ms guard, so an offline phone never freezes
on the splash. `state.source` is `network`, `offline` or `memory`; the data toast
uses it (`Loaded · N KB` vs `Offline ready · 0 KB`).

`checkForUpdates(cb)` re-reads `version.json` and compares three fields:

| Field | Meaning | Effect when changed |
| --- | --- | --- |
| `session` | active session number | re-fetch `session.json`, swap the word bank |
| `settingsRev` | settings schema revision | re-fetch `config.json` |
| `syncRev` | monotonic publish stamp | re-fetch `session.json` |

`cb(null, {updated:true, session})` fires at most once per check. **It never
writes `sdp.progress`**, which is why a session published by the lecturer cannot
erase a student's streak (G8).

The watch runs `checkForUpdates` every 120,000 ms and on `visibilitychange`
(foreground). Tests set `window.__SDP_NO_LIVE__ = true` to stay offline.

---

## R3 — `data/version.json` (H3)

```json
{
  "ver": 3,
  "appVersion": "0.0.1.c",
  "version": "0.0.1.c",
  "buildDate": "2026-11-01",
  "schema": 3,
  "settingsRev": 3,
  "session": "8",
  "title": "Session 8 - Personal Feelings, Opinions & Experiences (Adj)",
  "updatedAt": "2026-11-01T00:00:00Z",
  "syncRev": 1762000000002
}
```

Ceiling 2,000 B. Anything larger means someone pasted the old multi-hundred-field
pointer file back in.

---

## R4 — `localStorage`: five keys, and only five (R8)

| Key | Shape |
| --- | --- |
| `sdp.progress` | `{mastered:{}, attempts:{}, weakWords:[], streak:{count,lastDate}, history:[], lastScore:null}` |
| `sdp.settings` | `{mode:"paper", writeSecs:8, repeats:3, pauseSecs:1.5, autoAdvance:true, voiceSource:"auto", rate:0.95, volume:1, lang:"en", theme:"dark", hints:{pos:true,first:false,si:false,sentence:false}}` |
| `sdp.session` | `{sessionId:"8", index:0, mode:"paper", answers:{}, updatedAt:0}` — deleted on finish |
| `sdp.guide_seen` | `"0.0.1.b"` once the student closes `#guideModal` (version stamp, not a boolean) |
| `sdp.migrated_from_legacy` | `"1"` after the one-time import |

**Corruption policy.** `Data.read()` wraps `JSON.parse` in try/catch. A corrupt
value is removed and replaced by the schema default; boot never throws
(G3 covers this).

**One-time legacy import.** While `sdp.migrated_from_legacy !== '1'`,
`Data.migrateLegacyOnce()` reads `sdp.v57_secure_local`, `sdp.v56_audit_verified`
and `sdp.v55_guaranteed_device_sync` (names built by string concatenation so no
shipped byte ever writes them), copies `streak`, `weakWords`/`missedWords`,
`mastered` and `history` into `sdp.progress`, writes the flag and then **never
touches a legacy key again**.

`data-meter.js` keeps its own metering counters under `sdp.dataMeter.*`; they are
telemetry for the `/data` page, contain no student content, and are excluded from
the five-key rule.

---

## R5 — `SDP_ENC_V2` cross-device vault (frozen wire format)

Envelope:

```
"SDP_ENC_V2:" + base64( salt[16] || iv[12] || AES-GCM-256(ciphertext || tag) )
```

Key derivation:

```js
baseKey = await crypto.subtle.importKey('raw', utf8(pin), 'PBKDF2', false, ['deriveKey']);
key     = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
            baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
```

- Plaintext: UTF-8 JSON, e.g. `{"ghToken":"…","elevenKey":"…","gasUrl":"…","updatedAt":1762000000000}`.
- Minimum real envelope: **29 decoded bytes** (16 salt + 12 iv + 1 tag byte).
- `"SDP_ENC_V2:AAA="` (3 bytes) and anything shorter is an **unconfigured empty
  vault**: `decryptV2()` resolves `{empty:true}` instead of throwing.
- Wrong PIN rejects `{code:'bad_pin', triesLeft}`. Five consecutive failures
  reject `{code:'locked', retrySec:60}` and lock for 60,000 ms; a correct PIN
  during the lock is still refused.
- Unlocked secrets live only in `sessionStorage['sdp.studio.unlocked']` and are
  cleared by `Vault.clear()` / the studio lock button. They never reach
  `localStorage`, a cookie, or the DOM.

Test vector (G2): `encryptV2({elevenKey:'sk_test', ghToken:'ghp_demo'}, '246813')`
must round-trip, must differ on every run (fresh salt/iv), and must decrypt to
the identical object.

---

## R6 — Service worker policy

| Request | Strategy | Cache |
| --- | --- | --- |
| `dict.youdao.com/dictvoice…`, `?audio=` | cache-first | `sdp-youdao-v1` |
| `assets/audio/session-w*`, `blob:`, `elevenlabs` | cache-first | `sdp-audio-clips` |
| `.woff2`, `.png`, `.svg`, `.ico`, `.webp`, `/assets/fonts/` | cache-first | `sdp-v0.0.1.b-shell` |
| navigations | network-first, 4,000 ms → cache → `./index.html` | shell |
| same-origin `.html/.json/.js/.css/.webmanifest`, `/data/` | network-first, 4,000 ms | shell |

`install` precaches: `./`, `./index.html`, `./assets/css/sdp-ui.css`, the six
`./data/*.js` modules, `./data/version.json`, `./data/config.json`,
`./data/session.json`, both fonts, `./manifest.webmanifest`, `./data.html`,
`./data/index.html` — then `skipWaiting()`. A `sdp:cache-words` message handler
caches the 30 word-audio URLs on demand (offline downloader); both preserved
audio caches survive every upgrade.

`activate` deletes every `sdp-*` cache that is not the shell cache or a preserved
cache, then `clients.claim()`.

---

## R7 — Publishing (Studio only)

Two paths, both while unlocked:

1. **GitHub Contents API** — `PUT /repos/{owner}/{repo}/contents/{path}` with
   `{message, content: base64(utf8(text)), branch:'main', sha?}`. `sha` comes
   from a prior `GET`. Owner/repo come from the preserved `config.json`
   (`dictationb1` / `dictationb1.github.io`).
2. **GAS relay** — CORS-simple `POST` with `Content-Type: text/plain` body
   `{action, app:'sdp', ver:'0.0.1.c'}` (hard ceiling 600 B). **The PIN is never
   in the body** (W6/D-S9): it is verified inside the Apps Script, which is the
   only place it exists. Word publishing is chunked so every chunk stays under
   40,000 B.

### Sequential publisher (`SDP.Sync.publishFilesSequential`)

`Promise.all` over three PUTs is forbidden: GitHub rejects concurrent commits to
the same branch and the lecturer sees a half-published session.

1. One file at a time, in the order given by the caller.
2. Before **every** PUT, `getFileSha()` re-reads the current `sha` — a cached sha
   from two seconds ago is stale by the time the next file commits.
3. A `409` triggers exactly one retry with a fresh sha, then the file is reported
   as failed instead of silently skipped.
4. **`data/version.json` is always published last**, so no device can ever read a
   new version number pointing at a session that has not landed yet.
5. `onFileStatus(path, ok, err)` paints progress; the callback returns
   `{ok, published, failed[], order[]}`.

Publishing writes `data/session.json`, `data/config.json`,
`data/elevenlabs-audio.json` and finally `data/version.json`; the version bump
carries the new `syncRev`, which is exactly what `checkForUpdates` watches.

**Preserved-file rule.** A deliberate publish legitimately changes
`data/session.json`. When that happens, update the `BUDGET`/`EXACT`/`PRESERVED_SHA`
tables in `tests/check.cjs` **and** Appendix A below in the same commit, then
rerun G1. Never hand-edit the payload itself. `data/elevenlabs-audio.json` is
app-written since v0.0.1.c and is therefore budgeted, not hash-frozen (D-UI11).

---

## R8 — `data/config.json` preserved payload

Must keep, untouched: `credits`, `tts`, `voice`, `live` (ntfy state/community/inbox),
`repoOwner: "dictationb1"`, `repoName: "dictationb1.github.io"`,
`encVault: "SDP_ENC_V2:AAA="`, `defaults`, `classInfo`,
`voiceId: "Xb7hH8MSUJpSbSDYk0k2"`, `voiceName: "Alice"`,
`modelId: "eleven_flash_v2_5"`.

Only `ver: 3`, `appVersion: "0.0.1.c"`, `version: "0.0.1.c"`, `schema: 3`,
`settingsRev: 3` are ours to change.

---

## Appendix A — Preservation locks (this release)

```
e0e86c807fc667475dad43de7848d3b231642c99f913bdab8c48e24834b86a5f  data/session.json                 46,403 B
591b9b086f6d3723afb2604a837ffc495c69a481c490f11e58131c2222b0981e  data/gas-source.txt              13,764 B
23f1503e1e75413903dff05f4415f59d4b903cfeb2a8d1c0047ac158d20ff280  assets/fonts/NotoSansSinhala-Regular.woff2  48,520 B
bf59c1487b0a88a07a678190fd7a6e93aa01c5ec3f3f2f9e349922ac944a643e  assets/fonts/NotoSansSinhala-Bold.woff2     48,748 B
```

Verify at any time with:

```bash
shasum -a 256 -c /tmp/sdp-preserve.sha256   # phase manifest
node tests/check.cjs                        # G1, same table baked in
```

`data/elevenlabs-audio.json` left this table in v0.0.1.c: the Lecturer Studio
rewrites it on every publish, so a frozen hash was a publishing bug waiting to
happen. It is now capped at 2,500,000 B and its header (`version`, `appVersion`,
`ver`, `schema`, `voiceId`) is asserted by G1 and G9.6g.

`data/session.json` content contract: `lists[0]` = `list_session_8_feelings`
(30 words, `w/p/pos/m/si/s/audio`), `lists[1]` = `list_session_7_travel`
(30 archived words), plus `plan`, `session` metadata and `pastSessions`.

---

## Appendix B — Gate-to-contract map

| Gate | Contracts asserted |
| --- | --- |
| G1 | H1 budgets, W3 ES5, R9 byte-identical `/data`, Appendix A, retired ids |
| G2 | R1, R5 (vault), R4 (migration), R2 (reconciliation), R7 (payload shapes) |
| G3 | R4 (corruption + migration), R5 (PIN lockout), R2 (guide), R5/R6 grading, W7 (language purity) |
| G4 | Preserved Apps Script backend (`data/gas-source.txt`) — seven behaviour tests unchanged |
| G5 | R3 (header 54px, single screen), R4 (input law), R5 (ring colours), R9 (toast) |
| G6 | R6 (cache purge → `sdp-v0.0.1.b-shell`, preserved caches, single reload, offline shell) |
| G7 | R2 (journeys), R5 (self-check + retry), R4 (legacy migration), R8 (settings order) |
| G8 | R2 (two-device propagation without touching progress), R7 (publish) |
| G9 | R5 (audio tiers, beat text, one-utterance `say`, same-element replay) |
| G10 | R4 (one professor voice, male-name blacklist), R3 (Guide 2.0 step machine, 600 ms watchdog, `#guideTapBanner`) |
| G11 | R5 (`SDP_ENC_V2` 16B salt ‖ 12B iv, 250k PBKDF2), R6 (sequential publish, `version.json` last, fresh sha, one 409 retry), W6 (no PIN in any body or URL) |
| G12 | W5 (no gate touches the billing endpoint), R9 (EN + SI strings), studio widgets `#pinPad`/`#btnTestElKey`/`#btnTestGhToken`/`#btnCommitClip` |

---

## R11. Publish chunk budget is measured in BYTES

Apps Script cells are limited to 40,000 **bytes**, not characters. Sinhala is
three bytes per glyph in UTF-8, so a chunk that looks safe by `.length` can be
33% over budget. `Sync.publishWordsChunked` therefore accumulates
`utf8Encode(line).length` and closes a chunk before it would exceed the limit.
The regression test builds 300 Sinhala-heavy words and asserts every chunk is
under budget (`tests/upgrade.test.cjs`, "R7: GitHub Contents payload").

## R12. Five keys, no probe

The store layer must never write a key just to test writability. Capability is
detected by shape (`typeof localStorage.setItem === 'function'`); every write is
individually wrapped in `try/catch` and returns `false` on failure. `tests/audit-v42.cjs`
(G9.5c) and `tests/upgrade.test.cjs` (R1) both fail the build if a sixth key
appears in the source.

---

**Credits — preserved verbatim, EN and SI.**
`CREDITS GOES TO Hansana` ·
Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu) ·
නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini
