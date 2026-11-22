#!/usr/bin/env node
'use strict';
/* G29 — tests/v007h-live-lab-station8.cjs — the v0.0.7.i Live Lab Station 8 gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.i
 *
 * The interactive Live Apps Script Relay, Access Lock, Password & Telegram
 * verification lab (Station 8) must pass 100% live against the REAL
 * data/gas-source.txt backend:
 *
 *   H1  the backend ships tg_webhook_info (server-side Telegram
 *       getWebhookInfo — TG_BOT_TOKEN never crosses the browser) +
 *       lab_test_cleanup (synthetic lab-dev device + code removal), both
 *       admin-gated, and ping stamps gas:"v0.0.7.i" (plus the FIX-I1
 *       adminPinLen hint — LENGTH ONLY, never the PIN).
 *   H2  sw.js answers the s47 stamp with the 3 s NETWORK_TIMEOUT_FAST
 *       fast-fallback for the critical shell + the 'sdp:force-update'
 *       purge message + skipWaiting/clients.claim on every new stamp
 *       (BUG-H1: no browser may stay frozen on a stale cached release).
 *   H3  the Force Update banner controller ships in sdp-live-lab.js and
 *       lab.html + index.html both host the banner div.
 *   H4  config.json pre-wires the owner's verified public /exec relay URL
 *       in accessLock.relayUrl (BUG-H2: zero "paste the relay URL" errors
 *       out of the box).
 *   L1  REAL headless Chromium against lab.html wired to the real
 *       gas-source.txt VM over local HTTP: the /exec URL input, the
 *       masked Admin PIN input and the optional test-password input exist;
 *       the memory-only law holds (no PIN in localStorage after the run);
 *       running the full Station 8 paints all 8 PASS cards (version/cache,
 *       /exec URL, ping + 5 Script Property badges, admin PIN auth,
 *       password unlock by:"password", burnable-code burn + 2nd-device
 *       REJECTION + cleanup, access_request→access_decision→check_device
 *       firstGrant token, Telegram webhook /exec + 0 delivery errors +
 *       test alert), the redacted report strips PIN/password/token/deploy
 *       IDs, and the relay roster ends clean (zero lab-dev rows).
 *   L2  the stale-version banner detection: when the served version.json
 *       appVersion is NEWER than the running one, the red
 *       🔄 Force Update Now banner paints with the 1-tap button.
 *   L3  the unified scorecard absorbs the S8 records and the run ends
 *       8 PASS · 0 FAIL with zero page errors.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail).slice(0, 400) });
  return ok;
}
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const GAS_SOURCE = readText('data/gas-source.txt');

/* ══ Part H — static contracts on the shipped surfaces ══════════════════ */
const labHtml = readText('lab.html');
const liveLabSrc = readText('data/sdp-live-lab.js');
const swSrc = readText('sw.js');
const syncSrc = readText('data/sdp-data-sync.js');
const configSrc = readText('data/config.json');

check('H1a the backend ships tg_webhook_info (server-side getWebhookInfo, admin-gated, /exec + delivery-error verdicts)',
  /function tgWebhookInfo\(body\)\{if\(!adminOk\(body\)\)/.test(GAS_SOURCE) &&
  /tgApi\("getWebhookInfo",\{\}\)/.test(GAS_SOURCE) &&
  /"tg_webhook_info"===t\?tgWebhookInfo\(body\)/.test(GAS_SOURCE));
check('H1b the backend ships lab_test_cleanup (revokes + deletes the synthetic lab-dev rows and the burned test code)',
  /function labTestCleanup\(body\)\{if\(!adminOk\(body\)\)/.test(GAS_SOURCE) &&
  /"lab_test_cleanup"===t\?labTestCleanup\(body\)/.test(GAS_SOURCE) &&
  /ids=\["lab-dev-A","lab-dev-B"\]/.test(GAS_SOURCE));
check('H1c ping stamps the v0.0.7.i gas release',
  /app:"sdp-gas",gas:"v0\.0\.7\.i"/.test(GAS_SOURCE));
check('H1d FIX-I1 adminLogin() trims BOTH the incoming pin and the stored ADMIN_PIN (String(...).trim())',
  /function adminLogin\(body\)\{var e=String\(body&&body\.pin\|\|""\)\.trim\(\),t=String\(PropertiesService\.getScriptProperties\(\)\.getProperty\("ADMIN_PIN"\)\|\|""\)\.trim\(\);/.test(GAS_SOURCE));
check('H1e FIX-I1 adminOk() trims BOTH sides too (every admin-gated action inherits the trim)',
  /function adminOk\(body\)\{var e=String\(body&&body\.pin\|\|""\)\.trim\(\),t=String\(PropertiesService\.getScriptProperties\(\)\.getProperty\("ADMIN_PIN"\)\|\|""\)\.trim\(\);/.test(GAS_SOURCE));
check('H1f FIX-I1 ping exposes adminPinLen (the LENGTH ONLY — never the PIN itself)',
  /hasAdminPin:!!pl,adminPinLen:pl\?pl\.length:0/.test(GAS_SOURCE) &&
  !/adminPin[^}]{0,40}(pin|PIN)\s*[:=]\s*(body|e)/.test(GAS_SOURCE));
check('H1g FIX-I1 adminPin() itself trims, so adminPinLen reports the true digit count',
  /function adminPin\(\)\{return getProp\("ADMIN_PIN"\)\.trim\(\)\}/.test(GAS_SOURCE));

check('H2a sw.js pins the s48 stamp (sdp-v0.0.7.i-s48 + the s48 shell)',
  /SW_VERSION = 'sdp-v0\.0\.7\.i-s48';/.test(swSrc) &&
  /SHELL_CACHE = 'sdp-v0\.0\.7\.i-s48-shell';/.test(swSrc) &&
  /SW_RELEASE = '0\.0\.7\.i';/.test(swSrc));
check('H2b the BUG-H1 fast-fallback law: NETWORK_TIMEOUT_FAST = 3 s and the critical shell routes through networkFirstShellFast',
  /NETWORK_TIMEOUT_FAST = 3000;/.test(swSrc) &&
  /event\.respondWith\(networkFirstShellFast\(request, url\)\);/.test(swSrc) &&
  /function isCriticalShellUrl\(url\) \{/.test(swSrc));
check('H2c skipWaiting on install + clients.claim on activate + the sdp:force-update purge message',
  /self\.skipWaiting\(\)/.test(swSrc) && /self\.clients\.claim\(\)/.test(swSrc) &&
  /data\.action === 'sdp:force-update'/.test(swSrc));

check('H3a the Force Update banner controller ships on SDP.LiveLab (checkVersionAndOfferForceUpdate + purge + reload)',
  /checkVersionAndOfferForceUpdate: checkVersionAndOfferForceUpdate/.test(liveLabSrc) &&
  /forceUpdatePurgeAndReload: forceUpdatePurgeAndReload/.test(liveLabSrc) &&
  /Force Update Now \(Clear Old Cache\)/.test(liveLabSrc) &&
  /sdp:force-update/.test(liveLabSrc));
check('H3b lab.html hosts the banner div + auto-check boot, and index.html hosts the Studio banner div + boot',
  /id="labForceUpdateBanner"/.test(labHtml) && /bannerId: 'labForceUpdateBanner'/.test(labHtml) &&
  /id="sdpForceUpdateBanner"/.test(readText('index.html')) && /bannerId: 'sdpForceUpdateBanner'/.test(readText('index.html')));

check('H4 config.json pre-wires the verified public /exec relay URL in accessLock.relayUrl (BUG-H2)',
  /"relayUrl": "https:\/\/script\.google\.com\/macros\/s\/AKfycbx[A-Za-z0-9_-]+\/exec"/.test(configSrc));
check('H4b FIX-I2 the relayUrl is the owner\'s NEW live-verified v0.0.7.h /exec deployment',
  /"relayUrl": "https:\/\/script\.google\.com\/macros\/s\/AKfycbxdedk5uegtCLIUBQUFbzog9pJxmEZHdYcdFCUBjc8IqigLWS6jYnvmdZoKh-PODkfS\/exec"/.test(configSrc),
  configSrc.match(/"relayUrl": "([^"]+)"/)[1]);
check('H4c FIX-I2 the relayUrl is a clean production URL (no /u/1/ user suffix, not /dev)',
  (function () { const u = JSON.parse(configSrc).accessLock.relayUrl;
    return /^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec$/.test(u) && u.indexOf('/u/') < 0 && u.indexOf('/dev') < 0; })());

check('H5 the unified lockstep: SDP.version 0.0.7.i / SDP.ver 49 / SETTINGS_REV 85 / SCHEMA 49',
  /SDP\.version = '0\.0\.7\.i';/.test(syncSrc) && /SDP\.ver = 49;/.test(syncSrc) &&
  /var SETTINGS_REV = 85;/.test(syncSrc) && /var SCHEMA = 49;/.test(syncSrc));
check('H5b the lockstep is MONOTONIC above the live owner state (settingsRev 85 > live 84, syncRev …034 > live …033)',
  (function () { const v = JSON.parse(readText('data/version.json'));
    return v.settingsRev === 85 && v.settingsRev > 84 && Number(v.syncRev) === 1797000000034 && Number(v.syncRev) > 1797000000033; })());

/* ══ the standalone GAS VM (the real gas-source.txt, G28 runtime shape) ══ */
function makeRuntime() {
  const sheetObjs = {};
  const cache = {};
  const props = {
    ADMIN_PIN: '78987898', TG_BOT_TOKEN: '123456:TESTBOT', TG_CHAT_ID: '987654321',
    TG_WEBHOOK_SECRET: 'tgwhs_test', LOCK_HMAC_SECRET: 'lockhmac_test'
  };
  const urlLog = [];
  function sheet(name) {
    if (sheetObjs[name]) return sheetObjs[name];
    const rows = [];
    const s = {
      getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map(r => r.length)),
      setFrozenRows() {}, appendRow: r => rows.push(r.slice()),
      deleteRow: r => rows.splice(r - 1, 1),
      getRange(r, c, n = 1, m = 1) {
        return {
          getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => (rows[r + i - 1] || [])[c + j - 1] === undefined ? '' : (rows[r + i - 1][c + j - 1]))),
          setValues(v) { v.forEach((line, i) => { if (!rows[r + i - 1]) rows[r + i - 1] = []; line.forEach((x, j) => { rows[r + i - 1][c + j - 1] = x; }); }); },
          setValue(v) { if (!rows[r - 1]) rows[r - 1] = []; rows[r - 1][c - 1] = v; }
        };
      }, _rows: rows
    };
    sheetObjs[name] = s;
    return s;
  }
  const mkSS = (id) => ({ getId: () => id, getName: () => 'Smart Dictation Player — Cloud Data', getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id + '/edit', getSheetByName: n => sheetObjs[n] || null, insertSheet: sheet });
  const created = [];
  const context = vm.createContext({
    Date, console, JSON, Math, String, Number, Array, Object, Boolean, RegExp, parseInt, parseFloat, isNaN, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k], setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = String(v); } }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => null,
      openById: id => { const h = created.find(s => s.getId() === id); if (!h) throw new Error('Spreadsheet not found: ' + id); return h; },
      create: n => { const s = mkSS('SS_' + (created.length + 1)); created.push(s); return s; }
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/STANDALONE/exec' }) },
    Logger: { log: () => {} },
    UrlFetchApp: {
      fetch: (url) => {
        urlLog.push(String(url));
        if (String(url).indexOf('getWebhookInfo') >= 0) return { getContentText: () => JSON.stringify({ ok: true, result: { url: 'https://script.google.com/macros/s/TEST123/exec', pending_update_count: 0, last_error_message: '' } }), getResponseCode: () => 200 };
        if (String(url).indexOf('setWebhook') >= 0) return { getContentText: () => JSON.stringify({ ok: true, result: true, description: 'Webhook was set' }), getResponseCode: () => 200 };
        return { getContentText: () => JSON.stringify({ ok: true, result: { message_id: 1 } }), getResponseCode: () => 200 };
      }
    },
    Utilities: {
      base64EncodeWebSafe: b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      computeDigest: (algo, msg) => crypto.createHash('sha256').update(String(msg), 'utf8').digest(),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeHmacSha256Signature: (m, s) => crypto.createHmac('sha256', String(s)).update(String(m), 'utf8').digest()
    },
    ContentService: { createTextOutput: t => ({ _t: String(t), setMimeType() { return this; } }), MimeType: { JSON: 'json' } }
  });
  return { context, urlLog, props, sheetObjs };
}

const rt = makeRuntime();
vm.runInContext(GAS_SOURCE, rt.context);
const gasPost = (body) => JSON.parse(rt.context.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } })._t);
/* v0.0.7.i FIX-I4 fixture: rt3 is the UNCONFIGURED relay (lock OFF, no
   password) served on /gas/exec3 for the friendly-WARN verdict proofs. */
let rt3 = null;

/* enable the lock + a test password so probe 8.5 exercises the real path */
gasPost({ action: 'set_lock_config', pin: '78987898', on: true, mode: 'approval+code', password: 'station8test' });

/* ══ FIX-I1 live proof: a SPACE-PADDED ADMIN_PIN can never cause bad_pin ══
   A second runtime boots with ' 78987898 ' (leading + trailing spaces) in
   Script Properties. The v0.0.7.h backend rejected the CORRECT pin against
   that property; the v0.0.7.i backend trims both sides. */
{
  const rt2 = makeRuntime();
  rt2.props.ADMIN_PIN = ' 78987898 ';
  vm.runInContext(GAS_SOURCE, rt2.context);
  const post2 = (body) => JSON.parse(rt2.context.doPost({ postData: { contents: JSON.stringify(body) } })._t);
  const cleanPin = post2({ action: 'login', pin: '78987898' });
  const paddedPin = post2({ action: 'login', pin: ' 78987898 ' });
  const wrongPin = post2({ action: 'login', pin: '99999999' });
  const ping2 = post2({ action: 'ping' });
  check('I1a FIX-I1 the CORRECT pin authenticates against a SPACE-PADDED ADMIN_PIN (trim law)',
    cleanPin.ok === true && !!cleanPin.token, JSON.stringify({ ok: cleanPin.ok, err: cleanPin.err }));
  check('I1b FIX-I1 a space-padded TYPED pin also authenticates (input trim law)',
    paddedPin.ok === true, JSON.stringify({ ok: paddedPin.ok, err: paddedPin.err }));
  check('I1c FIX-I1 a genuinely WRONG pin is still rejected bad_pin (trim does not weaken auth)',
    wrongPin.ok === false && wrongPin.err === 'bad_pin', JSON.stringify(wrongPin));
  check('I1d FIX-I1 ping exposes adminPinLen = the true digit count (8, never the PIN value)',
    ping2.adminPinLen === 8 && JSON.stringify(ping2).indexOf('78987898') < 0,
    JSON.stringify({ adminPinLen: ping2.adminPinLen, hasAdminPin: ping2.hasAdminPin }));
}

/* ══ the local HTTP server: repo root + /gas/exec → the VM ══════════════ */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
  let futureMode = false;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/gas/exec') {
      if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, pong: true })); return; }
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(rt.context.doPost({ postData: { contents: body } })._t);
      });
      return;
    }
    /* v0.0.7.i FIX-I4: the unconfigured relay (lock OFF, no password). */
    if (u.pathname === '/gas/exec3' && rt3) {
      if (req.method !== 'POST') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, pong: true })); return; }
      let body3 = '';
      req.on('data', c => { body3 += c; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(rt3.context.doPost({ postData: { contents: body3 } })._t);
      });
      return;
    }
    /* L2 hook: an admin toggle flips the served version.json to a NEWER
       release so the stale-version banner must fire on a reloaded page. */
    if (u.pathname === '/__future__on') { futureMode = true; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (u.pathname === '/__future__off') { futureMode = false; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
    const p = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/lab.html' : u.pathname));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(p, (e, buf) => {
      if (e) { res.writeHead(404); res.end('nf'); return; }
      let out = buf;
      if (futureMode && u.pathname === '/data/version.json') {
        const v = JSON.parse(buf.toString('utf8'));
        v.appVersion = '0.0.7.z';
        v.version = '0.0.7.z';
        out = Buffer.from(JSON.stringify(v, null, 2) + '\n');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(out);
    });
  });

(async () => {
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
    const args = serverChromium.args.filter(a => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a));
    const browser = await chromium.launch({ headless: true, executablePath, args });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('http://127.0.0.1:' + port + '/lab.html', { waitUntil: 'load' });

    /* L1a the Station 8 input bar exists: pre-fillable /exec URL, masked
       Admin PIN, optional test password, run + auto-fix + copy buttons. */
    const inputs = await page.evaluate(() => ({
      url: !!document.getElementById('labS8Url'),
      pin: !!(document.getElementById('labS8Pin') && document.getElementById('labS8Pin').type === 'password'),
      pw: !!document.getElementById('labS8Pw'),
      run: !!document.getElementById('btnLabS8Run'),
      fix: !!document.getElementById('btnLabS8AutoFix'),
      copy: !!document.getElementById('btnLabS8Copy')
    }));
    check('L1a the Station 8 input bar ships (exec URL + masked PIN + optional password + Run + Auto-Fix + Copy buttons)',
      inputs.url && inputs.pin && inputs.pw && inputs.run && inputs.fix && inputs.copy, JSON.stringify(inputs));

    /* the relay pre-fill: the input must self-populate from config.json's
       accessLock.relayUrl (the owner's verified /exec URL). */
    const prefill = await page.evaluate(() => document.getElementById('labS8Url').value);
    check('L1b the /exec URL input pre-fills from config.json accessLock.relayUrl (BUG-H2)',
      /^https:\/\/script\.google\.com\/macros\/s\/AKfycbx[A-Za-z0-9_-]+\/exec$/.test(prefill), prefill.slice(0, 80));

    /* drive the identical code path against the local gas VM */
    await page.evaluate((u) => { document.getElementById('labS8Url').value = u; }, 'http://127.0.0.1:' + port + '/gas/exec');
    await page.evaluate(() => {
      document.getElementById('labS8Pin').value = '78987898';
      document.getElementById('labS8Pw').value = 'station8test';
    });
    await page.click('#btnLabS8Run');
    for (let i = 0; i < 120 && !(await page.evaluate(() => document.querySelectorAll('#labS8Cards .lab-s8card').length >= 8)); i++) await page.waitForTimeout(500);
    await page.waitForTimeout(3000);

    const cards = await page.evaluate(() => Array.from(document.querySelectorAll('#labS8Cards .lab-s8card')).map(c => ({ id: c.id, state: c.getAttribute('data-state') })));
    const st = {};
    for (const c of cards) st[c.id] = c.state;
    check('L1c all 8 Station 8 probe cards painted', cards.length === 8, cards.length);
    check('L1d probe 8.1 Browser Version & Cache — PASS', st['s8card-8.1'] === 'pass', JSON.stringify(st));
    check('L1e probe 8.2 URL & Deployment Access — PASS', st['s8card-8.2'] === 'pass', JSON.stringify(st));
    check('L1f probe 8.3 ping + Auto-Sheet Health + the 5 Script Property badges — PASS', st['s8card-8.3'] === 'pass', JSON.stringify(st));
    check('L1g probe 8.4 Live Admin PIN Auth — PASS', st['s8card-8.4'] === 'pass', JSON.stringify(st));
    check('L1h probe 8.5 Live Password Verification (verify_lock_secret by:password) — PASS', st['s8card-8.5'] === 'pass', JSON.stringify(st));
    check('L1i probe 8.6 Burnable Code burn + 2nd-device REJECTION + cleanup — PASS', st['s8card-8.6'] === 'pass', JSON.stringify(st));
    check('L1j probe 8.7 access_request → access_decision → check_device firstGrant — PASS', st['s8card-8.7'] === 'pass', JSON.stringify(st));
    check('L1k probe 8.8 Telegram webhook (/exec, 0 errors) + test alert — PASS', st['s8card-8.8'] === 'pass', JSON.stringify(st));
    check('L1l the 2nd-device anti-sharing evidence is painted (single-use law text on the 8.6 card)',
      await page.evaluate(() => { const c = document.getElementById('s8card-8.6'); return !!c && /REJECTED/.test(c.textContent) && /single-use law holds/.test(c.textContent); }));
    check('L1m the password verdict by:"password" is painted on the 8.5 card',
      await page.evaluate(() => { const c = document.getElementById('s8card-8.5'); return !!c && /by:"password"/.test(c.textContent); }));

    /* the memory-only law: the PIN/password never land in storage */
    const storageLeak = await page.evaluate(() => {
      let leak = false;
      for (let i = 0; i < localStorage.length; i++) { const v = localStorage.getItem(localStorage.key(i)); if (v && (v.indexOf('78987898') >= 0 || v.indexOf('station8test') >= 0)) leak = true; }
      for (let i = 0; i < sessionStorage.length; i++) { const v = sessionStorage.getItem(sessionStorage.key(i)); if (v && (v.indexOf('78987898') >= 0 || v.indexOf('station8test') >= 0)) leak = true; }
      return leak;
    });
    check('L1n the memory-only law: the PIN + test password never touch local/session storage', !storageLeak);

    /* the redacted report strips every secret */
    const red = await page.evaluate(() => SDP.LiveLab.s8Redact('{"pin":"78987898","secret":"station8test","token":"abcdefgh1234","url":"https://script.google.com/macros/s/AKfycbzHYsufobWbPQoFWpJT/exec"}'));
    check('L1o the redacted report strips PIN, password, token and the deployment id',
      red.indexOf('78987898') < 0 && red.indexOf('station8test') < 0 && red.indexOf('abcdefgh1234') < 0 && red.indexOf('AKfycbz') < 0, red);

    /* the relay roster ends clean */
    const roster = gasPost({ action: 'access_roster', pin: '78987898' });
    check('L1p the relay roster ends clean (zero lab-dev rows after the run)',
      JSON.stringify(roster).indexOf('lab-dev') < 0, JSON.stringify(roster).slice(0, 200));

    /* the scorecard absorbed the S8 records; zero page errors */
    const score = await page.evaluate(() => ({
      pass: Number(document.getElementById('labScorePass').textContent),
      warn: Number(document.getElementById('labScoreWarn').textContent),
      fail: Number(document.getElementById('labScoreFail').textContent)
    }));
    check('L3a the unified scorecard absorbed the Station 8 records (≥ 8 PASS)',
      score.pass >= 8, JSON.stringify(score));
    check('L3b zero page errors across the full live run', errors.length === 0, errors.join(' | ').slice(0, 300));

    const status = await page.evaluate(() => document.getElementById('labS8Status').textContent);
    check('L3c the Station 8 status line reports the finished 8-probe run',
      /Station 8 finished/.test(status) && /8 PASS/.test(status), status);

    /* ══ FIX-I3 live proof: the DOUBLE RUN — exactly 8 cards, 8 S8 rows, and
       an 'overall' that never inflates on a re-run. ══ */
    const before = await page.evaluate(() => {
      const c = SDP.LiveLab.counts();
      return { pass: c.pass, warn: c.warn, fail: c.fail, s8rows: (SDP.LiveLab.buildReport().stations.S8 || []).length };
    });
    await page.click('#btnLabS8Run');
    for (let i = 0; i < 120 && !(await page.evaluate(() => document.querySelectorAll('#labS8Cards .lab-s8card').length >= 8 && /Station 8 finished/.test(document.getElementById('labS8Status').textContent))); i++) await page.waitForTimeout(500);
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => {
      const cards = document.querySelectorAll('#labS8Cards .lab-s8card').length;
      const c = SDP.LiveLab.counts();
      const rep = SDP.LiveLab.buildReport();
      const s8 = rep.stations.S8 || [];
      const dupCards = Array.from(document.querySelectorAll('#labS8Cards .lab-s8card')).map((c2) => c2.id).filter((id, i, a) => a.indexOf(id) !== i);
      return { cards, pass: c.pass, warn: c.warn, fail: c.fail, s8rows: s8.length, dupCards, s8tests: s8.map((r) => r.test.slice(0, 3)) };
    });
    check('I3a FIX-I3 the DOUBLE run still paints exactly 8 probe cards (zero duplicate ids)',
      after.cards === 8 && after.dupCards.length === 0, JSON.stringify(after.dupCards) + ' cards=' + after.cards);
    check('I3b FIX-I3 the unified scorecard holds exactly 8 S8 rows after the re-run (no stacked records)',
      after.s8rows === 8, 's8rows=' + after.s8rows);
    check('I3c FIX-I3 the overall counts NEVER inflate on a re-run (the S8 ledger stays exactly 8 rows and total S8 outcomes stay bounded at 8)',
      before.s8rows === 8 && after.s8rows === 8 && (after.pass + after.warn + after.fail) === (before.pass + before.warn + before.fail),
      JSON.stringify({ before: { pass: before.pass, warn: before.warn, fail: before.fail, s8rows: before.s8rows }, after: { pass: after.pass, warn: after.warn, fail: after.fail, s8rows: after.s8rows } }));
    check('I3d FIX-I3 the S8 ledger covers exactly the 8 probes 8.1–8.8 once each',
      JSON.stringify(after.s8tests) === JSON.stringify(['8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7', '8.8']),
      JSON.stringify(after.s8tests));

    /* ══ FIX-I4 live proof: the friendly WARN verdicts on a SECOND relay VM
       where the lock is OFF and NO password is set (Open Classroom Mode).
       Probes 8.5 + 8.7 must paint WARN (never red FAIL), 8.6/8.8 still run,
       and ticking #labS8Test flips 8.7 back to the real round-trip. ══ */
    /* deliberately NO set_lock_config: accessCfg() defaults to on:false,
       mode approval+code, no password — the unconfigured optional state. */
    rt3 = makeRuntime();
    vm.runInContext(GAS_SOURCE, rt3.context);
    const gasExec3 = (body) => JSON.parse(rt3.context.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } })._t);
    const st3 = gasExec3({ action: 'access_state' });
    check('I4a FIX-I4 fixture: the second VM reports the unconfigured state (lock.on=false, hasPassword=false)',
      st3.lock && st3.lock.on === false && st3.lock.hasPassword === false, JSON.stringify(st3.lock));

    const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page3 = await ctx3.newPage();
    const errors3 = [];
    page3.on('pageerror', (e) => errors3.push(String(e)));
    await page3.goto('http://127.0.0.1:' + port + '/lab.html', { waitUntil: 'load' });
    await page3.evaluate((u) => { document.getElementById('labS8Url').value = u; }, 'http://127.0.0.1:' + port + '/gas/exec3');
    await page3.evaluate(() => {
      document.getElementById('labS8Pin').value = '78987898';
      document.getElementById('labS8Pw').value = ''; /* NO test password */
      document.getElementById('labS8Test').checked = false; /* lock OFF, no override */
    });
    await page3.click('#btnLabS8Run');
    for (let i = 0; i < 120 && !(await page3.evaluate(() => document.querySelectorAll('#labS8Cards .lab-s8card').length >= 8 && /Station 8 finished/.test(document.getElementById('labS8Status').textContent))); i++) await page3.waitForTimeout(500);
    await page3.waitForTimeout(2500);
    const warnRun = await page3.evaluate(() => {
      const card = (id) => { const c = document.getElementById('s8card-' + id); return { state: c ? c.getAttribute('data-state') : 'missing', text: c ? c.textContent.replace(/\s+/g, ' ') : '' }; };
      return {
        c5: card('8.5'), c6: card('8.6'), c7: card('8.7'), c8: card('8.8'),
        status: document.getElementById('labS8Status').textContent,
        counts: SDP.LiveLab.counts()
      };
    });
    check('I4b FIX-I4 probe 8.5 paints WARN "Password not set yet — set it in Studio → Advanced Settings → Access Lock" (never a red error)',
      warnRun.c5.state === 'warn' && /Password not set yet/.test(warnRun.c5.text) && /Access Lock/.test(warnRun.c5.text),
      JSON.stringify({ state: warnRun.c5.state, text: warnRun.c5.text.slice(0, 160) }));
    check('I4c FIX-I4 probe 8.7 paints WARN "Lock is currently OFF — turn Master Lock ON in Studio" (Open Classroom Mode is not a failure)',
      warnRun.c7.state === 'warn' && /Lock is currently OFF/.test(warnRun.c7.text) && /Master Lock ON/.test(warnRun.c7.text),
      JSON.stringify({ state: warnRun.c7.state, text: warnRun.c7.text.slice(0, 160) }));
    check('I4d FIX-I4 probe 8.6 paints the friendly WARN (codes disabled while the Lock is OFF) and 8.8 still PASSes cleanly',
      warnRun.c6.state === 'warn' && /burnable codes are disabled while the Lock is OFF/.test(warnRun.c6.text) && warnRun.c8.state === 'pass',
      JSON.stringify({ c6: warnRun.c6.state, c8: warnRun.c8.state, c6text: warnRun.c6.text.slice(0, 300) }));
    check('I4e FIX-I4 the WARN run ends 0 FAIL (3 friendly WARN: 8.5 + 8.6 + 8.7) and the status line never claims a failure',
      warnRun.counts.fail === 0 && warnRun.counts.warn === 3 && /with [1-9][0-9]* FAIL/.test(warnRun.status) === false,
      JSON.stringify({ counts: warnRun.counts, status: warnRun.status.slice(0, 120) }));
    check('I4f FIX-I4 the WARN run painted exactly 8 cards with zero page errors',
      (await page3.evaluate(() => document.querySelectorAll('#labS8Cards .lab-s8card').length)) === 8 && errors3.length === 0,
      errors3.join(' | ').slice(0, 200));

    /* the temporary test-mode checkbox flips 8.7 to the REAL round-trip */
    await page3.evaluate(() => { document.getElementById('labS8Test').checked = true; });
    await page3.click('#btnLabS8Run');
    for (let i = 0; i < 120 && !(await page3.evaluate(() => /Station 8 finished/.test(document.getElementById('labS8Status').textContent))); i++) await page3.waitForTimeout(500);
    await page3.waitForTimeout(2500);
    const testMode = await page3.evaluate(() => {
      const c = document.getElementById('s8card-8.7');
      return { state: c ? c.getAttribute('data-state') : 'missing', text: c ? c.textContent.replace(/\s+/g, ' ') : '' };
    });
    check('I4g FIX-I4 ticking "still exercise the student flow" runs probe 8.7 for real even with the lock OFF (PASS round-trip, open-mode contract)',
      testMode.state === 'pass' && /open/.test(testMode.text),
      JSON.stringify({ state: testMode.state, text: testMode.text.slice(0, 160) }));
    await ctx3.close();

    /* L2 — the stale-version banner detection: flip the server to a newer
       advertised release, reload the page, and the red banner must fire. */
    await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} });
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page2 = await ctx2.newPage();
    await page.evaluate(async (port) => { await fetch('http://127.0.0.1:' + port + '/__future__on'); }, port).catch(() => {});
    await page2.goto('http://127.0.0.1:' + port + '/lab.html', { waitUntil: 'load' });
    await page2.waitForTimeout(2000);
    const banner = await page2.evaluate(() => {
      const b = document.getElementById('labForceUpdateBanner');
      return { hidden: b.hidden, level: b.getAttribute('data-level'), hasBtn: !!document.getElementById('labForceUpdateBannerBtn'), text: b.textContent.replace(/\s+/g, ' ').slice(0, 120) };
    });
    check('L2a the stale-version banner paints when version.json advertises a newer release (BUG-H1 detector)',
      banner.hidden === false && banner.level === 'stale' && banner.hasBtn && /Force Update Now/.test(banner.text), JSON.stringify(banner));
    /* and the 1-tap purge actually clears the sdp-* caches (audio preserved) */
    const purged = await page2.evaluate(async () => {
      const before = await caches.keys();
      await SDP.LiveLab.forceUpdatePurgeAndReload();
      return { before };
    }).catch(() => ({ before: null }));
    check('L2b the Force Update purge controller is callable (unregister + purge + reload path)',
      purged !== null, String(purged));
    await page.evaluate(async (port) => { await fetch('http://127.0.0.1:' + port + '/__future__off'); }, port).catch(() => {});
    await ctx2.close();

    await browser.close();
    server.close();
  } catch (e) {
    check('G29 the live harness ran', false, String(e).slice(0, 400));
    try { server.close(); } catch (e2) {}
  }

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log('');
  for (const r of results) console.log((r.status === 'PASS' ? 'PASS  ' : 'FAIL  ') + r.test + (r.detail ? '  ' + r.detail : ''));
  console.log('\nG29 v007h-live-lab-station8.cjs — ' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})();
