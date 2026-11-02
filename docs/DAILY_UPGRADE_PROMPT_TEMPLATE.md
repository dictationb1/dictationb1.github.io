# DAILY_UPGRADE_PROMPT_TEMPLATE — v0.0.1.a → next

Copy the block below into a fresh session, fill the three `<<…>>` slots, and the
agent has everything it needs: the contracts, the budgets, the preservation lock
and the gate order. Nothing else has to be explained.

---

## v0.0.1.d — 2026-11-01 — the twelve-gate release

Prompts written against v0.0.1.b asked for **eight** runtime gates and a
48,000 B `sdp-data-sync.js`. Both numbers are wrong now. Copy these lines into
any new upgrade prompt instead:

- The suite is **twelve gates, G1–G12**; `tests/check.cjs` (G1) fails if any of
  `voice-guide.cjs`, `vault-sync.cjs` or `studio-safety.cjs` is missing.
- Budgets: `index.html` 35,000 · `sdp-ui.css` 60,000 · `sdp-data-sync.js` 65,000 ·
  `sdp-audio-speech.js` 48,000 · `sdp-dictation-engine.js` 58,000 ·
  `sdp-ui-views.js` 110,000 · `studio.js` 85,000 · `data-meter.js` 22,000 ·
  `data.html` = `data/index.html` 60,000 · `sw.js` 12,000 · `docs/*.md` 40,000
  (this template 18,000).
- **Never** call `/v1/text-to-speech` from a gate, test, script or probe. The only
  live TTS is a human click on `#btnGenClips` / `#btnTestOneWord` in
  `data/studio.js`; G12 fails the release if a test file even mentions the path.
- `data/elevenlabs-audio.json` is **app-written** (D-UI11): budget it, never
  hash-freeze it.
- Credit lines are verbatim in EN *and* SI on Home, About and `/data`:
  `CREDITS GOES TO Hansana` ·
  `Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)` ·
  `නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini`.

---

## v0.0.1.e — 2026-11-02 — the honest-sync release

Copy these extra lines into any upgrade prompt written against **v0.0.1.e**:

- The version check is **never-red dual-source**: same-origin `./data/version.json?t=`
  first, then `raw.githubusercontent.com`; either 200 is `ok: true`. Students
  never poll `api.github.com` (token-only Studio use).
- The unified voice ladder is lecturer → Alice → (verified Neural UK Female) →
  **dictionary human British audio** → TTS last, with an 800 ms word watchdog
  and a 700 ms guide watchdog driven by the real `utter.onstart` flag.
- Fresh devices boot `lang: 'en'`; the one-time `langResetV001e` flag lives
  inside `sdp.settings` and `lang` is never a class key.
- Every publish stamps ONE monotonic `syncRev = Math.max(Date.now(), prev + 1)`
  into config/session/voice-pack/version; `version.json` commits last.
- Home is a Bento grid at ≥ 1024 px (7fr/5fr, credits full-row) with 28 px
  `.step-badge` journey numbers and four rich `.practice-card` buttons.

---

## The template

```
ROLE: upgrade engineer for Smart Dictation Player, CCBE Galle Branch B1 class.

TASK: ship version <<NEW_VERSION>> (from <<OLD_VERSION>>) without breaking a
single classroom byte.

HARD RULES
1. Read docs/ARCHITECTURE_MAP.md, docs/SYNC_AND_DATA_CONTRACT.md and
   docs/UI_COMPONENT_GUIDE.md before editing.
2. Preserve read-only: data/session.json, data/gas-source.txt,
   data/elevenlabs-audio.json, assets/fonts/NotoSansSinhala-{Regular,Bold}.woff2.
   Verify with: shasum -a 256 -c /tmp/sdp-preserve.sha256
   (recreate the manifest first if /tmp was wiped).
3. Strict ES5 only in shipped JS: var, function(){}, no let/const/arrow/
   template literals/class/async/destructuring/for..of. No bundler, no minifier,
   no runtime CSS injection.
4. Respect every H1 byte budget in docs/ARCHITECTURE_MAP.md §1 and
   tests/check.cjs BUDGET. Never add an unbudgeted shipped file.
5. UI strings change only in STRINGS_EN and STRINGS_SI (data/sdp-ui-views.js).
   EN mode = zero Sinhala in chrome; SI mode = all chrome in natural Sinhala,
   proper nouns and IPA untouched.
6. Gate files (tests/*.cjs) change only in commits prefixed `gate-align:`.

THE CHANGE
<<DESCRIBE THE CHANGE IN 1-5 SENTENCES: what the student sees, which screen,
which words, which behaviour.>>

VERSION BUMP
- data/version.json: appVersion/version = <<NEW_VERSION>>, buildDate = <<DATE>>,
  updatedAt = <<ISO>>, syncRev = <<NEW_SYNC_REV>>
- index.html boot target and data/sdp-data-sync.js APP_VERSION/SDP.version
- sw.js SW_VERSION = 'sdp-<<NEW_VERSION>>', SHELL_CACHE = 'sdp-<<NEW_VERSION>>-shell'
- manifest.webmanifest description/start_url
- data/config.json: only ver/appVersion/version/schema/settingsRev

DONE MEANS
  shasum -a 256 -c /tmp/sdp-preserve.sha256
  node tests/check.cjs
  node --test tests/upgrade.test.cjs
  node tests/phase1.cjs
  node tests/server.cjs
  node tests/browser.cjs
  node tests/upgrade-browser.cjs
  node tests/e2e.cjs
  node tests/live-lab.cjs
  node tests/audit-v42.cjs
all exit 0 with 0 FAIL, then append a CHANGELOG_LEDGER.md block with the real
byte counts and PASS counts, and merge to main with --no-ff.
```

---

## Worked example — a real `0.0.1.a → 0.0.1.b` change

**Goal:** give the student a "slow replay" button that re-plays the current word
at 0.72× without restarting the beat.

### 1. Find the owners

- Button markup → `index.html` (cockpit controls block).
- Colour/space → `assets/css/sdp-ui.css` (`.btn` variants).
- Behaviour → `data/sdp-dictation-engine.js` (`repeatWord()` lives there).
- Rate override → `data/sdp-audio-speech.js` (`playWord(word, {rate})`).
- Labels → `data/sdp-ui-views.js` (`STRINGS_EN.slowReplay` / `STRINGS_SI.slowReplay`).

### 2. Make the change (ES5)

```html
<!-- index.html — inside .cockpit-controls, after #btnRepeat -->
<button id="btnSlow" type="button" class="btn" data-i18n="slowReplay">Slow replay</button>
```

```js
// data/sdp-dictation-engine.js — next to repeatWord()
function slowReplay() {
  var item = current();
  if (!item || !SDP.Speech) return;
  SDP.Speech.playWord(item.word, { rate: 0.72 }, noop);
}
// …and in bind(): ['btnSlow', slowReplay],
```

```js
// data/sdp-ui-views.js — both tables, same key
// STRINGS_EN: slowReplay: 'Slow replay',
// STRINGS_SI: slowReplay: 'සෙමින් නැවත අසන්න',
```

### 3. Bump the version (five files, no more)

| File | Edit |
| --- | --- |
| `index.html` | `var TARGET = '0.0.1.b';`, `#sdpVerPill` text |
| `data/sdp-data-sync.js` | `APP_VERSION`, `SDP.version` |
| `sw.js` | `SW_VERSION`, `SHELL_CACHE` |
| `data/version.json` | `appVersion`, `version`, `buildDate`, `updatedAt`, `syncRev + 1` |
| `manifest.webmanifest` | description, `start_url` query |

`data/config.json` still only changes `ver/appVersion/version/schema/settingsRev`.

### 4. Prove it

```bash
shasum -a 256 -c /tmp/sdp-preserve.sha256     # 5 × OK
node tests/check.cjs                          # G1: budgets + ES5 + docs
node --test tests/upgrade.test.cjs            # G2: constants + vault
node tests/phase1.cjs                         # G3: jsdom behaviour
node tests/server.cjs                         # G4: backend 8/8
node tests/browser.cjs                        # G5: 54px header, ring, toast
node tests/upgrade-browser.cjs                # G6: cache purge + reload once
node tests/e2e.cjs                            # G7: student journeys
node tests/live-lab.cjs                       # G8: two-device sync
node tests/audit-v42.cjs                      # G9: audio tiers + utterances
```

If `#btnSlow` pushes `index.html` past 35,000 B, delete something — a budget is a
ceiling, not a suggestion.

### 5. Ledger + merge

Append to `docs/CHANGELOG_LEDGER.md`:

```md
## v0.0.1.b — 2026-11-__ — Slow replay

| File | Bytes | Δ | Gate |
| --- | --- | --- | --- |
| index.html | 20,4xx | +1xx | G1 |
| data/sdp-dictation-engine.js | 26,5xx | +2xx | G3, G9 |
| data/sdp-ui-views.js | 52,5xx | +2xx | G3 |

Gates: G1 51/0 · G2 30/0 · G3 xx/0 · G4 8/0 · G5 22/0 · G6 6/0 · G7 12/0 · G8 16/0 · G9 10/0
Preservation: 5/5 OK
```

```bash
git commit -m "v0.0.1.b: slow replay at 0.72x in the cockpit"
git push origin <branch>
gh pr merge <n> --merge --delete-branch   # or: git merge --no-ff
```

---

## Fast answers

- **A gate fails on bytes** → the budget table and this doc are the contract; trim
  the change, do not raise the budget. Raising a budget is a `gate-align:` commit
  with a one-line justification.
- **A gate fails on Sinhala** → you added a string to one table only. Both tables,
  same key, every time.
- **You need a new file** → add it to `docs/ARCHITECTURE_MAP.md` §1, add a BUDGET
  row in `tests/check.cjs`, then ship it.
- **The lecturer published a new session** → `data/session.json` bytes changed on
  purpose; update `BUDGET`/`EXACT`/`PRESERVED_SHA` in `tests/check.cjs` and
  Appendix A, rerun G1, and note it in the ledger.
- **Never** re-introduce a retired id (`bgLiveVideo`, `dataSheet`, `screen-comm`, …)
  or a floating credit badge over the player.

---

## Appendix — v0.0.1.a additions to quote verbatim

- Publish chunks are measured in **bytes** (`utf8Encode(line).length`), never
  `String.length`; Sinhala is 3 bytes per glyph.
- The store layer writes **five keys only** — no `__sdp_probe__`, no capability
  test writes.
- Typing mode submits on **Enter** in either listening or writing phase.
- Settings is **six** sections; `#aboutCard` is fifth, `#studioAccordion` last.
- The About card repeats the exact credit line; credits are never a fixed badge.
- An empty bank shows `#bankEmpty`, disables Start and prints `—` for mastered.
- `/data` back link is `../index.html` (works from `/data.html`, `/data/` and `/data/index.html`).
- Exactly one `<style id="sdpCloak">` under 400 bytes may exist in `index.html`.
- All nine gates must print `0 FAIL`; the expected counts are
  71 / 10 / 61 / 8 / 44 / 15 / 48 / 26 / 46 = **329 assertions** (≥ 325 required).

## v0.0.1.d — 2026-11-01 — the 12-gate, PIN-gated, class-synced release

**PIPE-03 correction.** Earlier revisions of this template claimed that G1
(`tests/check.cjs`) asserts the existence of `tests/voice-guide.cjs`,
`tests/vault-sync.cjs` and `tests/studio-safety.cjs`. That claim was true only
for the file list; from v0.0.1.d the assertion is real:

```js
['voice-guide.cjs', 'vault-sync.cjs', 'studio-safety.cjs'].forEach(function (f) {
  record('G10–G12 exists: tests/' + f, exists('tests/' + f));
});
```

`tests/package.json` (`scripts.gates`) and `.github/workflows/checks.yml` both
chain **all twelve** gates now, and CI no longer SHA-pins the app-written
`data/elevenlabs-audio.json` (PIPE-02).

| Gate | Command | Contract |
| --- | --- | --- |
| G1 | `node tests/check.cjs` | budgets, ES5, `/data` parity, G10–G12 existence |
| G2 | `node --test tests/upgrade.test.cjs` | constants, `SDP_ENC_V2`, publish payloads |
| G3 | `node tests/phase1.cjs` | jsdom behaviour: PIN gate, classSettings, quick guide |
| G4 | `node tests/server.cjs` | config metadata + Apps Script loader |
| G5 | `node tests/browser.cjs` | layout, routing, focus law, 48 px targets |
| G6 | `node tests/upgrade-browser.cjs` | SW upgrade, cache purge, single reload |
| G7 | `node tests/e2e.cjs` | student journeys incl. guide skip |
| G8 | `node tests/live-lab.cjs` | two-device classSettings propagation |
| G9 | `node tests/audit-v42.cjs` | audio tiers, unified lock, repeat-safe deadline |
| G10 | `node tests/voice-guide.cjs` | activeUtter GC guard, 10 s keepalive, Guide 2.0 |
| G11 | `node tests/vault-sync.cjs` | pinVerifier, saveKeys publish, persisted lockout |
| G12 | `node tests/studio-safety.cjs` | credit-saver delta + locked-studio zero widgets |

Every gate must print `0 FAIL`; the release commit records the counts in
`docs/CHANGELOG_LEDGER.md`.

**HARD RULE (W5).** No gate, test, script or probe may ever call
`https://api.elevenlabs.io/v1/text-to-speech/...`. Only a human tapping
`#btnGenClips` or `#btnTestOneWord` inside the PIN-unlocked Studio may spend a
credit. G12 fails the release if any test file contains a live TTS call.
