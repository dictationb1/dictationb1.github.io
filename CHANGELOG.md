# Changelog

## 2.0.0 (v8) — 2026-10-22 (Session 7 · Travel & Transport · strictly two repeats)

- **The word is spoken exactly twice.** `Eng.buildBeats()` now emits
  `st.repeats` word-say beats (2 by default) and nothing else: no extra leading
  word beat, no repeat loop that can reach 3 or 4. `CONFIG.key` is
  `sdp.v8_session7`, `CONFIG.schema`/`settingsRev` are `8`, and the live topics
  are `sdp_dictationb1_state_v8` / `_comm_v8` / `_inbox_v8`.
- **One engine per utterance.** `Speech.say()` gained a strict single-engine
  lock: every part stops the shared `#sdpAudio` element and the synthesiser
  before it starts, a beat that has actually produced sound (`audioStarted`)
  is never repeated by `speechSynthesis`, the failed-utterance retry and the
  queue rewind are gone, and only a failure *before* playback may fall to the
  next tier (2200 ms connection timeout, 6000 ms completion timeout).
- **Studio British female professor voice.** Oxford/Cambridge UK MP3 first, then
  Polly **Amy** (en-GB), Polly **Emma**, then Google en-GB through the unlocked
  `#sdpAudio`; device voices rank Natural/Online British female first
  (Sonia, Libby, Maisie, Google UK English Female, Serena, Kate, Martha,
  Stephanie, Shelley, Hazel) with `rate 0.88` and `pitch 1.05`. The next word's
  audio is preloaded during the 5 second writing timer.
- **Session 7 (22/10/2026, CCBE Galle Branch).** 30 Cambridge B1 Travel &
  Transport words, `writeMode: "fixed"`, `writeFixed: 5`, `sentence: false`,
  `repeats: 2`, `rate: 0.88`, `numbers: true`, `mode: "paper"`.
- **Credits and the bilingual shell.** “Created by Hansana · Idea given by
  Ayya01 (Lesandu) · Lecturer in Charge: Sumodya Sewmini” (and its Sinhala
  form) in the header subtitle, Home, Settings → About and the Welcome Guide,
  with the one-tap `EN | සිංහල` switch and a `Guide / උපදෙස්` button.

## 2.0.0 (v7) — 2026-10-22 (Session 7 · Travel & Transport)

- **Session 7 replaces every older list.** 30 Cambridge B1 *Travel & Transport*
  words (`guidebook` … `windscreen`, including `tyre/tire`, `road sign`,
  `tourist information centre` and `waiting room`), each with a British meaning,
  a B1 example sentence and an Oxford/Cambridge UK MP3.
  `CONFIG.key` is `sdp.v7_session7`, `CONFIG.schema`/`settingsRev` are `7`, and
  the live topics are `sdp_dictationb1_state_v7` / `_comm_v7` / `_inbox_v7`.
- **Migration wipes the old class on every phone.** `DB.load()` and `DB.migrate()`
  overwrite `lists`, `plan` and `session` and delete `snapshot`, `sessions`,
  `outbox` whenever `settingsRev < 7`; `tourSeen` is reset so everyone sees the
  new bilingual Welcome Guide once. Personal history, results and comments stay.
- **5 second timer, numbers only by default.** `writeMode: "fixed"`,
  `writeFixed: 5`, `sentence: false`, `repeats: 2`, `rate: 0.85`,
  `numbers: true`, `mode: "paper"`, `pauseWord: 1.2`, `pauseSent: 1.6`.
- **One tap EN | සිංහල.** `#btnLang` in the header (and at the top of the Welcome
  Guide) translates navigation, Home actions and player controls through
  `STRINGS_SI` / `T()`; dictation audio always stays British English.
- **Creator credits everywhere.** “Created by Hansana · Idea given by Ayya01
  (Lesandu) · Lecturer in Charge: Sumodya Sewmini” (Sinhala: නිර්මාණය: Hansana ·
  අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Sumodya Sewmini) in the header,
  Home footer, Settings → About and the Welcome Guide.
- **Four-tier British female professor audio.** Tier 1 streams Oxford/Cambridge
  UK MP3s, then AWS Polly **Amy** (en-GB), then Polly **Emma**, then Google
  en-GB, all through the single unlocked `#sdpAudio` element; Tier 2 ranks
  British female device voices first with `pitch = 1.06`; Tier 3 keeps the
  `-uk.mp3` / `En-uk-` recordings; Tier 4 falls back to any English female voice,
  still tagged `en-GB`. `tyre/tire` is spoken “tyre” and either spelling is
  marked 100% correct.
- **Real-time sync, zero fake numbers.** `data/version.json` and
  `data/session.json` are fetched cache-busted on boot, the v7 ntfy topics are
  polled and streamed over SSE, `#chipNet` only claims “Online · Live Sync”
  after a real response, and Class stats are computed strictly from real student
  results.
- **Guide, admin and tests.** New Welcome & Complete User Guide (four steps, both
  languages), PIN `7898`, one-tap **Save & Publish Live Now**, a 30-row paper
  self-check, and `tests/upgrade.test.cjs` rewritten from scratch for v7.

## 2.0.0 (v6) — 2026-10-22 (Session 6)

- **Every older word list is gone.** Session 6 — *Travel & Transport* is the only
  list in `index.html`, `data/session.json` and `data/config.json`: 30 Cambridge B1
  words (`travel` … `guest`, including `boarding pass`, `capital city`,
  `driver's licence`, `exchange rate`), each pre-filled with a British meaning, a B1
  example sentence and a UK dictionary MP3. `CONFIG.key` is `sdp.v6_travel`,
  `CONFIG.schema` and `settingsRev` are `6`, and the live topics are
  `sdp_dictationb1_state_v6` / `_comm_v6` / `_inbox_v6`.
- **Migration drops the old cache on every phone.** `DB.load()` and `DB.migrate()`
  overwrite `lists`, `plan` and `session` and delete `snapshot`, `sessions` and
  `outbox` whenever `settingsRev < 6`, so no leisure, hobby or sport word can survive
  an update. Class results, comments and personal history are kept.
- **5 second timer only.** Writing time is `writeMode: "fixed"` / `writeFixed: 5`
  (`writeSecs()` returns 5), with `sentence: false`, `repeats: 2`, `rate: 0.85`,
  `numbers: true`, `mode: "paper"`, `pauseWord: 1.2`, `pauseSent: 1.6`.
- **Paper self-check actually renders.** The Results screen now inserts every one of
  the 30 tap-to-mark rows (`Correct` / `Missed`) — the rows were built but never
  attached to the checklist — and the score ring, history entry and the
  `status: "finished"` community post update live.
- **Four-tier British audio, word by word.** Tier 1 walks the recorded UK sources in
  order (the word's own MP3, cached dictionary audio, the Oxford/Cambridge CDN, the
  Free Dictionary `-uk.mp3`, then the Wiktionary `En-uk-` recording), Tier 2 uses an
  installed `en-GB` voice (Daniel, Martha, Arthur, Kate, Serena, Google UK English,
  Microsoft Sonia/Ryan/Hazel), Tier 3 streams Google `tl=en-GB` (then StreamElements
  Amy) through the shared `#sdpAudio` element when no UK voice exists, and Tier 4
  speaks with any English voice tagged `en-GB`. Prompts with no dictionary entry
  (greetings, `Number 3`) go straight to the voice instead of hunting a recording.
- **Paste pipeline.** `Admin.parseWords` strips trailing part-of-speech tags
  (`driver's licence(n)` → `driver's licence`), auto-fills `m`/`s` from the
  built-in B1 lexicon plus `api.dictionaryapi.dev` and the Wiktionary REST API, and
  the single lag-free table keeps the one-tap **Save & Publish Live Now** button.
- **Marking understands UK spellings.** `driver's licence`, `drivers licence` and
  `driver's license` all count (the last with the UK spelling note), apostrophes are
  ignored when comparing, and every other word is marked word by word.
- **Honest sync chip.** `#chipNet` reads `Online · Live Sync` only after a real
  HTTP 200 or an open `EventSource`, `Syncing…` while a post or the first connection
  is in flight, and `Offline · Saved on device` when the device is offline.
- **Home hero.** `SESSION 6 · 19 OCT 2026` / `Session 6 - Travel & Transport` /
  `30 words · 5s timer`, straight from the active session.
- `tests/upgrade.test.cjs` was rewritten from scratch for v6 (13 tests: data files,
  in-app defaults, migration, timer, paste tags, UK marking, audio candidates, the
  network chip and the 30-row paper checklist). `tests/phase1.cjs` (68 checks) and
  `tests/upgrade-browser.cjs` were updated to the v6 storage key, build stamp, live
  topics and publish label; the browser suite now skips with an explicit message when
  no runnable browser exists in the environment instead of failing on library issues.

## 2.0.0 — 2026-10-14 (released to GitHub Pages)

- **CI fix (third pass).** With the full history checked out, the real browser suites ran: `tests/browser.cjs` counts every http(s) request made at boot, so the live channel is now explicitly allowlisted there (the two cached reads plus the one SSE stream — all read-only GETs; any POST, any Apps Script or GitHub call and any other host is still a failure). The publish toast keeps its `Saved & published to all students …` wording that `tests/upgrade-browser.cjs` waits for, with the session number and live-sync state appended.
- **CI fix (second pass).** The single-word-table refactor left a dangling `wbox.appendChild(libAct)` that aborted the rest of the Admin Words tab (the planner and the list actions never rendered) — caught by `tests/phase1.cjs` under the full-history CI checkout. The list actions now live in the one words card. `Eng.pause` flushes the snapshot at once, and `Speech.isBritishAudio` keeps a non-UK recording (`us.mp3`) from ever outranking the recorded British audio or the en-GB voice.
- **Real-time class channel (ntfy.sh, free + open source, no key).** Three public topics carry the class the moment it happens: `sdp_dictationb1_state_v2` (the published session), `sdp_dictationb1_comm_v2` (community posts and every student completion) and `sdp_dictationb1_inbox_v2` (a student's private message). `Cloud.bootSync()` fetches `./data/session.json?t=…`, polls `…/json?poll=1&since=all` for the cached messages and opens one `EventSource(…/sse)` stream on the first frame of the page — no tap required — and the newest payload (`publishedAt`/`ver`) wins. A lecturer publish is broadcast once and every open phone repaints with the new word list, session number, day, date and title; the outbox drains over the same channel, so a job can no longer sit at **1 waiting** on a device with no Apps Script URL.
- **Honest status chip.** `#chipNetText` now reads `Online · Live B1 Session v2.0.0 · Synced 5 min ago`, `Syncing…` while a post is in flight, `Offline · Saved on device` when the device is really offline, and a real `· N waiting` count taken from the outbox — never a fixed badge.
- **Real class statistics.** `Admin.tabStats` (Class overview, Average score by session, Devices, CSV) is computed from real student completions (`DB.data.results`, live cloud events merged in), shows zero — not an invented number — until a student really finishes, and the lecturer's own practice history is labelled and excluded from class scores.
- **Session header can never contradict the page.** A list named `Session 4 words` sets the session number automatically on publish, `d.session.day` is always derived from the real session date, and a locally frozen past date is moved to the real date (`DB.refreshSessionDate`) unless the date was deliberately planned or published.
- **Four-tier British audio engine.** A single shared `<audio id="sdpAudio">` element, unlocked inside the first tap, tries a recorded Cambridge/Oxford UK dictionary MP3 first, then the device `en-GB` voice, then a streamed cloud British TTS voice, then any installed English voice, then the second free British TTS host (`api.streamelements.com`, voice Amy) if the first is blocked, and finally a WebAudio chime with the word on screen. The shared element keeps `crossorigin="anonymous"` for CORS-friendly hosts and retries the same file once without it, so a host that sends no CORS headers still plays. The "No UK English voice found" sheet can no longer block `Eng.start` or `Speech.say`, and a missing device voice never drops a phone into silent Text mode. The Ready sheet and Settings → Voice both show a `UK Audio Ready` pill and a **Test sound** button, and the greeting is spoken on the Ready sheet, but it stands down as soon as the run itself has started so it can never cancel the first beat (the `Number 1.` line).
- **Default list is the 30 Cambridge B1 "Leisure & Hobbies" words** (`hobbies` … `torch`), each pre-filled with a B1 meaning, a B1 example sentence and a UK MP3 URL; the same list is published as `data/session.json`.
- **Dictionary examples are no longer filtered.** `Dict.parse` keeps any real example sentence the Free Dictionary API returns (the old 8-to-14-word rule threw away most of them, including `Take a torch.`) and `Dict.wikiLookup` falls back to the open Wiktionary REST API for a definition, an example and free British Ogg recordings when the primary entry has none.
- **Automatic meaning & sentence generator** in `Admin.parseWords`: built-in B1 bank first (30 leisure + previous sample + common B1 words), then a background dictionary lookup, then a clean B1 template, so `s`/`m` are never blank and no separate enrich button is needed.
- **Streamlined Admin editor** on four steps (paste → review → session & class day → one-tap **Save & Publish to All Students**), a live "30 words ready — meanings & sentences auto-filled" badge, and `Admin.saveAll` publishing list + active session + plan + cloud queue + Home at once. Lecturer PIN stays `7898`, supports a physical keyboard (digits, Backspace, Enter) and auto-unlocks as soon as the four digits are in; a cloud login failure still falls back to the device PIN.
- **Dictation defaults** are now `sentence: false`, `repeats: 2`, `rate: 0.85`, `numbers: true`, `mode: "paper"`, with schema 3 and a `settingsRev: 2` migration that also swaps an existing install's sample list for the 30 leisure words and publishes it.
- **Classes are Tuesday and Wednesday only**: the date list returns the next 8 class dates, "Next session" advances Tue/Wed, and the weekly planner highlights the two class days behind a collapsed "Other days" disclosure.
- **Data files are schema `ver: 3` / app `version: "2.0.0"`** (`data/version.json`, `data/config.json` with the class days, defaults and the three live topic URLs, `data/session.json` with the 30 published words).
- **Always-on online mode**: `data/version.json`, `data/session.json` and `data/config.json` are fetched with `cache: "no-store"` on boot and on Refresh, cache-busting `<meta>` tags stop stale pages, the status chip reads `Online · Live B1 Session` (never "Local mode" while online), and Settings & Tools gained one-tap **GitHub Direct Publish** plus **Download session.json**.
- **Community auto-completion**: finishing a dictation posts an anonymous `Completed Session X · Score: Y/30 (Z%)` entry (with device metadata) to Community and the sync queue, and it updates live when the paper self-check score changes.
- **One word table and one tap**: the duplicate 30-row "Reorder words" card is gone (the single paste table already reorders, deletes and edits), and a sticky **Save & Publish Live (30 words)** button under the paste box parses, saves, syncs the session header, publishes and broadcasts in one click.
- **Lag removal**: the frame probe samples at most 60 frames once and permanently cancels its `requestAnimationFrame` loop, low-core/low-memory phones start in `lite` with gradient-based "liquid glass" instead of scrolling `backdrop-filter`, the duplicate `.bak` write only happens on session finish or publish, the per-word snapshot is debounced by 400 ms and flushed on finish/pause/publish, and `dictCache` is capped FIFO at 200 entries.
- **Paper-mode self-check**: the Results screen lists every word with tap-to-mark *Got it right / Missed it* controls that live-update the score ring, `DB.data.history` and the community post.
- `tests/upgrade.test.cjs` covers the whole v2.0.0 surface (101 tests), and the Chromium/WebKit QA scripts now assert the v2.0.0 contract (light saves, one-tap publish, four-tier audio, the auto-submitting PIN pad); `tests/live-lab.cjs` boots two real devices against a local HTTP server and an in-process ntfy emulator and proves the live publish/completion round trip (13 checks), and `tests/phase1.cjs` now skips cleanly when the historical baseline commit is absent from a shallow clone so it cannot block CI.

## 1.5.0-rc.1 — 2026-10-14 (unreleased; partial Phase 1)

- Whole-paste format detection, quote-aware CSV, plain comma/semicolon/bullet lists, ordered case-insensitive de-duplication, and explicit format override.
- Editable full preview, chunked row rendering, deletion, drag ordering and accessible Up/Down alternatives. Counts no longer treat absent optional sentences as problems. Invalid/ambiguous input blocks saving/publishing rather than silently dropping problematic rows.
- Replace/Add draft labels, Tuesday/Wednesday date chips, and Publish confirmation based on the current preview and chosen dates.
- One sticky admin wrapper prevents the status/tab overlap. Labelled Publish selector, keyboard-focusable calendar and corrected segmented-control ARIA.
- Schema 2 migration: default word repetition twice, example sentences off, original stored data retained in an additional recovery key; existing custom preferences survive later reloads.
- Tolerant UK language tags and cautious UK name matching. Explicit non-UK locale tags cannot be overridden by a name. Voice list refresh on first gesture, and stale voices cleared.
- Default PIN verifier precomputed; successful login re-salts and upgrades to PBKDF2 where supported. Existing hashes and fallback preserved. Recovery/security limits documented.
- Greeting on Start, guarded countdown callbacks and repeated taps, minimum four-second writing gap.
- Continuous foreground frame median probe, sticky Auto downgrade, no iPhone core-only downgrade, limited Full-mode blur and stricter Lite rendering.
- Added Node tests, real Chromium/WebKit CI entry points, axe checks, file-size/ES5 syntax budget, and reproducible Chrome trace harness.

Not a completed Phase 1 or a production release. Remaining work and verification limits are tracked in PHASE1_QA.md. No Phase 2 audio assets or Phase 3 Worker/cloud deployment is included.
