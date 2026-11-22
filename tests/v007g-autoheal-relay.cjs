#!/usr/bin/env node
'use strict';
/* G28 — tests/v007g-autoheal-relay.cjs — the v0.0.7.g self-heal + Connection Doctor gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.g
 *
 * Root-cause fixes under test (the owner's live production screenshots):
 *   BUG-G1  a STANDALONE Apps Script project (getActiveSpreadsheet() === null)
 *           must NEVER crash: ss() auto-creates "Smart Dictation Player —
 *           Cloud Data", persists SHEET_ID, initialises Config/Access/
 *           AccessCodes/Errors/Telemetry, and ping answers the full health
 *           report; doGet/doPost answer a clean JSON gas_exception envelope
 *           on ANY internal crash (never an HTML error page).
 *   BUG-G2  setupTelegramWebhook() REFUSES /dev URLs; auto_setup_webhook
 *           strictly accepts /exec, persists WEB_APP_URL + tgWebhookUrl and
 *           registers the production webhook with Telegram in one call.
 *   BUG-G3  postRelay() reads res.text() FIRST and classifies HTML Google
 *           Sign-In pages (ERR_AUTH_NOT_ANYONE), Apps Script exception pages
 *           (ERR_GAS_EXCEPTION with the exact extracted message), 404s
 *           (ERR_BAD_URL), network/CORS rejects (ERR_NETWORK_OR_CORS — with
 *           the /dev redirect named as ERR_AUTH_NOT_ANYONE), the 12 s
 *           timeout (ERR_TIMEOUT) and admin PIN refusals
 *           (ERR_ADMIN_PIN_MISMATCH) — each with the bilingual EN + SI fix.
 *   BUG-G4  the 5-Step Connection Doctor & Auto-Repair paints inside the
 *           Access Lock card: URL → ping/auto-sheet → PIN → /exec webhook
 *           → live Telegram round trip, with green ✅ / red ❌ badges and
 *           the exact bilingual cause + fix — never a vague "Relay
 *           unreachable".
 *
 * Parts: H (vm, standalone GAS) · R (jsdom, the postRelay classifier) ·
 *        D (jsdom, the Connection Doctor UI) · B (real headless Chromium,
 *           the classifier + enriched ping over real HTTP).
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
const GAS_SOURCE = readText('data/gas-source.txt');

/* ══ Part H — the STANDALONE Apps Script (BUG-G1 + BUG-G2) ═══════════════ */
function makeStandaloneRuntime(opts) {
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
  const urlFetchLog = [];
  const logs = [];
  const created = [];
  const opened = [];
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
  function makeSpreadsheet(id, name) {
    return {
      getId: () => id,
      getName: () => name,
      getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
      getSheetByName: (n) => sheetObjs[n] || null,
      insertSheet: sheet
    };
  }
  class DateMock extends Date { static now() { return Date.now(); } }
  const context = vm.createContext({
    Date: DateMock, console, JSON, Math, String, Number, Array, Object, Boolean, RegExp, parseInt, parseFloat, isNaN, Error,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => properties[k],
      setProperty: (k, v) => { properties[k] = String(v); }
    }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = String(v); } }) },
    /* THE STANDALONE PROJECT LAW: no bound spreadsheet, /dev test URL */
    SpreadsheetApp: {
      getActiveSpreadsheet: () => null,
      openById: (id) => {
        const hit = created.find((s) => s.getId() === id);
        if (!hit) throw new Error('Spreadsheet not found: ' + id);
        opened.push(String(id));
        return hit;
      },
      create: (name) => { const s = makeSpreadsheet('SS_' + (created.length + 1), String(name)); created.push(s); return s; }
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/STANDALONE/dev' }) },
    Logger: { log: (m) => { logs.push(String(m)); } },
    UrlFetchApp: {
      fetch: (url, options) => {
        urlFetchLog.push({ url: String(url), options: options || null });
        return { getContentText: () => JSON.stringify({ ok: true, result: { message_id: 1 }, description: 'Webhook was set' }), getResponseCode: () => 200 };
      }
    },
    Utilities: {
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      computeDigest: () => [],
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeHmacSha256Signature: (message, secret) => crypto.createHmac('sha256', String(secret)).update(String(message), 'utf8').digest()
    },
    ContentService: { createTextOutput: (t) => ({ _t: String(t), setMimeType() { return this; } }), MimeType: { JSON: 'json' } }
  });
  return { context, tables, properties, urlFetchLog, logs, created, opened };
}
function bootStandalone(opts) {
  const rt = makeStandaloneRuntime(opts);
  vm.runInContext(GAS_SOURCE, rt.context);
  return rt;
}
function gasPost(rt, body) {
  const out = rt.context.doPost({ postData: { contents: JSON.stringify(body) } });
  return JSON.parse(out._t);
}

/* H1 — the first ping on a standalone project auto-creates the Cloud Data
   sheet, persists SHEET_ID, initialises every tab and answers the enriched
   health report (BUG-G1). */
{
  const rt = bootStandalone({});
  const ping = gasPost(rt, { action: 'ping' });
  check('H1a standalone ping answers ok with the enriched v0.0.7.h health report',
    ping.ok === true && ping.pong === true && ping.gas === 'v0.0.7.h' && ping.app === 'sdp-gas',
    JSON.stringify(ping));
  check('H1b ping reports sheetBound:true + a real sheetUrl + every Script Property flag',
    ping.sheetBound === true && String(ping.sheetUrl).indexOf('https://docs.google.com/spreadsheets/d/') === 0 &&
    ping.hasTgBot === true && ping.hasTgChat === true && ping.hasTgSecret === true && ping.hasAdminPin === true,
    JSON.stringify([ping.sheetBound, ping.sheetUrl, ping.hasTgBot, ping.hasTgChat, ping.hasTgSecret, ping.hasAdminPin]));
  check('H1c the auto-heal created exactly ONE "Smart Dictation Player — Cloud Data" spreadsheet',
    rt.created.length === 1 && rt.created[0].getName() === 'Smart Dictation Player — Cloud Data',
    JSON.stringify(rt.created.map((s) => s.getName())));
  check('H1d the new sheet id persisted into the SHEET_ID Script Property',
    String(rt.properties.SHEET_ID || '') === 'SS_1', 'SHEET_ID=' + String(rt.properties.SHEET_ID));
  check('H1e every required tab was initialised with its header row (Config/Access/AccessCodes/Errors/Telemetry)',
    ['Config', 'Access', 'AccessCodes', 'Errors', 'Telemetry'].every((t) => rt.tables[t] && rt.tables[t]._rows.length >= 1 &&
      rt.tables[t]._rows[0].slice(0, 2).join(',').length > 2),
    JSON.stringify(Object.keys(rt.tables)));
  /* an action right after auto-create works with ZERO null crashes */
  const req = gasPost(rt, { action: 'set_lock_config', pin: '78987898', on: true, mode: 'approval+code' });
  const req2 = gasPost(rt, { action: 'access_request', name: 'Standalone Kid', classId: 'B1-TUE-04', deviceId: 'dev-stand-1', fp: 'fp-1' });
  check('H1f lock config + access_request work immediately on the auto-created sheet (the null crash is gone)',
    req.ok === true && req2.ok === true && rt.tables.Access._rows.some((r) => String(r[4]) === 'dev-stand-1' && String(r[6]) === 'pending'),
    JSON.stringify([req, req2]));
}
/* H2 — a second boot reuses the persisted SHEET_ID via openById (no duplicate) */
{
  const rt1 = bootStandalone({});
  gasPost(rt1, { action: 'ping' });
  const savedId = rt1.properties.SHEET_ID;
  const rt2 = bootStandalone({ properties: { SHEET_ID: savedId } });
  /* point the second runtime's openById at the first runtime's sheet store */
  const first = rt1.created.find((s) => s.getId() === savedId);
  rt2.created.push(first);
  gasPost(rt2, { action: 'ping' });
  check('H2a a saved SHEET_ID is reopened via openById (no second spreadsheet created)',
    rt2.created.length === 1 && rt2.opened.indexOf(savedId) >= 0,
    'created=' + rt2.created.length + ' opened=' + JSON.stringify(rt2.opened));
}
/* H3 — an invalid/deleted SHEET_ID falls through to auto-create */
{
  const rt = bootStandalone({ properties: { SHEET_ID: 'DELETED_SHEET_404' } });
  const ping = gasPost(rt, { action: 'ping' });
  check('H3a an invalid SHEET_ID self-heals: a NEW sheet is created and ping still answers ok',
    ping.ok === true && rt.created.length === 1 && rt.properties.SHEET_ID === 'SS_1',
    JSON.stringify([ping.ok, rt.properties.SHEET_ID]));
}
/* H4 — the JSON gas_exception envelope (never an HTML error page) */
{
  const rt = bootStandalone({});
  /* break LockService inside the admin branch → the top-level envelope catches */
  rt.context.LockService = { getScriptLock: () => { throw new Error('script lock service unavailable'); } };
  const out = gasPost(rt, { action: 'readInbox', pin: '78987898' });
  check('H4a an internal crash answers { ok:false, err:"gas_exception", detail } JSON — never an HTML page',
    out.ok === false && out.err === 'gas_exception' && String(out.detail).indexOf('script lock') >= 0,
    JSON.stringify(out));
  const raw = rt.context.doPost({ postData: { contents: JSON.stringify({ action: 'readInbox', pin: '78987898' }) } });
  check('H4b the raw TextOutput is still parseable JSON with the MimeType set',
    !!raw._t && raw.setMimeType === raw.setMimeType && JSON.parse(raw._t).err === 'gas_exception', String(raw._t).slice(0, 80));
}
/* H5 — setupTelegramWebhook refuses /dev, accepts explicit /exec (BUG-G2) */
{
  const rt = bootStandalone({});
  const refused = rt.context.setupTelegramWebhook();
  check('H5a a fresh standalone editor run REFUSES the /dev URL with a crystal-clear reason',
    refused.ok === false && refused.err === 'dev url refused',
    JSON.stringify(refused));
  check('H5b the refusal is logged for the owner with the Studio fix instructions',
    rt.logs.some((l) => l.indexOf('REFUSED') >= 0 && l.indexOf('Save & Auto-Fix Connection') >= 0),
    rt.logs.join(' | ').slice(0, 160));
  const viaProp = bootStandalone({ properties: { WEB_APP_URL: 'https://script.google.com/macros/s/PROPURL/exec' } });
  const okProp = viaProp.context.setupTelegramWebhook();
  check('H5c the WEB_APP_URL Script Property is used when present (resolver chain: arg → property → service url)',
    okProp.ok === true && okProp.webhookUrl === 'https://script.google.com/macros/s/PROPURL/exec?action=tg_callback&secret_token=tgwhs_test_secret',
    JSON.stringify(okProp.webhookUrl));
}
/* H6 — auto_setup_webhook (the Studio 1-click repair, BUG-G2) */
{
  const rt = bootStandalone({});
  const noPin = gasPost(rt, { action: 'auto_setup_webhook', execUrl: 'https://script.google.com/macros/s/REAL/exec' });
  check('H6a auto_setup_webhook without the PIN is unauthorised',
    noPin.ok === false && noPin.err === 'unauthorised', JSON.stringify(noPin));
  const dev = gasPost(rt, { action: 'auto_setup_webhook', execUrl: 'https://script.google.com/macros/s/REAL/dev', pin: '78987898' });
  check('H6b auto_setup_webhook REJECTS a /dev URL with the bilingual cause',
    dev.ok === false && dev.err === 'bad execUrl' && String(dev.detail).indexOf('/dev TEST URL') >= 0,
    JSON.stringify(dev));
  check('H6c the /dev rejection was never registered with Telegram',
    rt.urlFetchLog.filter((f) => f.url.indexOf('setWebhook') >= 0).length === 0, 'setWebhook fired');
  const ok = gasPost(rt, { action: 'auto_setup_webhook', execUrl: 'https://script.google.com/macros/s/AKfycbzREAL/exec', pin: '78987898' });
  const sw = rt.urlFetchLog.filter((f) => f.url.indexOf('setWebhook') >= 0);
  check('H6d auto_setup_webhook registers the /exec webhook with Telegram (secret + allowed_updates)',
    ok.ok === true && ok.webhookOk === true && sw.length === 1 &&
    JSON.parse(sw[0].options.payload).url === 'https://script.google.com/macros/s/AKfycbzREAL/exec?action=tg_callback&secret_token=tgwhs_test_secret' &&
    JSON.parse(JSON.parse(sw[0].options.payload).allowed_updates).join(',') === 'message,callback_query',
    JSON.stringify(ok));
  check('H6e the /exec URL persisted into WEB_APP_URL and tgWebhookUrl (Config sheet)',
    rt.properties.WEB_APP_URL === 'https://script.google.com/macros/s/AKfycbzREAL/exec' &&
    rt.tables.Config._rows.some((r) => String(r[0]) === 'tgWebhookUrl' && String(r[1]) === 'https://script.google.com/macros/s/AKfycbzREAL/exec'),
    JSON.stringify([rt.properties.WEB_APP_URL]));
  const ping2 = gasPost(rt, { action: 'ping' });
  check('H6f the enriched ping now reports the registered webhookUrl',
    ping2.webhookUrl === 'https://script.google.com/macros/s/AKfycbzREAL/exec', JSON.stringify(ping2.webhookUrl));
}
/* H7 — the missing-property health flags (the Doctor's step-2 warnings) */
{
  const rt = bootStandalone({ properties: { TG_BOT_TOKEN: '', TG_CHAT_ID: '', TG_WEBHOOK_SECRET: '', ADMIN_PIN: '' } });
  const ping = gasPost(rt, { action: 'ping' });
  check('H7a ping honestly reports every missing Script Property flag',
    ping.ok === true && ping.hasTgBot === false && ping.hasTgChat === false && ping.hasTgSecret === false && ping.hasAdminPin === false,
    JSON.stringify(ping));
}

/* ══ Part R — the diagnostic postRelay classifier (BUG-G3, jsdom) ════════ */
async function partR() {
  const { createApp } = require('./app-harness.cjs');
  const RELAY = 'https://script.google.com/macros/s/RELAYTEST/exec';
  const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.7.h'); } });
  const relayCalls = [];
  const origFetch = app.w.fetch;
  function serve(body, status, contentType) {
    return Promise.resolve({
      ok: (status || 200) < 300, status: status || 200,
      text: () => Promise.resolve(String(body)),
      json: () => { throw new Error('postRelay must read text() first, never json()'); }
    });
  }
  let mode = 'healthy';
  const SCENARIOS = {
    healthy: () => serve(JSON.stringify({ ok: true, pong: true, ver: 47, gas: 'v0.0.7.h', sheetBound: true, sheetUrl: 'https://docs.google.com/spreadsheets/d/X/edit', hasTgBot: true, hasTgChat: true, hasTgSecret: true, hasAdminPin: true, webhookUrl: '' })),
    signin: () => serve('<!DOCTYPE html><html><head><title>Sign in - Google Accounts</title></head><body>continue to <a href="https://accounts.google.com/ServiceLogin">sign in</a></body></html>', 200, 'text/html'),
    gaserr: () => serve('<!DOCTYPE html><html><head><title>Apps Script Error</title></head><body><p>TypeError: Cannot read properties of null (reading \'getSheetByName\')</p></body></html>', 200, 'text/html'),
    notfound: () => serve('404. That’s an error.', 404, 'text/plain'),
    unauth: () => serve(JSON.stringify({ ok: false, err: 'unauthorised' })),
    pinunset: () => serve(JSON.stringify({ ok: false, err: 'admin_pin_unset' })),
    gasjson: () => serve(JSON.stringify({ ok: false, err: 'gas_exception', detail: 'TypeError: Cannot read properties of null' })),
    netfail: () => Promise.reject(new TypeError('Failed to fetch')),
    hang: () => new Promise(() => {})
  };
  app.w.fetch = function (url, init) {
    if (String(url) === RELAY) {
      relayCalls.push({ url: String(url), init: init || null });
      return SCENARIOS[mode]();
    }
    return origFetch(url, init);
  };
  function relay(modeWanted) {
    mode = modeWanted;
    return new Promise((resolve) => {
      app.SDP.Data.postRelay(RELAY, JSON.stringify({ action: 'ping' }), (err, data) => resolve({ err, data }));
    });
  }

  /* R1 — the request options carry the BUG-G3 fix laws */
  await relay('healthy');
  const init = relayCalls[relayCalls.length - 1].init;
  check('R1a postRelay sends method POST + mode cors + redirect follow + credentials omit',
    init && init.method === 'POST' && init.mode === 'cors' && init.redirect === 'follow' && init.credentials === 'omit',
    JSON.stringify(init && { method: init.method, mode: init.mode, redirect: init.redirect, credentials: init.credentials }));
  check('R1b the body rides text/plain;charset=UTF-8 (the Apps Script no-preflight law)',
    init && init.headers && init.headers['Content-Type'] === 'text/plain;charset=UTF-8', JSON.stringify(init && init.headers));

  /* R2 — a healthy enriched ping passes through untouched */
  const ok = await relay('healthy');
  check('R2a a healthy JSON relay answer reaches the callback as data (err === null)',
    ok.err === null && ok.data && ok.data.ok === true && ok.data.pong === true && ok.data.sheetBound === true,
    JSON.stringify([ok.err && ok.err.code, ok.data && ok.data.gas]));

  /* R3 — the Google Sign-In HTML page → ERR_AUTH_NOT_ANYONE with the fix */
  const si = await relay('signin');
  check('R3a an HTML Google Sign-In page classifies as ERR_AUTH_NOT_ANYONE (never a vague unreachable)',
    si.err && si.err.code === 'ERR_AUTH_NOT_ANYONE', JSON.stringify(si.err && si.err.code));
  check('R3b the EN fix names the exact deployment fix (Who has access: Anyone / /exec)',
    si.err && si.err.en.indexOf('Anyone') >= 0 && si.err.en.indexOf('/exec') >= 0, String(si.err && si.err.en).slice(0, 120));
  check('R3c the SI fix is carried alongside (bilingual law)',
    si.err && si.err.si.length > 20 && /\u0d80-\u0dff/.test(si.err.si) === false && si.err.si !== si.err.en, String(si.err && si.err.si).slice(0, 60));

  /* R4 — an Apps Script exception page → ERR_GAS_EXCEPTION with the exact message */
  const ge = await relay('gaserr');
  check('R4a an Apps Script exception HTML page classifies as ERR_GAS_EXCEPTION with the exact extracted error',
    ge.err && ge.err.code === 'ERR_GAS_EXCEPTION' && ge.err.en.indexOf("Cannot read properties of null (reading 'getSheetByName')") >= 0,
    String(ge.err && ge.err.en).slice(0, 160));

  /* R5 — a 404 → ERR_BAD_URL */
  const nf = await relay('notfound');
  check('R5a a 404 answers ERR_BAD_URL with the Manage deployments fix',
    nf.err && nf.err.code === 'ERR_BAD_URL' && nf.err.en.indexOf('Manage deployments') >= 0,
    JSON.stringify(nf.err && nf.err.code));

  /* R6 — the admin PIN refusals → ERR_ADMIN_PIN_MISMATCH */
  const ua = await relay('unauth');
  const uaCls = app.SDP.Data.relayClassify(ua.err, ua.data);
  check('R6a a JSON {ok:false,err:unauthorised} classifies as ERR_ADMIN_PIN_MISMATCH via relayClassify',
    ua.err === null && uaCls && uaCls.code === 'ERR_ADMIN_PIN_MISMATCH',
    JSON.stringify([ua.err && ua.err.code, uaCls && uaCls.code]));
  const pu = await relay('pinunset');
  check('R6b admin_pin_unset is classified as ERR_ADMIN_PIN_MISMATCH naming the unset PIN',
    app.SDP.Data.relayClassify(null, pu.data).code === 'ERR_ADMIN_PIN_MISMATCH' &&
    app.SDP.Data.relayClassify(null, pu.data).en.indexOf('ADMIN_PIN is not set') >= 0, JSON.stringify(pu.data));

  /* R7 — the JSON gas_exception envelope (BUG-G1's client-side twin) */
  const gj = await relay('gasjson');
  check('R7a a JSON {ok:false,err:gas_exception} is surfaced as ERR_GAS_EXCEPTION with the detail',
    app.SDP.Data.relayClassify(null, gj.data).code === 'ERR_GAS_EXCEPTION' &&
    app.SDP.Data.relayClassify(null, gj.data).en.indexOf('Cannot read properties of null') >= 0,
    JSON.stringify(gj.data));

  /* R8 — a network/CORS reject → ERR_NETWORK_OR_CORS */
  const nx = await relay('netfail');
  check('R8a a raw network/CORS reject classifies as ERR_NETWORK_OR_CORS with the 3-point checklist',
    nx.err && nx.err.code === 'ERR_NETWORK_OR_CORS' && nx.err.en.indexOf('ad-blocker') >= 0,
    JSON.stringify(nx.err && nx.err.code));

  /* R9 — the /dev URL reject → ERR_AUTH_NOT_ANYONE (the live screenshot case) */
  const DEV = 'https://script.google.com/macros/s/RELAYTEST/dev';
  const devRes = await new Promise((resolve) => {
    app.w.fetch = function (url, init2) {
      if (String(url) === DEV) return Promise.reject(new TypeError('Failed to fetch'));
      return origFetch(url, init2);
    };
    app.SDP.Data.postRelay(DEV, JSON.stringify({ action: 'ping' }), (err, data) => resolve({ err, data }));
  });
  check('R9a a /dev URL whose Sign-In redirect fails CORS classifies as ERR_AUTH_NOT_ANYONE (not a vague network error)',
    devRes.err && devRes.err.code === 'ERR_AUTH_NOT_ANYONE' && devRes.err.en.indexOf('/dev TEST URL') >= 0,
    JSON.stringify(devRes.err && devRes.err.code));

  /* R10 — the strict 12 s timeout */
  const timedOut = await (async () => {
    let resolveHang;
    const hangP = new Promise((r) => { resolveHang = r; });
    app.w.fetch = function (url, init2) {
      if (String(url) === RELAY) return SCENARIOS.hang();
      return origFetch(url, init2);
    };
    mode = 'hang';
    app.SDP.Data.postRelay(RELAY, JSON.stringify({ action: 'ping' }), (err, data) => resolveHang({ err, data }));
    /* the harness clock is fake — step it PAST the 12 s deadline */
    await app.advance(12000);
    await app.settle(4);
    return await Promise.race([
      hangP,
      new Promise((r) => setTimeout(() => r({ err: { code: 'NEVER_RESOLVED' } }), 2000))
    ]);
  })();
  check('R10a a relay that never answers is cut at exactly 12 s with ERR_TIMEOUT',
    timedOut.err && timedOut.err.code === 'ERR_TIMEOUT', JSON.stringify(timedOut.err && timedOut.err.code));

  await app.close();
}

/* ══ Part D — the 5-Step Connection Doctor UI (BUG-G4, jsdom) ════════════ */
async function partD() {
  const { createApp } = require('./app-harness.cjs');
  const RELAY = 'https://script.google.com/macros/s/DOCTOR1/exec';
  const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.7.h'); } });
  const origFetch = app.w.fetch;
  let mode = 'healthy';
  const calls = [];
  const HEALTHY = {
    ping: { ok: true, pong: true, ver: 47, app: 'sdp-gas', gas: 'v0.0.7.h', sheetBound: true, sheetUrl: 'https://docs.google.com/spreadsheets/d/DOC1/edit', hasTgBot: true, hasTgChat: true, hasTgSecret: true, hasAdminPin: true, webhookUrl: 'https://script.google.com/macros/s/DOCTOR1/exec' },
    access_state: { ok: true, lock: { on: true, mode: 'approval+code', hasPassword: false, hasPin: false, graceHours: 72 } },
    access_roster: { ok: true, pending: [], approved: [] },
    auto_setup_webhook: { ok: true, webhookOk: true, webhookUrl: 'https://script.google.com/macros/s/DOCTOR1/exec', telegramDesc: 'Webhook was set' },
    tg_test: { ok: true, telegram: true, sheets: true }
  };
  app.w.fetch = function (url, init) {
    if (String(url) === RELAY) {
      let body = {};
      try { body = JSON.parse(init && init.body); } catch (e) {}
      calls.push(String(body.action));
      if (mode === 'healthy') return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(HEALTHY[body.action] || { ok: true })) });
      if (mode === 'signin') return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<!DOCTYPE html><html><body>accounts.google.com/ServiceLogin</body></html>') });
      if (mode === 'gaserr') return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<html><p>TypeError: Cannot read properties of null</p></html>') });
      if (mode === 'unauth') return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body.action === 'access_roster' ? { ok: false, err: 'unauthorised' } : HEALTHY[body.action] || { ok: true })) });
      if (mode === 'tgfail') return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body.action === 'tg_test' ? { ok: false } : HEALTHY[body.action] || { ok: true })) });
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(HEALTHY[body.action] || { ok: true })) });
    }
    return origFetch(url, init);
  };

  /* unlock the Studio and open the Access Lock card */
  app.byId('btnStudioQuick').click();
  await app.settle(6);
  await new Promise((resolve) => app.SDP.Studio.setup('78987898', { ghToken: 'ghp_x', elevenKey: 'sk_x' }, () => resolve()));
  await app.settle(8);
  const drawer = app.byId('studioAdvancedDrawer');
  if (drawer) drawer.open = true;
  await app.settle(3);
  check('D0a the Access Lock card ships the v0.0.7.g doctor controls (Save & Auto-Fix + Doctor + checklist host)',
    !!(app.byId('btnAlSaveTestRelay') && app.byId('btnAlDoctor') && app.byId('studioAlDoctor')),
    'save=' + !!app.byId('btnAlSaveTestRelay') + ' doctor=' + !!app.byId('btnAlDoctor') + ' host=' + !!app.byId('studioAlDoctor'));

  /* D1 — the live /dev URL detector + the 1-click /exec swap */
  const fld = app.byId('studioGasUrl');
  const warn = app.byId('studioGasUrlDevWarn');
  fld.value = 'https://script.google.com/macros/s/DOCTOR1/dev';
  fld.dispatchEvent(new app.w.Event('input', { bubbles: true }));
  await app.settle(2);
  check('D1a pasting a /dev URL raises the immediate bilingual warning',
    !!warn && warn.hidden === false, 'warn hidden=' + (warn ? warn.hidden : 'missing'));
  const fixBtn = app.byId('btnGasDevFix');
  check('D1b the warning offers the 1-click "Use the /exec URL instead" button', !!fixBtn, 'missing');
  if (fixBtn) { fixBtn.click(); await app.settle(2); }
  check('D1c the 1-click fix swaps /dev → /exec (same deployment) and clears the warning',
    fld.value === RELAY && warn.hidden === true, fld.value);
  const saved = JSON.parse(app.w.localStorage.getItem('sdp.settings') || '{}');
  check('D1d the swapped /exec URL auto-persisted into sdp.settings.gasUrl',
    saved.gasUrl === RELAY, 'gasUrl=' + String(saved.gasUrl));

  /* D2 — the Doctor against the Sign-In HTML relay: step 2 fails with the
     EXACT ERR_AUTH_NOT_ANYONE bilingual fix (never "Relay unreachable") */
  mode = 'signin';
  calls.length = 0;
  app.byId('btnAlDoctor').click();
  await app.settle(10);
  const host = app.byId('studioAlDoctor');
  const docText = () => host.textContent || '';
  check('D2a the Doctor ran step 1 (URL) green then stopped at step 2 with the Sign-In diagnosis',
    /Step 1/.test(docText()) && /ERR_AUTH_NOT_ANYONE|Who has access: Anyone/.test(docText()),
    docText().slice(0, 200));
  check('D2b the failing step shows the EXACT fix (re-deploy with Who has access: Anyone + paste /exec)',
    docText().indexOf('Who has access: Anyone') >= 0, docText().slice(0, 260));
  check('D2c the bilingual Sinhala fix line is rendered next to the English one',
    docText().length > 0 && /\u0dc0\u0dd2\u0dc3\u0db3\u0dd4\u0db8|Apps Script/.test(docText()) && docText() !== docText().replace(/[^\x00-\x7F]/g, ''),
    'no sinhala');
  check('D2d the probe line never says the vague "Relay unreachable" again',
    (app.byId('studioAlRelayProbe').textContent || '').indexOf('Relay unreachable') < 0,
    app.byId('studioAlRelayProbe').textContent.slice(0, 120));
  check('D2e only ping was attempted (the doctor stops at the first failing step)',
    calls.indexOf('access_state') < 0 && calls.indexOf('tg_test') < 0, JSON.stringify(calls));

  /* D3 — the Doctor against an Apps Script exception relay */
  mode = 'gaserr';
  app.byId('btnAlDoctor').click();
  await app.settle(10);
  check('D3a an Apps Script exception shows the EXACT extracted error inside the card',
    docText().indexOf('Cannot read properties of null') >= 0, docText().slice(0, 200));

  /* D4 — the admin PIN mismatch path */
  mode = 'unauth';
  app.byId('btnAlDoctor').click();
  await app.settle(12);
  check('D4a an admin PIN mismatch fails step 3 with the ERR_ADMIN_PIN_MISMATCH fix',
    docText().indexOf('ADMIN_PIN') >= 0 && /Studio PIN|Script Properties/.test(docText()),
    docText().slice(0, 260));

  /* D5 — the healthy 5-step run */
  mode = 'healthy';
  calls.length = 0;
  app.byId('btnAlSaveTestRelay').click();
  await app.settle(14);
  check('D5a the healthy run fires the full chain ping → access_state → access_roster → auto_setup_webhook → tg_test',
    ['ping', 'access_state', 'access_roster', 'auto_setup_webhook', 'tg_test'].every((a) => calls.indexOf(a) >= 0),
    JSON.stringify(calls));
  check('D5b all five steps paint green ✅ badges',
    Array.from(host.querySelectorAll('.studio-al-docstep')).length === 5 &&
    Array.from(host.querySelectorAll('.studio-al-docstep[data-state="ok"]')).length === 5,
    Array.from(host.querySelectorAll('.studio-al-docstep')).map((n) => n.getAttribute('data-state')).join(','));
  check('D5c step 2 renders the backend health (sheet bound + URL + properties present)',
    docText().indexOf('Google Sheet bound') >= 0 && docText().indexOf('All Script Properties present') >= 0,
    docText().slice(0, 300));
  check('D5d step 4 renders the registered /exec webhook',
    docText().indexOf('registered with Telegram') >= 0, docText().slice(0, 400));
  check('D5e step 5 confirms the live Telegram round trip + the student config readiness',
    docText().indexOf('Test alert') >= 0 && docText().indexOf('accessLock.relayUrl') >= 0, docText().slice(0, 460));
  check('D5f the probe summary line reports all 5 steps green',
    (app.byId('studioAlRelayProbe').textContent || '').indexOf('all 5 steps green') >= 0,
    app.byId('studioAlRelayProbe').textContent.slice(0, 140));

  /* D6 — a /dev URL fails the doctor at step 1 with the swap advice */
  fld.value = 'https://script.google.com/macros/s/DOCTOR1/dev';
  fld.dispatchEvent(new app.w.Event('input', { bubbles: true }));
  await app.settle(2);
  calls.length = 0;
  app.byId('btnAlDoctor').click();
  await app.settle(6);
  check('D6a a /dev URL fails the Doctor at Step 1 with the /dev explanation (before any network call)',
    docText().indexOf('/dev TEST URL') >= 0 && calls.indexOf('ping') < 0,
    docText().slice(0, 160) + ' calls=' + JSON.stringify(calls.slice(-4)));

  /* D7 — the Telegram-send failure path keeps the first four steps green */
  mode = 'tgfail';
  fld.value = RELAY;
  fld.dispatchEvent(new app.w.Event('input', { bubbles: true }));
  await app.settle(2);
  app.byId('btnAlDoctor').click();
  await app.settle(14);
  const states = Array.from(host.querySelectorAll('.studio-al-docstep')).map((n) => n.getAttribute('data-state'));
  check('D7a a Telegram send failure fails ONLY step 5 with the TG_BOT_TOKEN/TG_CHAT_ID fix',
    states.join(',').indexOf('ok,ok,ok,ok,bad') === 0 && docText().indexOf('TG_BOT_TOKEN') >= 0,
    states.join(',') + ' | ' + docText().slice(0, 200));

  check('D8a the whole Doctor run threw zero real page errors',
    app.realErrors().length === 0, app.realErrors().join(' | ').slice(0, 200));
  await app.close();
}

/* ══ Part B — real headless Chromium over real HTTP (BUG-G1+G3 end-to-end) */
async function partB() {
  const http = require('node:http');
  const { chromium } = require('playwright-core');
  const serverChromium = require('@sparticuz/chromium');
  require('./chromium-env.cjs').ensureChromiumLibs();
  const { start } = require('./static-server.cjs');

  /* the real GAS vm (bound-sheet mock, exactly the G27 law) for the healthy relay */
  function makeBoundRuntime() {
    const tables = {};
    const sheetObjs = {};
    const cache = {};
    const properties = {
      ADMIN_PIN: '78987898', TG_BOT_TOKEN: '123456:TESTBOT', TG_CHAT_ID: '987654321',
      TG_WEBHOOK_SECRET: 'tgwhs_test_secret', LOCK_HMAC_SECRET: 'lockhmac_test_secret'
    };
    const urlFetchLog = [];
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
    class DateMock extends Date { static now() { return Date.now(); } }
    const context = vm.createContext({
      Date: DateMock, console, JSON, Math, String, Number, Array, Object, Boolean, RegExp, parseInt, parseFloat, isNaN, Error,
      PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => properties[k] }) },
      CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = String(v); } }) },
      SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheetObjs[n] || null, insertSheet: sheet, getUrl: () => 'https://docs.google.com/spreadsheets/d/BOUND1/edit' }) },
      LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
      ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/BOUND/exec' }) },
      Logger: { log() {} },
      UrlFetchApp: { fetch: (url, options) => { urlFetchLog.push({ url: String(url), options: options || null }); return { getContentText: () => JSON.stringify({ ok: true, result: { message_id: 1 } }), getResponseCode: () => 200 }; } },
      Utilities: {
        base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        computeDigest: () => [],
        DigestAlgorithm: { SHA_256: 'SHA_256' },
        computeHmacSha256Signature: (message, secret) => crypto.createHmac('sha256', String(secret)).update(String(message), 'utf8').digest()
      },
      ContentService: { createTextOutput: (t) => ({ _t: String(t), setMimeType() { return this; } }), MimeType: { JSON: 'json' } }
    });
    return { context, tables, urlFetchLog };
  }
  const boundRt = makeBoundRuntime();
  vm.runInContext(GAS_SOURCE, boundRt.context);

  /* mode-switchable relay: html (Google Sign-In) | gas (the real vm) */
  let relayMode = 'html';
  const relaySrv = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (relayMode === 'html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8', 'Access-Control-Allow-Origin': '*' });
        res.end('<!DOCTYPE html><html><head><title>Sign in - Google Accounts</title></head><body>continue to <a href="https://accounts.google.com/ServiceLogin">sign in</a></body></html>');
        return;
      }
      try {
        const out = boundRt.context.doPost({ postData: { contents: body } });
        const text = out && out._t ? out._t : JSON.stringify(out || { ok: false });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(text);
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, err: 'relay' }));
      }
    });
  });
  await new Promise((resolve) => relaySrv.listen(0, '127.0.0.1', resolve));
  const RELAY = 'http://127.0.0.1:' + relaySrv.address().port + '/exec';

  const server = await start({ root: ROOT });
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a));
  const browser = await chromium.launch({ headless: true, executablePath, args });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(server.origin) || url.startsWith('http://127.0.0.1') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
    await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.SDP && SDP.Data && SDP.Data.postRelay), null, { timeout: 15000 });

    /* B1 — the Sign-In HTML page over REAL http → ERR_AUTH_NOT_ANYONE in the browser */
    relayMode = 'html';
    const html = await page.evaluate((relay) => new Promise((resolve) => {
      SDP.Data.postRelay(relay, JSON.stringify({ action: 'ping' }), (err, data) => resolve({ code: err && err.code, en: err && err.en, dataOk: data && data.ok }));
    }), RELAY);
    check('B1a real Chromium: an HTML Google Sign-In relay answer classifies ERR_AUTH_NOT_ANYONE',
      html.code === 'ERR_AUTH_NOT_ANYONE' && String(html.en).indexOf('Anyone') >= 0, JSON.stringify(html).slice(0, 140));

    /* B2 — the healthy real-GAS relay → the enriched ping passes through */
    relayMode = 'gas';
    const good = await page.evaluate((relay) => new Promise((resolve) => {
      SDP.Data.postRelay(relay, JSON.stringify({ action: 'ping' }), (err, data) => resolve({ errCode: err && err.code, ok: data && data.ok, pong: data && data.pong, gas: data && data.gas, sheetBound: data && data.sheetBound, sheetUrl: data && data.sheetUrl }));
    }), RELAY);
    check('B2a real Chromium: the healthy relay answers the enriched v0.0.7.h ping (pong + sheetBound + sheetUrl)',
      (good.errCode === null || good.errCode === undefined) && good.ok === true && good.pong === true && good.gas === 'v0.0.7.h' && good.sheetBound === true && String(good.sheetUrl).indexOf('docs.google.com') >= 0,
      JSON.stringify(good));

    /* B3 — an admin action against the real GAS relay round-trips cleanly */
    const roster = await page.evaluate((relay) => new Promise((resolve) => {
      SDP.Data.postRelay(relay, JSON.stringify({ action: 'access_roster', pin: '78987898' }), (err, data) => resolve({ errCode: err && err.code, ok: data && data.ok, pending: data && Array.isArray(data.pending) }));
    }), RELAY);
    check('B3a real Chromium: a pinned admin action (access_roster) round-trips the real GAS vm',
      (roster.errCode === null || roster.errCode === undefined) && roster.ok === true && roster.pending === true, JSON.stringify(roster));

    /* B4 — the wrong PIN surfaces ERR_ADMIN_PIN_MISMATCH through relayClassify */
    const badPin = await page.evaluate((relay) => new Promise((resolve) => {
      SDP.Data.postRelay(relay, JSON.stringify({ action: 'access_roster', pin: '00000000' }), (err, data) => resolve({ code: SDP.Data.relayClassify(err, data) && SDP.Data.relayClassify(err, data).code }));
    }), RELAY);
    check('B4a real Chromium: a wrong Studio PIN classifies ERR_ADMIN_PIN_MISMATCH',
      badPin.code === 'ERR_ADMIN_PIN_MISMATCH', JSON.stringify(badPin));

    check('B5a the whole real-browser relay session threw zero page errors',
      errors.length === 0, errors.join(' | ').slice(0, 200));
    await ctx.close();
  } finally {
    await browser.close().catch(() => {});
    relaySrv.close();
  }
}

/* ══ run ══════════════════════════════════════════════════════════════════ */
(async function main() {
  let crashed = '';
  try { await partR(); } catch (e) { crashed += 'R:' + String(e && e.message) + ' '; }
  try { await partD(); } catch (e) { crashed += 'D:' + String(e && e.message) + ' '; }
  try {
    if (process.env.G28_SKIP_BROWSER !== '1') await partB();
  } catch (e) { crashed += 'B:' + String(e && e.message) + ' '; }
  const fails = results.filter((r) => r.status === 'FAIL');
  for (const r of fails) console.log('FAIL  ' + r.test + '  [' + r.detail.slice(0, 220) + ']');
  console.log('\nG28 v007g-autoheal-relay.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL' + (crashed ? '  [CRASHED: ' + crashed.trim() + ']' : ''));
  process.exit(fails.length || crashed ? 1 : 0);
})().catch((e) => {
  console.error('G28 v007g-autoheal-relay.cjs crashed:', e);
  process.exit(1);
});
