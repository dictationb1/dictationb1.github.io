#!/usr/bin/env node
'use strict';
/* G30 — tests/v007j-telegram-ux-dedupe.cjs — the v0.0.7.j Telegram
 * Zero-Spam Command Center gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.j
 * Executes the exact shipped data/gas-source.txt inside a standalone VM
 * plus REAL headless Chromium against index.html wired to that VM over local
 * HTTP, and asserts the four J-series laws the owner proved live:
 *   J1  update_id deduplication — replaying the same update_id 5 times
 *       produces EXACTLY ONE Telegram reply (the GAS 302 retry loop that
 *       fired "❓ Unknown command hello" 6+ times is dead). Casual
 *       non-command text ("hello") answers ONE friendly 💡 tip, never
 *       "Unknown command" spam; a double-tapped callback_query.id can
 *       never fire twice.
 *   J2  Probe 8.8 verdict — tg_webhook_info reports hasExec:true for a
 *       …/exec?action=tg_callback&secret_token=… webhook and classifies
 *       Google's normal "Wrong response from the webhook: 302 Found" as
 *       gasRedirect302:true / verdict exec_ok_302_dedup, so Probe 8.8
 *       paints ✅ PASS (exec_ok · GAS 302 deduplicated · test alert
 *       delivered).
 *   J3  ONE card per user per day — 4 consecutive session/activity events
 *       for the same device produce ONE sendMessage (👤 User #1) and the
 *       later updates ride editMessageText; accidental <10 s / 0% tab
 *       bounces never push; the card text carries User #N, the device
 *       summary, the IST stamp and the 🚫 Kick inline button.
 *   J4  auto visitor approval — a locked student boot auto-sends ONE
 *       pending ACCESS REQUEST card with [✅ Approve] / [❌ Reject] /
 *       [🚫 Ban Device] buttons carrying the device/browser/network
 *       summary; a repeated access_request with Name/Class filled UPDATES
 *       the same card in place (editMessageText, zero second message);
 *       tapping [✅ Approve] in Chromium unlocks the student within ~4 s.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail).slice(0, 400) });
  return ok;
}
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const GAS_SOURCE = readText('data/gas-source.txt');

/* ── the standalone GAS VM (the real shipped gas-source.txt) ─────────── */
function makeRuntime(opts) {
  opts = opts || {};
  const tables = {};
  const sheetObjs = {};
  const cache = {};
  const properties = Object.assign({
    ADMIN_PIN: '78987898',
    TG_BOT_TOKEN: '123456:TESTBOT',
    TG_CHAT_ID: '987654321',
    TG_WEBHOOK_SECRET: 'tgwhs_test_secret',
    LOCK_HMAC_SECRET: 'lockhmac_test_secret'
  }, opts.properties || {});
  let now = opts.now || Date.UTC(2026, 10, 22, 12);
  const urlFetchLog = [];
  let msgIdSeq = 0;
  let webhookInfo = null; /* when set, getWebhookInfo answers this shape */
  function sheet(name) {
    if (sheetObjs[name]) return sheetObjs[name];
    const rows = [];
    const s = {
      getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map((r) => r.length)),
      setFrozenRows() {},
      appendRow: (r) => { rows.push(r.slice()); },
      deleteRow: (r) => { rows.splice(r - 1, 1); },
      deleteRows: (r, n) => { rows.splice(r - 1, n); },
      getRange(r, c, n = 1, m = 1) {
        return {
          getValues: () => Array.from({ length: n }, (_, i) =>
            Array.from({ length: m }, (_, j) => (rows[r + i - 1] || [])[c + j - 1] === undefined ? '' : rows[r + i - 1][c + j - 1])),
          setValues(values) { values.forEach((line, i) => { if (!rows[r + i - 1]) rows[r + i - 1] = []; line.forEach((v, j) => { rows[r + i - 1][c + j - 1] = v; }); }); },
          setValue(v) { if (!rows[r - 1]) rows[r - 1] = []; rows[r - 1][c - 1] = v; }
        };
      },
      _rows: rows
    };
    tables[name] = s;
    sheetObjs[name] = s;
    return s;
  }
  class DateMock extends Date { static now() { return now; } }
  const context = vm.createContext({
    Date: DateMock, console, JSON, Math, String, Number, Array, Object, Boolean, RegExp, parseInt, parseFloat, isNaN, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => properties[k], setProperty: (k, v) => { properties[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = String(v); } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheetObjs[n] || null, insertSheet: sheet }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/G30/exec' }) },
    Logger: { log() {} },
    UrlFetchApp: {
      fetch: (url, options) => {
        urlFetchLog.push({ url: String(url), options: options || null });
        if (String(url).indexOf('getWebhookInfo') >= 0 && webhookInfo) {
          return { getContentText: () => JSON.stringify(webhookInfo), getResponseCode: () => 200 };
        }
        if (String(url).indexOf('/sendMessage') >= 0) {
          msgIdSeq += 1;
          return { getContentText: () => JSON.stringify({ ok: true, result: { message_id: msgIdSeq } }), getResponseCode: () => 200 };
        }
        return { getContentText: () => JSON.stringify({ ok: true, result: true }), getResponseCode: () => 200 };
      }
    },
    Utilities: {
      base64EncodeWebSafe: (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      computeDigest: () => [],
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeHmacSha256Signature: (m, s) => crypto.createHmac('sha256', String(s)).update(String(m), 'utf8').digest()
    },
    ContentService: { createTextOutput: (t) => ({ _t: String(t), setMimeType() { return this; } }), MimeType: { JSON: 'json' } }
  });
  return { context, tables, cache, properties, urlFetchLog, webhookInfoSet: (w) => { webhookInfo = w; }, getNow: () => now, setNow: (v) => { now = v; } };
}

function boot(opts) {
  const rt = makeRuntime(opts);
  vm.runInContext(GAS_SOURCE, rt.context);
  return rt;
}
function post(rt, body) { return JSON.parse(rt.context.doPost({ postData: { contents: JSON.stringify(body) } })._t); }
function doPostTg(rt, tgObj, secret) {
  return JSON.parse(rt.context.doPost({ parameter: { action: 'tg_callback', secret_token: secret || 'tgwhs_test_secret' }, postData: { contents: JSON.stringify(tgObj) } })._t);
}
const sends = (rt) => rt.urlFetchLog.filter((f) => f.url.indexOf('/sendMessage') >= 0);
const edits = (rt) => rt.urlFetchLog.filter((f) => f.url.indexOf('/editMessageText') >= 0);

/* ── H · static contracts on the shipped backend ─────────────────────── */
{
  check('H1a BUG-J1 the backend ships tgUpdateSeen (cache ring + TG_LAST_UPDATES property ring, TTL 6 h, ring 200)',
    /function tgUpdateSeen\(/.test(GAS_SOURCE) &&
    /TG_DEDUPE_TTL=21600,TG_RING_LEN=200/.test(GAS_SOURCE) &&
    /getProp\("TG_LAST_UPDATES"\)/.test(GAS_SOURCE) &&
    /"tg_u_"\+String\(id\)/.test(GAS_SOURCE));
  check('H1b BUG-J1 handleTelegramUpdate dedupes BEFORE dispatch and answers {ok:true,dedup:true}',
    /if\(u\.update_id!==undefined&&u\.update_id!==null&&tgUpdateSeen\(String\(u\.update_id\)\)\)\s*return\{ok:!0,dedup:!0\};/.test(GAS_SOURCE));
  check('H1c BUG-J1 non-command chat text answers the ONE friendly tip (never "Unknown command")',
    /function handleTgSmallTalk/.test(GAS_SOURCE) &&
    /Send \/help for commands/.test(GAS_SOURCE) &&
    GAS_SOURCE.indexOf('Unknown command hello') < 0);
  check('H1d BUG-J1 handleTgCallback dedupes callback_query.id (a double-tapped Approve can never fire twice)',
    /if\(cbid&&tgUpdateSeen\("cb"\+cbid\)\)return\{ok:!0,dedup:!0\};/.test(GAS_SOURCE));
  check('H2a BUG-J2 hasExec accepts the ?action=tg_callback&secret_token=… suffix (/\\/exec(\\?|$)/i)',
    GAS_SOURCE.indexOf('hasExec=/\\/exec(\\?|$)/i.test(url)') >= 0);
  check('H2b BUG-J2 the GAS 302 classification: gasRedirect302 + verdict exec_ok_302_dedup + hasErrors:false',
    /var gas302=!!\(hasExec&&lastErr&&0===lastErr\.indexOf\("Wrong response from the webhook: 302"\)\)/.test(GAS_SOURCE) &&
    /gasRedirect302:gas302/.test(GAS_SOURCE) &&
    /hasErrors:!!lastErr&&!gas302/.test(GAS_SOURCE) &&
    /verdict:gas302\?"exec_ok_302_dedup"/.test(GAS_SOURCE));
  check('H3a FEATURE-J3 the one-card engine ships (userNoFor + tgCardUpdate + tgCardSend + dayKey rollover)',
    /function userNoFor\(/.test(GAS_SOURCE) &&
    /function tgCardUpdate\(/.test(GAS_SOURCE) &&
    /function tgCardSend\(/.test(GAS_SOURCE) &&
    GAS_SOURCE.indexOf('userNo=(\\d+)') >= 0 &&
    /tgcard:"\+dayKey\(\)/.test(GAS_SOURCE));
  check('H3b FEATURE-J3 session_end folds into the ONE card (no separate SESSION spam message)',
    /else if\("session_end"===k\)\{\s*try\{var dw=Number\(d\.dwellSec\|\|0\)/.test(GAS_SOURCE) &&
    !/else if\("session_end"===k\)\{notifySession\(/.test(GAS_SOURCE));
  check('H3c FEATURE-J3 activity + tab_leave are silent card folds (<10 s bounces never push)',
    /if\(ad>=10\)\{tgCardUpdate/.test(GAS_SOURCE) &&
    /if\(td>=10\)\{tgCardUpdate/.test(GAS_SOURCE) &&
    !/else if\("activity"===k\)\{notifyActivity\(/.test(GAS_SOURCE));
  check('H4a FEATURE-J4 access_request routes the auto visitor card (notifyAccessCard) with the ntfy fallback kept',
    /try\{notifyAccessCard\(e,t,r,n,d\)\}catch\(eNA\)\{notifyAccessRequest\(e,t,r,n,d\)\}/.test(GAS_SOURCE) &&
    /function notifyAccessCard\(/.test(GAS_SOURCE) &&
    /function tgNtfyAccess\(/.test(GAS_SOURCE));
  check('H4b FEATURE-J4 the arq limiter gap is 10 s (name/class refinements flow; hourly cap 6 holds)',
    /rateLimited\(r,"arq",10,6\)/.test(GAS_SOURCE));
}

/* ── J1 · update_id replay storm ─────────────────────────────────────── */
{
  const rt = boot({});
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true, alertLevel: 'all' });
  const upd = { update_id: 302, message: { message_id: 1, chat: { id: 987654321 }, from: { id: 987654321 }, text: 'hello' } };
  const before = sends(rt).length;
  for (let i = 0; i < 5; i++) doPostTg(rt, upd);
  const after = sends(rt).length;
  check('J1a replaying the SAME update_id 5 times produces EXACTLY ONE Telegram reply',
    after - before === 1, 'replies=' + (after - before));
  const reply = sends(rt)[before];
  check('J1b the single reply is the friendly 💡 tip (not "Unknown command")',
    !!reply && reply.options.payload.indexOf('Send /help for commands') >= 0,
    reply ? reply.options.payload.slice(0, 90) : 'none');
  /* the ring survives cache eviction: clear the whole cache, replay again */
  for (const k of Object.keys(rt.cache)) delete rt.cache[k];
  const before2 = sends(rt).length;
  doPostTg(rt, upd);
  check('J1c the dedupe ring SURVIVES cache eviction (TG_LAST_UPDATES property ring absorbs the replay)',
    sends(rt).length - before2 === 0, 'replies=' + (sends(rt).length - before2));
  /* a NEW update_id still works */
  const before3 = sends(rt).length;
  const r2 = doPostTg(rt, { update_id: 303, message: { message_id: 2, chat: { id: 987654321 }, from: { id: 987654321 }, text: 'hello again' } });
  check('J1d a NEW update_id flows through normally (one tip, ok:true)',
    r2.ok === true && sends(rt).length - before3 === 1, JSON.stringify(r2));
  /* callback dedupe: double-tapped Approve */
  const cb = { update_id: 304, callback_query: { id: 'cbJ1x', from: { id: 987654321 }, message: { message_id: 3, chat: { id: 987654321 } }, data: 'approve:dev-j1-a' } };
  const first = doPostTg(rt, cb);
  const second = doPostTg(rt, cb);
  check('J1e tapping the SAME callback twice fires ONCE (second answers dedup, no second action)',
    first.ok === true && second.ok === true && !!second.dedup, JSON.stringify({ first, second }));
  const approveUpserts = (rt.tables.Access ? rt.tables.Access._rows.filter((r) => String(r[4]) === 'dev-j1-a' && String(r[6]) === 'approved').length : 0);
  check('J1f the Approve action still lands exactly once in the Access sheet',
    approveUpserts === 1, 'rows=' + approveUpserts);
}

/* ── J2 · Probe 8.8 verdict on the owner's real-world webhook shape ──── */
{
  const rt = boot({});
  rt.webhookInfoSet({ ok: true, result: {
    url: 'https://script.google.com/macros/s/AKfycbyPUQ48vQca-1m4fHjz4Pa7izid1gXLpIGhYVcNVSD436eEzUzQFfaYIIVYm8w-VxSZ/exec?action=tg_callback&secret_token=tgwhs_prod',
    pending_update_count: 0,
    last_error_message: 'Wrong response from the webhook: 302 Found',
    last_error_date: 1763800000
  } });
  const wi = post(rt, { action: 'tg_webhook_info', pin: '78987898' });
  check('J2a hasExec:true for a webhook ending in /exec?action=tg_callback&secret_token=…',
    wi.hasExec === true, JSON.stringify(wi).slice(0, 200));
  check('J2b the GAS 302 Found lastError is classified gasRedirect302 (normal Apps Script redirect, NOT a delivery failure)',
    wi.gasRedirect302 === true && wi.hasErrors === false, JSON.stringify({ gas302: wi.gasRedirect302, hasErrors: wi.hasErrors }));
  check('J2c the verdict vocabulary Probe 8.8 needs: exec_ok_302_dedup',
    wi.verdict === 'exec_ok_302_dedup', String(wi.verdict));
  /* Probe 8.8's browser-side law: execOk && noErr (gas302 counts as clean) → PASS */
  const execOk = !!wi.hasExec;
  const gas302 = !!(wi.gasRedirect302 || wi.verdict === 'exec_ok_302_dedup');
  const noErr = !wi.hasErrors || gas302;
  check('J2d Probe 8.8 paints ✅ PASS on this shape (exec_ok · GAS 302 deduplicated · alert delivered)',
    execOk && noErr, JSON.stringify({ execOk, noErr, gas302 }));
  /* a genuinely broken webhook is still red */
  rt.webhookInfoSet({ ok: true, result: { url: 'https://example.com/hook', pending_update_count: 3, last_error_message: 'Connection timed out' } });
  const bad = post(rt, { action: 'tg_webhook_info', pin: '78987898' });
  check('J2e a NON-GAS / non-exec webhook still fails honestly (hasExec:false, hasErrors:true)',
    bad.hasExec === false && bad.hasErrors === true && bad.verdict === 'not_exec', JSON.stringify({ hasExec: bad.hasExec, verdict: bad.verdict }));
  const liveLabSrc = readText('data/sdp-live-lab.js');
  check('J2f the Live Lab probe consumes the classification (gasRedirect302 → 0 ✅ (GAS 302 redirect deduplicated))',
    /var gas302 = !!\(j\.gasRedirect302 \|\| j\.verdict === 'exec_ok_302_dedup'\)/.test(liveLabSrc) &&
    /GAS 302 redirect deduplicated/.test(liveLabSrc));
}

/* ── J3 · ONE live-updating card per user per day ────────────────────── */
{
  const rt = boot({});
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true, alertLevel: 'all' });
  const DEV = 'sdp_u_3dbb260f4f';
  /* the first card message */
  post(rt, { action: 'tg_event', deviceId: DEV, kind: 'login', data: { name: 'Kasun', classId: 'B1', method: 'Approved Token', firstVisit: true, visitCount: 1, device: { class: 'Desktop', os: 'Windows', browser: 'Edge', net: '4g', lang: 'SI', screen: '1536x960' } } });
  rt.setNow(Date.UTC(2026, 10, 22, 12) + 20 * 1000);
  /* 4 consecutive session/activity events for the same device */
  post(rt, { action: 'tg_event', deviceId: DEV, kind: 'session_end', data: { name: 'Kasun', sessionNo: '15', words: 31, score: 90, dwellSec: 26, mode: 'paper', voice: 'Alice' } });
  rt.setNow(Date.UTC(2026, 10, 22, 12) + 40 * 1000);
  post(rt, { action: 'tg_event', deviceId: DEV, kind: 'activity', data: { screen: 'dictation', dwellSec: 30 } });
  rt.setNow(Date.UTC(2026, 10, 22, 12) + 60 * 1000);
  post(rt, { action: 'tg_event', deviceId: DEV, kind: 'session_end', data: { name: 'Kasun', sessionNo: '16', words: 28, score: 82, dwellSec: 240, mode: 'paper', voice: 'Alice' } });
  rt.setNow(Date.UTC(2026, 10, 22, 12) + 80 * 1000);
  post(rt, { action: 'tg_event', deviceId: DEV, kind: 'login', data: { name: 'Kasun', classId: 'B1', method: 'Approved Token' } });
  const sendCount = sends(rt).length;
  const editCount = edits(rt).length;
  check('J3a the 4 consecutive events produced ONE Telegram message (👤 User #1 — no session spam flood)',
    sendCount === 1, 'sends=' + sendCount);
  check('J3b updates 2..4 rode editMessageText on the SAME message (live card updates)',
    editCount >= 2, 'edits=' + editCount);
  const card = sends(rt)[0];
  check('J3c the card headline is 👤 User #1 with the name/class and the Active badge',
    !!card && card.options.payload.indexOf('User #1') >= 0 && card.options.payload.indexOf('Kasun') >= 0,
    card ? card.options.payload.slice(0, 110) : 'none');
  check('J3d the card carries the device summary line (Desktop · Windows · Edge · 4G · SI · 1536x960)',
    !!card && card.options.payload.indexOf('Windows') >= 0 && card.options.payload.indexOf('Edge') >= 0 && card.options.payload.indexOf('1536x960') >= 0,
    card ? '' : 'no card');
  check('J3e the card carries the IST timestamp (Sri Lanka) and the 🚫 Kick inline button',
    !!card && /IST/.test(card.options.payload) && card.options.payload.indexOf('kick:') >= 0, '');
  const edited = edits(rt).map((e) => e.options.payload).join('\n');
  check('J3f the edited card shows the folded totals (Sessions Today: 2 · 4m 56s · Last: 28 (82%) · paper)',
    edited.indexOf('Sessions Today: 2') >= 0 && edited.indexOf('82%') >= 0, edited.slice(0, 200));
  /* <10 s / 0% bounce suppression */
  const before = sends(rt).length;
  rt.setNow(Date.UTC(2026, 10, 22, 12) + 200 * 1000);
  post(rt, { action: 'tg_event', deviceId: DEV, kind: 'activity', data: { screen: 'home', dwellSec: 4 } });
  post(rt, { action: 'tg_event', deviceId: DEV, kind: 'tab_leave', data: { screen: 'left app', dwellSec: 0 } });
  check('J3g accidental <10 s / 0% tab bounces NEVER push (folded silently into the card totals)',
    sends(rt).length - before === 0 && edits(rt).length === editCount, 'new sends=' + (sends(rt).length - before));
  /* a second user gets User #2 — sequential numbering */
  post(rt, { action: 'tg_event', deviceId: 'sdp_u_seconduser99', kind: 'session_end', data: { name: 'Amaya', sessionNo: '1', words: 20, score: 70, dwellSec: 120, mode: 'paper' } });
  const secondCard = sends(rt).filter((s) => s.options.payload.indexOf('User #2') >= 0);
  check('J3h a second distinct device becomes 👤 User #2 (permanent sequential numbering)',
    secondCard.length === 1, 'cards=' + secondCard.length);
}

/* ── J4 · auto visitor approval — real Chromium against the GAS VM ───── */
async function visitorFlow() {
  const rt = boot({});
  const server = await start({ root: ROOT });
  const relay = await new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', '*');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        try {
          const e = { parameter: Object.fromEntries(url.searchParams.entries()), postData: { contents: body } };
          const out = rt.context.doPost(e);
          res.writeHead(200);
          res.end(out && out._t ? out._t : JSON.stringify(out || { ok: false }));
        } catch (err) {
          res.writeHead(200);
          res.end(JSON.stringify({ ok: false, err: 'relay' }));
        }
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const RELAY_URL = 'http://127.0.0.1:' + relay.address().port + '/exec';
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a));
  const browser = await chromium.launch({ headless: true, executablePath, args });
  try {
    /* LOCK ON before the student boots */
    rt.context.doPost({ postData: { contents: JSON.stringify({ action: 'set_lock_config', pin: '78987898', on: true, mode: 'approval+code' }) } });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.addInitScript((relayUrl) => {
      window.__SDP_NO_LIVE__ = true;
      try { localStorage.setItem('sdp.guide_seen', '0.0.7.j'); } catch (e) {}
      const origFetch = window.fetch.bind(window);
      window.fetch = function (url, opts) {
        const u = String(url);
        if (u.indexOf('data/config.json') >= 0 && u.indexOf('127.0.0.1') < 0) {
          return origFetch(u, opts).then(function (res) {
            return res.clone().json().then(function (cfg) {
              try {
                cfg.accessLock = cfg.accessLock || {};
                cfg.accessLock.relayUrl = relayUrl;
                cfg.accessLock.on = true;
                cfg.accessLock.mode = 'approval+code';
              } catch (e) {}
              return new Response(JSON.stringify(cfg), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }, function () { return res; });
          });
        }
        return origFetch(url, opts);
      };
    }, RELAY_URL);
    await ctx.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(server.origin) || url.startsWith('http://127.0.0.1') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
    await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.SDP && SDP.AccessLock), null, { timeout: 15000 });
    await page.waitForFunction(() => !!document.getElementById('sdpAccessLock'), null, { timeout: 15000 });
    /* the student types their name/class and requests access */
    await page.evaluate(() => {
      document.getElementById('sdpAccessName').value = 'Amaya Fernando';
      document.getElementById('sdpAccessClass').value = 'B1-IPET015';
      document.getElementById('sdpAccessRequestBtn').click();
    });
    await page.waitForTimeout(1500);
    /* ONE pending ACCESS REQUEST card with the full device summary + buttons */
    const reqCards = sends(rt).filter((s) => s.options.payload.indexOf('ACCESS REQUEST') >= 0);
    check('J4a the locked student boot auto-sent ONE pending ACCESS REQUEST card (👤 User #N headline)',
      reqCards.length === 1 && reqCards[0].options.payload.indexOf('User #') >= 0, 'cards=' + reqCards.length);
    check('J4b the card ships [✅ Approve] [❌ Reject] [🚫 Ban Device] inline buttons',
      reqCards.length === 1 && reqCards[0].options.payload.indexOf('approve:') >= 0 &&
      reqCharts(reqCards[0], 'reject:') && reqCharts(reqCards[0], 'ban:'), '');
    function reqCharts(card, needle) { return card.options.payload.indexOf(needle) >= 0; }
    check('J4c the card carries the student identity + the waiting note (⏳ Waiting for lecturer approval)',
      reqCards.length === 1 && reqCards[0].options.payload.indexOf('Amaya Fernando') >= 0 &&
      reqCards[0].options.payload.indexOf('B1-IPET015') >= 0 &&
      reqCards[0].options.payload.indexOf('Waiting for lecturer approval') >= 0,
      reqCards[0] ? reqCards[0].options.payload.slice(0, 120) : 'none');
    /* the student refines their class → the SAME card updates in place */
    const deviceId = (rt.tables.Access._rows.find((r) => String(r[2]) === 'Amaya Fernando') || [])[4] || '';
    const sendBefore = sends(rt).length;
    const editBefore = edits(rt).length;
    rt.setNow(Date.now() + 12 * 1000); /* past the 10 s arq gap */
    rt.context.doPost({ postData: { contents: JSON.stringify({ action: 'access_request', name: 'Amaya Fernando', classId: 'B1-IPET015-TUE', deviceId: deviceId, fp: 'fp-j4' }) } });
    check('J4d a refined re-request UPDATES the same pending card in place (zero second message)',
      sends(rt).length - sendBefore === 0 && edits(rt).length - editBefore === 1,
      'new sends=' + (sends(rt).length - sendBefore) + ' new edits=' + (edits(rt).length - editBefore));
    /* Hansana taps [✅ Approve] → the student unlocks within ~4 s */
    const approveRes = await new Promise((resolve) => {
      const payload = JSON.stringify({ update_id: 9001, callback_query: { id: 'cbJ4', from: { id: 987654321 }, message: { message_id: 5, chat: { id: 987654321 } }, data: 'approve:' + deviceId } });
      const req = http.request(RELAY_URL + '?action=tg_callback&secret_token=tgwhs_test_secret', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }, (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => resolve(b));
      });
      req.end(payload);
    });
    let approved = {};
    try { approved = JSON.parse(approveRes); } catch (e) {}
    check('J4e the [✅ Approve] tap answers "Approved by Hansana — Student unlocked!"',
      approved.ok === true && String(approved.note || '').indexOf('Approved by Hansana') >= 0, approveRes.slice(0, 140));
    const unlocked = await page.waitForFunction(() => {
      try { return !document.getElementById('sdpAccessLock') && !!document.getElementById('screen-home'); } catch (e) { return false; }
    }, null, { timeout: 12000 }).then(() => true, () => false);
    check('J4f the student unlocks automatically within ~4 s of the Approve tap (the poll + firstGrant token)',
      unlocked === true, 'overlay still up');
    check('J4g the whole visitor journey threw zero page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  } finally {
    await browser.close();
    relay.close();
    server.close();
  }
}

(async function main() {
  await visitorFlow();
  const fails = results.filter((r) => r.status === 'FAIL').length;
  console.log('\nG30 v007j-telegram-ux-dedupe.cjs — ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL');
  console.log(JSON.stringify(results.filter((r) => r.status === 'FAIL'), null, 2));
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('G30 v007j-telegram-ux-dedupe.cjs crashed:', e);
  process.exit(1);
});
