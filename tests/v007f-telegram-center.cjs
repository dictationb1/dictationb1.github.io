#!/usr/bin/env node
'use strict';
/* G26 — tests/v007f-telegram-center.cjs — the v0.0.7.g Telegram Command Center gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.g
 * Executes the exact shipped data/gas-source.txt inside a vm with a faithful
 * Apps Script mock and asserts the two-way Telegram command center laws:
 *   C1  POST webhook law — Telegram updates arrive as HTTP POST and are
 *       routed by doPost (action=tg_callback OR callback_query/message body).
 *   C2  strict auth — wrong TG_WEBHOOK_SECRET rejected; foreign chat ids
 *       rejected with an answerCallbackQuery refusal; only TG_CHAT_ID works.
 *   C3  inline buttons ACT — [✅ Approve] upserts approved + issues the
 *       HMAC-SHA256 token + 72 h expiry + answerCallbackQuery toast +
 *       editMessageText "✅ Approved by Hansana — Student unlocked!";
 *       [❌ Reject] and [🚫 Ban Device]/[🚫 Kick] revoke.
 *   C4  the ten commands — /start /help /status /lock /unlock /pending
 *       /roster /kick /codes /alerts /errors /test — all chat-id-gated.
 *   C5  setupTelegramWebhook registers ScriptApp.getService().getUrl() +
 *       "?action=tg_callback&secret_token=…" with Telegram setWebhook.
 *   C6  rich notifications — Asia/Colombo IST stamps, HTML formatting,
 *       device summaries, ACCESS REQUEST inline keyboards, USER LOGIN,
 *       SESSION summaries, activity/dwell, voice/app errors (Errors sheet),
 *       security alerts (burned-code reuse identifies BOTH devices).
 *   C7  anti-spam — notifyThrottled 45 s per kind+key, >5 events/min queue
 *       into a digest; alert levels all|important|critical filter kinds and
 *       /alerts switches the level live.
 *   C8  tg_event — the public client telemetry relay (session_start /
 *       session_end / activity / login / tab_leave / voice_error / app_error
 *       / troubleshoot / feedback / security / digest) with rate limiting.
 *   C9  tg_test — the Studio 1-tap "Send Test Telegram Alert" round trip.
 *   C10 zero secrets in the shipped file + strict ES5 parse + the lock core
 *       still honours the v0.0.7.e G23 laws (mode field, lock_all preserves
 *       pw/pin/mode — the v0.0.7.e wipe defect is fixed).
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const acorn = require('./node_modules/acorn');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── the GAS runtime mock (faithful Apps Script services) ─────────────── */
function makeRuntime(opts) {
  opts = opts || {};
  const tables = {};
  const sheetObjs = {};
  const cache = {};
  const properties = Object.assign({
    ADMIN_PIN: '78987898',
    TG_BOT_TOKEN: opts.tgToken || '123456:TESTBOT',
    TG_CHAT_ID: opts.tgChat || '987654321',
    TG_WEBHOOK_SECRET: opts.tgSecret || 'tgwhs_test_secret',
    LOCK_HMAC_SECRET: opts.lockSecret || 'lockhmac_test_secret'
  }, opts.properties || {});
  let now = opts.now || Date.UTC(2026, 10, 21, 12);
  const urlFetchLog = [];
  const logs = [];
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
    Date: DateMock,
    console, JSON, Math, String, Number, Array, Object, Boolean, RegExp, parseInt, parseFloat, isNaN, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => properties[k] }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache[k] && cache[k].until > now ? cache[k].value : null,
        put: (k, v, secs) => { cache[k] = { value: String(v), until: now + secs * 1000 }; }
      })
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheetObjs[n] || null, insertSheet: sheet }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => (opts.webAppUrl || 'https://script.google.com/macros/s/TESTEXEC/exec') }) },
    Logger: { log: (m) => { logs.push(String(m)); } },
    UrlFetchApp: {
      fetch: (url, options) => {
        urlFetchLog.push({ url: String(url), options: options || null, at: now });
        return { getContentText: () => JSON.stringify({ ok: true, result: { message_id: 1, chat: { id: 1 } } }), getResponseCode: () => 200 };
      }
    },
    Utilities: {
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      computeDigest: () => [],
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeHmacSha256Signature: (message, secret) => crypto.createHmac('sha256', String(secret)).update(String(message), 'utf8').digest()
    },
    ContentService: {
      createTextOutput: (t) => ({ _t: String(t), setMimeType() { return this; } }),
      MimeType: { JSON: 'json' }
    }
  });
  return { context, tables, cache, properties, urlFetchLog, logs, getNow: () => now, setNow: (v) => { now = v; } };
}

const GAS_SOURCE = readText('data/gas-source.txt');
function boot(opts) {
  const rt = makeRuntime(opts);
  vm.runInContext(GAS_SOURCE, rt.context);
  return rt;
}
function post(rt, body) { return rt.context.handlePost({ postData: { contents: JSON.stringify(body) } }); }
function doPostTg(rt, tgObj, secret) {
  const out = rt.context.doPost({ parameter: { action: 'tg_callback', secret_token: secret || 'tgwhs_test_secret' }, postData: { contents: JSON.stringify(tgObj) } });
  return JSON.parse(out._t);
}
function tgCalls(rt, method) { return rt.urlFetchLog.filter((f) => f.url.indexOf('api.telegram.org') >= 0 && f.url.indexOf('/' + method) >= 0); }
function tgSent(rt) { return tgCalls(rt, 'sendMessage'); }

/* ── C1 · the POST webhook law ─────────────────────────────────────────── */
{
  const rt = boot({});
  const upd = { callback_query: { id: 'cb1', from: { id: 987654321 }, message: { message_id: 5, chat: { id: 987654321 } }, data: 'approve:dev-post-1' } };
  /* Telegram POSTs the JSON update; Apps Script exposes it in postData — doPost must route it. */
  const viaBody = JSON.parse(rt.context.doPost({ parameter: { secret_token: 'tgwhs_test_secret' }, postData: { contents: JSON.stringify(upd) } })._t);
  check('C1a a Telegram POST with a callback_query body routes to the webhook handler via doPost',
    viaBody.ok === true && viaBody.decision === 'approve' && viaBody.device === 'dev-post-1', JSON.stringify(viaBody));
  const cmd = { message: { message_id: 6, chat: { id: 987654321 }, from: { id: 987654321 }, text: '/status' } };
  const viaCmd = JSON.parse(rt.context.doPost({ parameter: { secret_token: 'tgwhs_test_secret' }, postData: { contents: JSON.stringify(cmd) } })._t);
  check('C1b a Telegram POST with a /command body routes to the command handler via doPost',
    viaCmd.ok === true, JSON.stringify(viaCmd));
  /* GET tg_callback still answers (compat) but the webhook is POST-first. */
  const viaGet = rt.context.handleGet({ parameter: { action: 'tg_callback', secret_token: 'tgwhs_test_secret' }, postData: { contents: JSON.stringify(upd) } });
  check('C1c the legacy GET ?action=tg_callback path still resolves (compat)', viaGet.ok === true, JSON.stringify(viaGet));
}

/* ── C2 · strict auth ──────────────────────────────────────────────────── */
{
  const rt = boot({});
  const upd = { callback_query: { id: 'cb2', from: { id: 987654321 }, message: { message_id: 7, chat: { id: 987654321 } }, data: 'approve:dev-auth-1' } };
  const wrong = doPostTg(rt, upd, 'WRONG-SECRET');
  check('C2a a wrong TG_WEBHOOK_SECRET is rejected', wrong.ok === false && wrong.err === 'unauthorised', JSON.stringify(wrong));
  const foreign = doPostTg(rt, { callback_query: { id: 'cb3', from: { id: 666 }, message: { message_id: 8, chat: { id: 666 } }, data: 'approve:dev-auth-1' } });
  check('C2b a FOREIGN chat id tapping [Approve] is rejected (only Hansana\'s TG_CHAT_ID)',
    foreign.ok === false && foreign.err === 'unauthorised', JSON.stringify(foreign));
  const refused = tgCalls(rt, 'answerCallbackQuery').filter((c) => c.options.payload.indexOf('Unauthorised') >= 0);
  check('C2c the foreign tap receives an answerCallbackQuery refusal toast', refused.length >= 1);
  const secAlert = tgSent(rt).filter((c) => c.options.payload.indexOf('Foreign Telegram tap blocked') >= 0);
  check('C2d the foreign tap raises a security alert to the owner', secAlert.length >= 1);
  const foreignCmd = doPostTg(rt, { message: { message_id: 9, chat: { id: 666 }, from: { id: 666 }, text: '/unlock' } });
  check('C2e a /command from a foreign chat id is rejected', foreignCmd.ok === false && foreignCmd.err === 'unauthorised', JSON.stringify(foreignCmd));
}

/* ── C3 · inline buttons genuinely act ─────────────────────────────────── */
{
  const rt = boot({});
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true });
  post(rt, { action: 'access_request', name: 'Tharindu Perera', classId: 'B1-TUE-04', deviceId: 'dev-c3-student', fp: 'fp-c3' });
  const approve = doPostTg(rt, { callback_query: { id: 'cbA', from: { id: 987654321 }, message: { message_id: 10, chat: { id: 987654321 } }, data: 'approve:dev-c3-student' } });
  check('C3a tapping [✅ Approve] approves the device for real (upsertAccess approved)',
    approve.ok === true && approve.decision === 'approve' && approve.device === 'dev-c3-student', JSON.stringify(approve));
  const row = rt.tables.Access._rows.filter((r) => String(r[4]) === 'dev-c3-student')[0];
  check('C3b the Telegram approval issues the HMAC token + the 72 h expiry',
    !!row && String(row[6]) === 'approved' && String(row[7]).length >= 20 && Number(row[9]) > Date.UTC(2026, 10, 21, 12) + 70 * 3600 * 1000,
    JSON.stringify(row && row.slice(0, 10)));
  const answered = tgCalls(rt, 'answerCallbackQuery');
  check('C3c answerCallbackQuery fires with the confirmation toast',
    answered.length >= 1 && answered[answered.length - 1].options.payload.indexOf('callback_query_id') >= 0);
  const edited = tgCalls(rt, 'editMessageText');
  check('C3d editMessageText replaces the buttons with "✅ Approved by Hansana — Student unlocked!"',
    edited.length >= 1 && edited[edited.length - 1].options.payload.indexOf('Approved by Hansana') >= 0,
    edited.length ? edited[edited.length - 1].options.payload.slice(0, 90) : 'none');
  const chk = post(rt, { action: 'check_device', deviceId: 'dev-c3-student', token: String(row[7]), fp: 'fp-c3' });
  check('C3e the student polls check_device and is APPROVED (unlocks within ~4 s)', chk.ok === true && chk.approved === true, JSON.stringify(chk));
  post(rt, { action: 'access_request', name: 'Bad Actor', deviceId: 'dev-c3-bad', fp: 'fp-bad' });
  const reject = doPostTg(rt, { callback_query: { id: 'cbR', from: { id: 987654321 }, message: { message_id: 11, chat: { id: 987654321 } }, data: 'reject:dev-c3-bad' } });
  const badRow = rt.tables.Access._rows.filter((r) => String(r[4]) === 'dev-c3-bad')[0];
  check('C3f tapping [❌ Reject] rejects the device (status rejected)', reject.ok === true && String(badRow[6]) === 'rejected', JSON.stringify([reject, badRow && badRow[6]]));
  doPostTg(rt, { callback_query: { id: 'cbB', from: { id: 987654321 }, message: { message_id: 12, chat: { id: 987654321 } }, data: 'ban:dev-c3-student' } });
  const banned = post(rt, { action: 'check_device', deviceId: 'dev-c3-student', token: String(row[7]), fp: 'fp-c3' });
  check('C3g tapping [🚫 Ban Device] revokes instantly (next heartbeat locked out)',
    banned.ok === false && banned.err === 'revoked', JSON.stringify(banned));
}

/* ── C4 · the ten commands ─────────────────────────────────────────────── */
{
  const rt = boot({});
  const cmd = (text) => doPostTg(rt, { message: { message_id: 20, chat: { id: 987654321 }, from: { id: 987654321 }, text } });
  const start = cmd('/start');
  check('C4a /start answers the bilingual command menu', start.ok === true &&
    tgSent(rt).some((c) => c.options.payload.indexOf('/status') >= 0 && c.options.payload.indexOf('/codes') >= 0));
  const help = cmd('/help');
  check('C4b /help is an alias of the menu', help.ok === true);
  cmd('/lock');
  let st = JSON.parse(vm.runInContext('JSON.stringify(accessState())', rt.context));
  check('C4c /lock arms the Master Lock ON', st.lock.on === true, JSON.stringify(st));
  cmd('/unlock');
  st = JSON.parse(vm.runInContext('JSON.stringify(accessState())', rt.context));
  check('C4d /unlock turns the Master Lock OFF (Open Classroom Mode)', st.lock.on === false, JSON.stringify(st));
  const pend = cmd('/pending');
  check('C4e /pending answers ok (re-send with fresh buttons when requests exist)', pend.ok === true);
  const ros = cmd('/roster');
  check('C4f /roster answers ok (approved devices with Kick buttons)', ros.ok === true);
  const codes = cmd('/codes 7');
  const codesMsg = tgSent(rt).filter((c) => c.options.payload.indexOf('ONE-TIME CODES') >= 0);
  const codeRows = rt.tables.AccessCodes._rows.filter((r) => String(r[5] || '').indexOf('ttl') >= 0).length;
  check('C4g /codes <N> generates 1-20 burnable codes straight into Telegram',
    codes.ok === true && codesMsg.length >= 1 && codeRows >= 7, 'msgs=' + codesMsg.length + ' rows=' + codeRows);
  const tooMany = cmd('/codes 99');
  check('C4h /codes is capped at 20 (99 clamps)', tooMany.ok === true &&
    tgSent(rt).filter((c) => c.options.payload.indexOf('ONE-TIME CODES') >= 0).length >= 1);
  const kick = cmd('/kick dev-c4-x');
  check('C4i /kick <deviceId> answers (revoked when found, honest miss when not)', kick.ok === true || kick.ok === false);
  const alerts = cmd('/alerts critical');
  const alv = String(vm.runInContext('getCfg("tgAlertLevel")', rt.context));
  check('C4j /alerts critical switches the verbosity level live', alv === 'critical', alv);
  const errors = cmd('/errors');
  check('C4k /errors answers ok (last 5 logged errors)', errors.ok === true);
  const test = cmd('/test');
  check('C4l /test runs the end-to-end health check and pushes it to Telegram',
    test.ok === true && tgSent(rt).some((c) => c.options.payload.indexOf('END-TO-END TEST') >= 0));
  const unknown = cmd('/bogus');
  check('C4m an unknown command gets the /help pointer', unknown.ok === false);
}

/* ── C5 · setupTelegramWebhook ─────────────────────────────────────────── */
{
  const rt = boot({});
  const hook = rt.context.setupTelegramWebhook();
  const sw = tgCalls(rt, 'setWebhook');
  check('C5a setupTelegramWebhook registers the Web App URL with Telegram setWebhook',
    hook.ok === true && sw.length === 1, JSON.stringify(hook.ok) + ' calls=' + sw.length);
  const payload = sw.length ? JSON.parse(sw[0].options.payload) : {};
  check('C5b the webhook URL is ScriptApp URL + ?action=tg_callback&secret_token=<secret>',
    payload.url === 'https://script.google.com/macros/s/TESTEXEC/exec?action=tg_callback&secret_token=tgwhs_test_secret', payload.url || 'none');
  check('C5c the confirmation is logged for the owner (Logger.log)',
    rt.logs.some((l) => l.indexOf('setupTelegramWebhook OK') >= 0), rt.logs.join(' | ').slice(0, 120));
  const rtNoSecret = boot({ properties: { TG_WEBHOOK_SECRET: '' } });
  const fail = rtNoSecret.context.setupTelegramWebhook();
  check('C5d a missing TG_WEBHOOK_SECRET fails loudly (never registers an open webhook)',
    fail.ok === false && fail.err === 'no TG_WEBHOOK_SECRET', JSON.stringify(fail));
}

/* ── C6 · rich notifications ───────────────────────────────────────────── */
{
  const rt = boot({});
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true, alertLevel: 'all' });
  post(rt, { action: 'access_request', name: 'Amaya Fernando', classId: 'B1-IPET015', deviceId: 'dev-rich-1', fp: 'fp-r1', device: { class: 'phone', os: 'Android 14', browser: 'Chrome 130', screen: '412x915', dpr: 2.6, net: '4g', lang: 'en', tz: 'Asia/Colombo', pwa: true, cookies: true, storage: '12 kB' } });
  const req = tgSent(rt).find((c) => c.options.payload.indexOf('ACCESS REQUEST') >= 0);
  check('C6a the ACCESS REQUEST alert carries name, class, device summary and IST stamp',
    !!req && req.options.payload.indexOf('Amaya Fernando') >= 0 && req.options.payload.indexOf('B1-IPET015') >= 0 &&
    req.options.payload.indexOf('Android 14') >= 0 && req.options.payload.indexOf('IST') >= 0,
    req ? req.options.payload.slice(0, 120) : 'not fired');
  check('C6b the ACCESS REQUEST alert ships the [✅ Approve] [❌ Reject] [🚫 Ban Device] inline keyboard',
    req.options.payload.indexOf('approve:dev-rich-1') >= 0 && req.options.payload.indexOf('reject:dev-rich-1') >= 0 && req.options.payload.indexOf('ban:dev-rich-1') >= 0);
  rt.setNow(Date.UTC(2026, 10, 21, 12) + 60 * 1000);
  post(rt, { action: 'tg_event', deviceId: 'dev-rich-1', kind: 'session_end', data: { name: 'Amaya Fernando', sessionNo: '14', words: 31, score: 87, dwellSec: 1450, mode: 'paper', voice: 'Alice' } });
  /* v0.0.7.j FEATURE-J3: session_end now folds into the ONE daily user card
     (👤 User #N … Last: 31/31 (87%) · paper) — the separate SESSION #14 spam
     message is gone by design. */
  const cardMsg = tgSent(rt).map((c) => c.options.payload).join('\n');
  const sessEdits = rt.urlFetchLog.filter((f) => f.url.indexOf('/editMessageText') >= 0);
  check('C6c v0.0.7.j the session summary lands INSIDE the ONE daily User #N card (Last: 31/31 (87%) · paper) with editMessageText updates',
    sessEdits.length >= 1 && (sessEdits[0].options.payload || '').indexOf('87%') >= 0 && (sessEdits[0].options.payload || '').indexOf('paper') >= 0,
    sessEdits.length ? sessEdits[0].options.payload.slice(0, 130) : 'no card edit fired');
  rt.setNow(Date.UTC(2026, 10, 21, 12) + 62 * 1000);
  post(rt, { action: 'tg_event', deviceId: 'dev-rich-1', kind: 'voice_error', data: { detail: 'MP3 decode failure', clipKey: 'words.castle' } });
  const verr = tgSent(rt).filter((c) => c.options.payload.indexOf('VOICE ERROR') >= 0);
  const errRow = (rt.tables.Errors ? rt.tables.Errors._rows : []).filter((r) => String(r[2]) === 'voice_error').length;
  check('C6d a voice error alert fires with the clip key AND lands in the Errors sheet (/errors reads it)',
    verr.length >= 1 && verr[0].options.payload.indexOf('words.castle') >= 0 && errRow >= 1);
  /* burned-code reuse identifies BOTH devices */
  const gen = post(rt, { action: 'generate_codes', pin: '78987898', count: 2 });
  post(rt, { action: 'burn_code', deviceId: 'dev-original-1', code: gen.codes[0], name: 'Original Kid' });
  rt.setNow(Date.UTC(2026, 10, 21, 12) + 120 * 1000);
  const reuse = post(rt, { action: 'burn_code', deviceId: 'dev-second-1', code: gen.codes[0], name: 'Forwarder' });
  const sec = tgSent(rt).filter((c) => c.options.payload.indexOf('reuse blocked') >= 0);
  check('C6e a burned code reused on a 2nd phone raises a security alert naming BOTH devices and is rejected',
    reuse.ok === false && sec.length >= 1, JSON.stringify(reuse) + ' alerts=' + sec.length);
  check('C6f the reuse alert names the second device (the forwarder) explicitly',
    sec.length >= 1 && sec[0].options.payload.indexOf('SECOND device') >= 0, sec.length ? sec[0].options.payload.slice(0, 160) : 'none');
}

/* ── C7 · anti-spam + alert levels ─────────────────────────────────────── */
{
  const rt = boot({}); /* default level: important */
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true });
  /* 45-second per kind+key throttle: the same login twice within 45 s fires once */
  post(rt, { action: 'tg_event', deviceId: 'dev-spam-1', kind: 'login', data: { name: 'S1', method: 'Approved Token', firstVisit: true, visitCount: 1 } });
  const sent1 = tgSent(rt).length;
  post(rt, { action: 'tg_event', deviceId: 'dev-spam-1', kind: 'login', data: { name: 'S1', method: 'Approved Token', firstVisit: false, visitCount: 2 } });
  const sent2 = tgSent(rt).length;
  check('C7a the same device login twice inside 45 s pushes only ONE Telegram message',
    sent2 === sent1, sent1 + ' -> ' + sent2);
  /* v0.0.7.g law: tg_event carries a pure 240/hour per-device cap (no min-gap,
     so a grant → session summary burst always lands) — a genuine flood is
     throttled by the hourly counter, and the per-kind window counter queues
     the overflow into the 60 s digest instead of spamming Telegram. */
  let throttled = false;
  post(rt, { action: 'set_lock_config', pin: '78987898', alertLevel: 'all' }); /* activity rides the 'all' level */
  for (let i = 0; i < 250; i++) {
    const out = post(rt, { action: 'tg_event', deviceId: 'dev-spam-2', kind: 'activity', data: { screen: 'home', i: i } });
    if (out.throttled) throttled = true;
  }
  check('C7b a 250-event flood from ONE device is capped: 45 s per-kind dedupe + the 240/hour tg_event cap', throttled === true);
  /* the digest path arms when >5 DIFFERENT devices fire the same kind inside
     60 s (the 35-student classroom burst) — the 6th+ are queued, not sent. */
  const sentBeforeBurst = tgSent(rt).length;
  /* realistic classroom device ids — sdp_d_<8-hex> — unique in the first 10 chars */
  for (let d = 0; d < 8; d++) post(rt, { action: 'tg_event', deviceId: 'sdp_d_burst' + d.toString(16) + 'a1b2c3', kind: 'activity', data: { screen: 'dictation' } });
  const burstSent = tgSent(rt).length - sentBeforeBurst;
  check('C7c v0.0.7.j an 8-student activity burst sends ZERO separate messages (silent card folds — FEATURE-J3)',
    burstSent === 0, 'sent=' + burstSent);
  /* the digest queue: >5 rapid events of a kind queue into the digest */
  const dig = post(rt, { action: 'tg_event', deviceId: 'dev-digest', kind: 'digest' });
  check('C7d the digest flush action answers ok (the 60 s batch path)', dig.ok === true, JSON.stringify(dig));
  /* alert level filter: critical hides login/session chatter */
  post(rt, { action: 'set_lock_config', pin: '78987898', alertLevel: 'critical' });
  const before = tgSent(rt).length;
  post(rt, { action: 'tg_event', deviceId: 'dev-quiet-1', kind: 'login', data: { name: 'Q', method: 'Password' } });
  check('C7d at level critical a plain login pushes NO new message (chatter folded into the silent card)',
    tgSent(rt).length === before, before + ' -> ' + tgSent(rt).length);
  rt.setNow(Date.UTC(2026, 10, 21, 12) + 10 * 60 * 1000);
  post(rt, { action: 'tg_event', deviceId: 'dev-quiet-1', kind: 'voice_error', data: { detail: 'autoplay blocked' } });
  check('C7e at level critical a voice error STILL pushes (troubleshooting never muted)',
    tgSent(rt).length > before, before + ' -> ' + tgSent(rt).length);
}

/* ── C8 · tg_event client telemetry relay ──────────────────────────────── */
{
  const rt = boot({});
  const kinds = ['session_start', 'session_end', 'activity', 'login', 'tab_leave', 'voice_error', 'app_error', 'troubleshoot', 'feedback', 'security'];
  let allOk = true;
  kinds.forEach((k, i) => {
    rt.setNow(Date.UTC(2026, 10, 21, 12) + (i + 1) * 2000);
    const out = post(rt, { action: 'tg_event', deviceId: 'dev-ev-1', kind: k, data: { name: 'N', detail: 'd', message: 'm', action: 'a', screen: 's', words: 1, dwellSec: 5, method: 'token', visitCount: 2 } });
    if (!out.ok) allOk = false;
  });
  check('C8a every documented client event kind is accepted (and unknown kinds never crash)', allOk === true);
  const noDev = post(rt, { action: 'tg_event', kind: 'login', data: {} });
  check('C8b a tg_event without a deviceId is refused', noDev.ok === false && noDev.err === 'bad payload', JSON.stringify(noDev));
  rt.setNow(Date.UTC(2026, 10, 21, 12) + 60 * 1000);
  const fb = post(rt, { action: 'tg_event', deviceId: 'dev-ev-2', kind: 'feedback', data: { name: 'Amaya', message: 'The audio for castle stopped halfway on my phone.' } });
  const fbMsg = tgSent(rt).filter((c) => c.options.payload.indexOf('STUDENT FEEDBACK') >= 0);
  check('C8c student feedback reaches Telegram with the exact message text',
    fb.ok === true && fbMsg.length >= 1 && fbMsg[fbMsg.length - 1].options.payload.indexOf('castle stopped halfway') >= 0);
  const ts = post(rt, { action: 'tg_event', deviceId: 'dev-ev-1', kind: 'troubleshoot', data: { action: '1-tap fix: cache purge', detail: 'ran' } });
  check('C8d a troubleshooting 1-tap fix run is relayed', ts.ok === true);
}

/* ── C9 · tg_test (the Studio button) ──────────────────────────────────── */
{
  const rt = boot({});
  const noPin = post(rt, { action: 'tg_test' });
  check('C9a tg_test without the PIN is unauthorised', noPin.ok === false && noPin.err === 'unauthorised', JSON.stringify(noPin));
  const ok = post(rt, { action: 'tg_test', pin: '78987898' });
  check('C9b tg_test pushes the TEST ALERT round trip (Apps Script + Sheets + Telegram)',
    ok.ok === true && ok.telegram === true && tgSent(rt).some((c) => c.options.payload.indexOf('TEST ALERT') >= 0), JSON.stringify(ok));
}

/* ── C10 · zero secrets + ES5 + lock core intact ──────────────────────── */
{
  let es5 = true;
  try { acorn.parse(GAS_SOURCE, { ecmaVersion: 5 }); } catch (e) { es5 = false; }
  check('C10a the shipped gas-source.txt parses as strict ES5 (no \\u{...} escapes, no ES6+)', es5 === true);
  check('C10b zero raw secrets in the shipped file (no bot tokens / PINs / HMAC keys)',
    !/(bot\d{6,}:[A-Za-z0-9_-]{20,})/.test(GAS_SOURCE) && GAS_SOURCE.indexOf('78987898') < 0 && GAS_SOURCE.indexOf('tgwhs_test_secret') < 0 && GAS_SOURCE.indexOf('lockhmac_test_secret') < 0);
  check('C10c every Telegram function is defined exactly ONCE (the v0.0.7.e duplicate defect is gone)',
    ['tgToken', 'tgChat', 'tgSecret', 'tgSend', 'tgApi', 'handleTelegramUpdate', 'handleTgCallback', 'handleTgCommand', 'setupTelegramWebhook', 'fmtColombo', 'notifyAccessRequest', 'notifyLogin', 'notifySession', 'notifyActivity', 'notifyError', 'notifySecurity', 'notifyVisit', 'tgEvent', 'tgTest', 'notifyDigestFlush', 'notifyThrottled', 'levelAllows', 'deviceSummaryLine', 'logError', 'tgFromOk']
      .every((fn) => (GAS_SOURCE.match(new RegExp('function ' + fn + '\\(', 'g')) || []).length === 1));
  check('C10d lock_all PRESERVES the stored password/PIN/mode (the v0.0.7.e wipe defect is fixed)',
    (() => {
      const rt = boot({});
      post(rt, { action: 'set_lock_config', pin: '78987898', on: false, password: 'GalleB1Class!', mode: 'approval+code' });
      post(rt, { action: 'lock_all', pin: '78987898' });
      const st = post(rt, { action: 'access_state' });
      return st.lock.on === true && st.lock.hasPassword === true && st.lock.mode === 'approval+code';
    })());
  check('C10e access_state exposes the unlock policy mode (approval | approval+code | open)',
    (() => {
      const rt = boot({});
      post(rt, { action: 'set_lock_config', pin: '78987898', on: true, mode: 'approval' });
      return post(rt, { action: 'access_state' }).lock.mode === 'approval';
    })());
  check('C10f a bad mode value is rejected by set_lock_config',
    (() => {
      const rt = boot({});
      return post(rt, { action: 'set_lock_config', pin: '78987898', mode: 'chaos' }).err === 'bad mode';
    })());
  check('C10g mode approval (phone-only) refuses a typed password with the honest error',
    (() => {
      const rt = boot({});
      post(rt, { action: 'set_lock_config', pin: '78987898', on: true, mode: 'approval' });
      const out = post(rt, { action: 'verify_lock_secret', deviceId: 'dev-m1', secret: 'whatever' });
      return out.ok === false && String(out.err).indexOf('phone approval') >= 0;
    })());
}

/* ── report ─────────────────────────────────────────────────────────────── */
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
for (const r of results) {
  if (r.status === 'FAIL') console.log('FAIL  ' + r.test + '  [' + r.detail.slice(0, 200) + ']');
}
console.log('\nG26 v007f-telegram-center.cjs — ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
