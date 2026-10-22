# Smart Dictation Player

A standalone, offline-capable `index.html`. No build, CDN, or runtime dependency. Open the file directly, or serve it over HTTPS. Development test packages are not used by the app.

## Release status

**2.0.0 (v8, 2026-10-22) is the released upgrade**: Session 7 — Travel & Transport (30 Cambridge B1 words, 5 second writing timer, Thursday 22/10/2026 · CCBE Galle Branch), the four-tier British **female professor** audio chain on every device, one-tap **EN | සිංහල** switching with the bilingual Welcome Guide, creator credits (Created by Hansana · Idea given by Ayya01 (Lesandu) · Lecturer in Charge: Sumodya Sewmini), the one-tap **Save & Publish Live Now** editor, always-on online mode through `data/*.json` and the v8 ntfy live channel, and the auto-lite performance work. An older install drops its cached lists, plan, session and snapshot on first load (`settingsRev < 8`), shows the Welcome Guide again and lands on Session 7. Phases 3–4 (service worker, Worker-based cloud) remain optional follow-up work; `QA_REPORT.md` and `PHASE1_QA.md` describe the earlier 1.5.0-rc.1 candidate.

## Add next week's words in three steps (candidate)

1. Unlock **Lecturer mode → Words & planner**. Paste the whole list: commas, semicolons, bullets, or one word per line. Multi-word entries such as “go shopping” stay together. For columns, use `word | sentence | meaning`, tabs, or CSV with a `word,sentence,meaning` header.
2. Check **“I read this as…”** and the counter. Use the one-tap format switch if necessary. Edit any preview cell, delete a row, or reorder using Drag / Up / Down (Up / Down work on phones). Correct all reported problems. Choose class-date chips (today plus the next four Tuesday/Wednesday dates), or another date/weekday in **Publish for**.
3. Tap **Publish to students** (or the sticky **Save & Publish Live** button) and check the word count, dates, and session number before confirming. It publishes the current preview, not the previous saved list, and a list called `Session 4 words` sets the session number to 4 by itself so the hero kicker and title always agree. Students need no setup at all: the published session is broadcast over the free ntfy.sh class channel, so every open phone updates within a second, and it is also written to `data/session.json` for the next page load.

**Replace this list** and **Add to this list** are optional draft actions. Each preserves the existing short-lived Undo. The full requested published version-history/Undo workflow is still outstanding.

## Saved data and migration

- The key stays `sdp.v1`; the schema inside it advances from 1 to 2.
- A one-time migration turns example sentences OFF and sets repeats to two. Subsequent changes to these settings are retained, not reset at each launch.
- Lists, published snapshots, history, answers, planner, custom PIN verifier, and queued jobs remain in place.
- The original pre-migration JSON is retained as `sdp.v1.before-v2` when storage is available. Existing recovery/backup keys remain supported.
- Export a backup before experimenting. Browser storage can be cleared by the user or operating system. This candidate has not added an installable PWA or persistent-storage guarantee.

## The lecturer PIN is a convenience lock

The existing default PIN remains unchanged; historical default-PIN literals have also been removed from the current test/document files (not Git history). The shipped HTML contains only its precomputed salted SHA-256 verifier, not the PIN text. On successful login the verifier is re-salted and upgraded to PBKDF2-HMAC-SHA-256 (120,000 iterations, 256-bit output) when Web Crypto is available. Without Web Crypto, salted SHA-256 is retained. Existing changed PINs are verified with their old scheme before upgrade. PIN creation/change uses the strongest supported scheme.

**A four-digit PIN in a public page is not real protection.** Anyone who can edit their browser's JavaScript or local storage can bypass this local lock, and short PINs can be guessed offline. PBKDF2 does not change that fact. The five-try lockout, idle lock, and Lock now are convenience safeguards. Only server-side authorization can protect cloud publishing.

A PBKDF2 verifier cannot be verified in an old/insecure context lacking Web Crypto: the app explains this rather than silently downgrading its verification. Open the HTTPS app in a current browser. The student/player parts remain usable offline.

### Forgot the local PIN (preserve data)

1. Use **Settings → My data → backup/export** before doing anything else. A locked export intentionally excludes the lecturer's private inbox and authentication material. Do **not** clear all site storage or use Reset if you need existing work.
2. For a complete private recovery copy, on your own trusted computer use browser developer tools → Application/Storage → Local Storage and copy the value of `sdp.v1` to a private local file. **Never upload that file to GitHub or share it publicly.** It may contain private messages. A helper can instead use a previously saved full backup.
3. In the console for this site, run this convenience-lock recovery only on your own device:
   ```js
   var d = JSON.parse(localStorage.getItem('sdp.v1'));
   if (!d || !Array.isArray(d.lists)) throw new Error('Stop: saved data is not valid');
   d.admin = {};
   localStorage.setItem('sdp.v1', JSON.stringify(d));
   location.reload();
   ```
   Lists and student work remain; the local default verifier is seeded again. Unlock with the existing default, then **Settings & tools → Change PIN**. If you cannot use developer tools, ask a trusted helper; do not send your full backup to a public issue.

This does not reset the PIN on an Apps Script or future Worker server. Server recovery must happen in that service's secret settings.

## Live class channel (v2.0.0)

Three public [ntfy.sh](https://ntfy.sh) topics carry the class in real time. ntfy is free, open source, needs no account and no API key, allows browser CORS, and both caches the last messages and streams new ones over Server-Sent Events:

| Topic | What travels on it |
| --- | --- |
| `sdp_dictationb1_state_v2` | the published session: number, day, date, title, the 30 words and the plan |
| `sdp_dictationb1_comm_v2` | community posts and every student completion (`Completed Session 4 · Score: 27/30 (90%)`) |
| `sdp_dictationb1_inbox_v2` | a student's private message to the lecturer |

On load the app fetches `./data/session.json?t=…`, polls `…/json?poll=1&since=all` for the cached messages and opens one `EventSource` stream; whichever payload is newest (`publishedAt`/`ver`) wins. Publishing from Admin mode posts once and every open phone repaints. If a network blocks ntfy, the repository JSON still updates students on their next load, and the status chip says exactly which state the device is in (`Online · Live B1 Session v2.0.0 · Synced …`, `Syncing…`, `Offline · Saved on device`).

**Privacy:** these topics are public, like any free ntfy channel. Only the words, the session header, anonymous nicknames and the score summary travel on them — never the PIN, never a name or a phone number, and never anything typed into a private reply.

## Cloud: current adapter versus planned Worker

The existing Google Apps Script adapter is still supported. Its setup remains under **Lecturer → Settings & tools**, including the embedded script, Cloud URL and test control. It has not been newly deployed or end-to-end verified against Google in this change.

GitHub Pages is static, and this repository is public. A browser cannot safely write to GitHub with an embedded token: everyone visiting the page could extract it. The requested Phase 3 design uses a server-side Cloudflare Worker for authorization/rate limits and D1 for concurrent writes, with secrets kept outside this repository. Public state/community snapshots may be batched to GitHub; private messages must never go there.

**The Worker, D1 schema, contract tests and ten-minute setup wizard do not exist yet.** There are no Worker setup steps to run in this candidate. Do not create a GitHub token or paste one into the app. Phase 3 is blocked until Phases 1 and 2 are merged and smoke-tested, per the release plan. Do not enter secrets in chat, issues, or committed files.

## Development verification

```sh
npm ci --prefix tests
node tests/check.cjs
node --test tests/upgrade.test.cjs
npm test --prefix tests
```

For Chromium on the minimal sandbox:

```sh
mkdir -p tests/artifacts/chromium-libs
node -e 'const fs=require("fs"),z=require("zlib");fs.writeFileSync("tests/artifacts/al2023.tar",z.brotliDecompressSync(fs.readFileSync("tests/node_modules/@sparticuz/chromium/bin/al2023.tar.br")))'
tar -xf tests/artifacts/al2023.tar -C tests/artifacts/chromium-libs
export LD_LIBRARY_PATH="$PWD/tests/artifacts/chromium-libs/lib"
node tests/upgrade-browser.cjs
npm run test:browser --prefix tests
npm run test:e2e --prefix tests
node tests/profile.cjs
```

The full historical E2E takes several minutes. On a normal development machine/CI, install Playwright's actual browsers, then select one:

```sh
./tests/node_modules/.bin/playwright-core install --with-deps chromium webkit
SDP_BROWSER_STANDARD=1 SDP_BROWSER=chromium node tests/upgrade-browser.cjs
SDP_BROWSER=webkit node tests/upgrade-browser.cjs
```

No test needs real cloud credentials. Test speech is synthetic; it verifies order/selection, not audible pronunciation or real iPhone audio policies. Raw traces and generated outputs stay in ignored `tests/artifacts/`.
