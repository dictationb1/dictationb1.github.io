#!/usr/bin/env node
'use strict';
/* G27 — tests/v007f-lock-relay-e2e.cjs — the v0.0.7.g end-to-end lock + relay gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.g
 * Real Chromium + the shipped app + a faithful in-process Apps Script relay:
 *   E1  BUG-F1 — the Studio Access Lock panel reads #studioGasUrl live: the
 *       relay URL pasted into the Advanced Tools field (never re-saved to the
 *       vault) still drives every lock button — no red "paste it under
 *       Advanced Tools first" error.
 *   E2  BUG-F1 — a STUDENT phone discovers the relay from
 *       data/config.json accessLock.relayUrl (no sdp.settings.gasUrl, no
 *       Studio secrets) and the Entry Lock genuinely reaches the relay.
 *   E3  the 1-tap Telegram approval unlocks the student in ~4 s: the request
 *       lands pending → the relay webhook approve (Hansana's chat id) issues
 *       the HMAC token → the student's 4 s poll flips to approved and the
 *       overlay unmounts with zero page errors.
 *   E4  the unlock policy mode: approval-only hides the code/password path
 *       in the overlay (and access_state carries the mode).
 *   E5  live activity telemetry: session_start + session_end (words/score/
 *       dwell) + tab_leave beacon reach the relay as tg_event payloads.
 *   E6  voice-error telemetry: a corrupted clip detection pushes a
 *       voice_error tg_event with the clip key.
 *   E7  two-way commands through the relay: /lock flips the lock ON for a
 *       student boot (gate arms), /unlock opens it again.
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
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── the in-process Apps Script relay (the real shipped gas-source.txt) ── */
function makeRuntime() {
  const tables = {};
  const sheetObjs = {};
  const cache = {};
  const properties = {
    ADMIN_PIN: '78987898',
    TG_BOT_TOKEN: '123456:TESTBOT',
    TG_CHAT_ID: '987654321',
    TG_WEBHOOK_SECRET: 'tgwhs_test_secret',
    LOCK_HMAC_SECRET: 'lockhmac_test_secret'
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
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => sheetObjs[n] || null, insertSheet: sheet }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/E2E/exec' }) },
    Logger: { log() {} },
    UrlFetchApp: {
      fetch: (url, options) => {
        urlFetchLog.push({ url: String(url), options: options || null });
        return { getContentText: () => JSON.stringify({ ok: true, result: { message_id: 1 } }), getResponseCode: () => 200 };
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
  return { context, tables, urlFetchLog, cache };
}

const GAS_SOURCE = readText('data/gas-source.txt');
const relayRt = makeRuntime();
vm.runInContext(GAS_SOURCE, relayRt.context);
const relayLog = { events: [], commands: [], webhooks: [] };
let lockMode = 'approval+code';

/* The relay HTTP server: POST = client actions + Telegram webhook updates. */
function startRelay() {
  return new Promise((resolve) => {
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
          const e = {
            parameter: Object.fromEntries(url.searchParams.entries()),
            postData: { contents: body }
          };
          let out;
          if (url.searchParams.get('action') === 'tg_callback') {
            relayLog.webhooks.push(JSON.parse(body || '{}'));
            out = relayRt.context.doPost(e);
          } else {
            try { const b = JSON.parse(body || '{}'); if (b.action === 'tg_event') relayLog.events.push({ t: Date.now(), kind: b.kind, deviceId: b.deviceId }); } catch (eP) {}
            out = relayRt.context.doPost(e);
          }
          const text = out && out._t ? out._t : JSON.stringify(out || { ok: false });
          const parsed = JSON.parse(text);
          if (parsed && parsed.lock && parsed.lock.mode !== undefined) lockMode = parsed.lock.mode;
          res.writeHead(200);
          res.end(text);
        } catch (err) {
          res.writeHead(200);
          res.end(JSON.stringify({ ok: false, err: 'relay' }));
        }
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function launch() {
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => ![
    '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'
  ].includes(a));
  return chromium.launch({ headless: true, executablePath, args });
}

(async function main() {
  /* static prep: a config.json carrying the public relay URL (BUG-F1 E2) */
  const server = await start({ root: ROOT });
  const relay = await startRelay();
  const RELAY_URL = 'http://127.0.0.1:' + relay.address().port + '/exec';
  const browser = await launch();
  try {
    /* arm the lock ON before any student boots */
    relayRt.context.doPost({ postData: { contents: JSON.stringify({ action: 'set_lock_config', pin: '78987898', on: true, mode: 'approval+code' }) } });

    /* ── E2 + E3: the student phone — relay discovered from config.json ── */
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await ctx.addInitScript((relayUrl) => {
        window.__SDP_NO_LIVE__ = true;
        window.__SDP_E2E_RELAY__ = relayUrl;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.7.h');
          /* NO sdp.settings.gasUrl — the student must find the relay via
             config.json accessLock.relayUrl (the BUG-F1 student-side law). */
        } catch (e) {}
        /* intercept the config fetch so accessLock.relayUrl points at the
           local relay (the real config.json ships the production /exec). */
        const origFetch = window.fetch.bind(window);
        window.fetch = function (url, opts) {
          const u = String(url);
          if (u.indexOf('config.json') >= 0 && u.indexOf('127.0.0.1') < 0 && u.indexOf('data/config.json') >= 0) {
            return origFetch(u, opts).then(function (res) {
              return res.clone().json().then(function (cfg) {
                try {
                  cfg.accessLock = cfg.accessLock || {};
                  cfg.accessLock.relayUrl = window.__SDP_E2E_RELAY__;
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
      await page.waitForTimeout(2500);
      const armed = await page.evaluate(() => ({
        overlay: !!document.getElementById('sdpAccessLock'),
        relay: (window.SDP && SDP.AccessLock && SDP.AccessLock.relayUrl) ? SDP.AccessLock.relayUrl() : 'no_export',
        mode: (window.SDP && SDP.AccessLock && SDP.AccessLock.unlockMode) ? SDP.AccessLock.unlockMode() : 'no_export'
      }));
      check('E2a the student Entry Lock arms when LOCK ON (relay discovered from config.json accessLock.relayUrl)',
        armed.overlay === true && String(armed.relay).indexOf('127.0.0.1') >= 0, JSON.stringify(armed));
      check('E2b the unlock policy mode reaches the client (approval+code default)',
        armed.mode === 'approval+code', String(armed.mode));
      /* the student requests access */
      await page.evaluate(() => {
        document.getElementById('sdpAccessName').value = 'Kasun Perera';
        document.getElementById('sdpAccessClass').value = 'B1-TUE-04';
        document.getElementById('sdpAccessRequestBtn').click();
      });
      await page.waitForTimeout(1500);
      const pend = await page.evaluate(() => (window.SDP.AccessLock.state().pending === true));
      check('E3a the access request lands as pending (the relay upserted the row)',
        pend === true, 'pending=' + pend);
      const accessRow = relayRt.tables.Access._rows.find((r) => String(r[2]) === 'Kasun Perera');
      check('E3b the Access sheet row is pending with the student name + class',
        !!accessRow && String(accessRow[6]) === 'pending' && String(accessRow[3]) === 'B1-TUE-04',
        accessRow ? JSON.stringify(accessRow.slice(2, 8)) : 'no row');
      const tgReq = relayRt.urlFetchLog.filter((f) => f.url.indexOf('/sendMessage') >= 0 && f.options.payload.indexOf('ACCESS REQUEST') >= 0);
      check('E3c the ACCESS REQUEST Telegram alert fired with the [✅ Approve] inline button',
        tgReq.length >= 1 && tgReq[0].options.payload.indexOf('approve:') >= 0, 'fires=' + tgReq.length);
      /* Hansana taps [✅ Approve] in Telegram (webhook POST to the relay) */
      const deviceId = accessRow ? String(accessRow[4]) : '';
      const approveRes = await new Promise((resolve) => {
        const payload = JSON.stringify({ callback_query: { id: 'cbE3', from: { id: 987654321 }, message: { message_id: 1, chat: { id: 987654321 } }, data: 'approve:' + deviceId } });
        const req = http.request('http://127.0.0.1:' + relay.address().port + '/exec?action=tg_callback&secret_token=tgwhs_test_secret', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }, (res) => {
          let b = '';
          res.on('data', (c) => { b += c; });
          res.on('end', () => resolve(b));
        });
        req.end(payload);
      });
      let approved = {};
      try { approved = JSON.parse(approveRes); } catch (e) {}
      check('E3d the Telegram [✅ Approve] webhook answers "Approved by Hansana — Student unlocked!"',
        approved.ok === true && String(approved.note || '').indexOf('Approved by Hansana') >= 0, approveRes.slice(0, 140));
      /* the student's 4 s poll flips to approved + the overlay unmounts */
      const unlocked = await page.waitForFunction(() => {
        try { return !document.getElementById('sdpAccessLock') && !!document.getElementById('screen-home'); } catch (e) { return false; }
      }, null, { timeout: 12000 }).then(() => true, () => false);
      check('E3e the student unlocks automatically within ~4 s (the poll, the HMAC token, the overlay gone)',
        unlocked === true, 'overlay still up');
      check('E3f the whole student journey threw zero page errors', errors.length === 0, errors.join(' | '));
      /* E5: live activity telemetry from the unlocked student */
      const evBefore = relayLog.events.length;
      await page.evaluate(() => {
        try {
          if (window.SDP && SDP.Telemetry && SDP.Telemetry.pushEvent) {
            SDP.Telemetry.pushEvent('session_end', { sessionNo: '1', name: 'Kasun Perera', words: 31, score: 87, dwellSec: 1450, mode: 'paper' });
          }
        } catch (e) {}
      });
      await page.waitForTimeout(1200);
      const sawSession = relayLog.events.some((e) => e.kind === 'session_end');
      const sessionSent = relayRt.urlFetchLog.some((f) => f.url.indexOf('/sendMessage') >= 0 && f.options.payload.indexOf('SESSION') >= 0);
      if (process.env.G27_DEBUG) console.log('E5a DEBUG event:', sawSession, 'sent:', sessionSent, 'sends:', JSON.stringify(relayRt.urlFetchLog.filter((f) => f.url.indexOf('/sendMessage') >= 0).map((f) => String(f.options.payload).slice(0, 44))));
      check('E5a the session_end tg_event reached the relay AND the SESSION Telegram summary fired',
        sawSession === true && sessionSent === true,
        'events=' + JSON.stringify(relayLog.events.filter((e) => e.kind === 'session_end').slice(-1)) + ' sent=' + sessionSent);
      await page.evaluate(() => {
        try {
          if (window.SDP && SDP.Telemetry && SDP.Telemetry.pushEvent) {
            SDP.Telemetry.pushEvent('voice_error', { detail: 'MP3 decode failure', clipKey: 'words.castle' });
          }
        } catch (e) {}
      });
      await page.waitForTimeout(1200);
      const sawVoice = relayLog.events.some((e) => e.kind === 'voice_error');
      check('E6 a voice_error tg_event with the exact clip key reached the relay AND raised the VOICE ERROR Telegram alert + Errors sheet row',
        sawVoice === true &&
        relayRt.urlFetchLog.some((f) => f.url.indexOf('/sendMessage') >= 0 && f.options.payload.indexOf('words.castle') >= 0) &&
        (relayRt.tables.Errors ? relayRt.tables.Errors._rows.some((r) => String(r[2]) === 'voice_error') : false),
        'voice events=' + relayLog.events.filter((e) => e.kind === 'voice_error').length);
      await ctx.close();
    }

    /* ── E4: approval-only mode hides the code path ── */
    {
      relayRt.context.doPost({ postData: { contents: JSON.stringify({ action: 'set_lock_config', pin: '78987898', on: true, mode: 'approval' }) } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await ctx.addInitScript((relayUrl) => {
        window.__SDP_NO_LIVE__ = true;
        window.__SDP_E2E_RELAY__ = relayUrl;
        const origFetch = window.fetch.bind(window);
        window.fetch = function (url, opts) {
          const u = String(url);
          if (u.indexOf('data/config.json') >= 0 && u.indexOf('127.0.0.1') < 0) {
            return origFetch(u, opts).then(function (res) {
              return res.clone().json().then(function (cfg) {
                cfg.accessLock = cfg.accessLock || {};
                cfg.accessLock.relayUrl = window.__SDP_E2E_RELAY__;
                cfg.accessLock.on = true;
                cfg.accessLock.mode = 'approval';
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
      await page.waitForFunction(() => !!document.getElementById('sdpAccessLock'), null, { timeout: 15000 });
      /* the overlay polls access_state (4 s) → mode approval → code path hidden */
      await page.waitForTimeout(5200);
      const modePaint = await page.evaluate(() => ({
        mode: (window.SDP.AccessLock.unlockMode ? SDP.AccessLock.unlockMode() : 'no_export'),
        codePathHidden: (() => { const n = document.getElementById('sdpAccessCodePath'); return n ? n.hasAttribute('hidden') : 'missing'; })()
      }));
      check('E4a approval-only mode reaches the client', modePaint.mode === 'approval', JSON.stringify(modePaint));
      check('E4b the code/password path is hidden in approval-only mode (server enforces too)',
        modePaint.codePathHidden === true, JSON.stringify(modePaint));
      check('E4c the approval-only boot threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
      /* back to approval+code for E7 */
      relayRt.context.doPost({ postData: { contents: JSON.stringify({ action: 'set_lock_config', pin: '78987898', on: true, mode: 'approval+code' }) } });
    }

    /* ── E7: two-way /lock and /unlock from Telegram ── */
    {
      const cmd = (text) => new Promise((resolve) => {
        const payload = JSON.stringify({ message: { message_id: 9, chat: { id: 987654321 }, from: { id: 987654321 }, text } });
        const req = http.request('http://127.0.0.1:' + relay.address().port + '/exec?action=tg_callback&secret_token=tgwhs_test_secret', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }, (res) => {
          let b = '';
          res.on('data', (c) => { b += c; });
          res.on('end', () => resolve(b));
        });
        req.end(payload);
      });
      /* /unlock — a student boot then passes the gate open */
      await cmd('/unlock');
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await ctx.addInitScript((relayUrl) => {
        window.__SDP_NO_LIVE__ = true;
        window.__SDP_E2E_RELAY__ = relayUrl;
        const origFetch = window.fetch.bind(window);
        window.fetch = function (url, opts) {
          const u = String(url);
          if (u.indexOf('data/config.json') >= 0 && u.indexOf('127.0.0.1') < 0) {
            return origFetch(u, opts).then(function (res) {
              return res.clone().json().then(function (cfg) {
                cfg.accessLock = cfg.accessLock || {};
                cfg.accessLock.relayUrl = window.__SDP_E2E_RELAY__;
                cfg.accessLock.on = false;
                cfg.accessLock.mode = 'approval+code';
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
      await page.waitForTimeout(2600);
      const open = await page.evaluate(() => ({ lock: !!document.getElementById('sdpAccessLock'), home: !!document.getElementById('screen-home') }));
      check('E7a /unlock (Telegram) opens the app — the student boots straight in', open.lock === false && open.home === true, JSON.stringify(open));
      check('E7b the /unlock boot threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
      /* /lock — a fresh student boot must now stop at the Entry Lock */
      await cmd('/lock');
      const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await ctx2.addInitScript((relayUrl) => {
        window.__SDP_NO_LIVE__ = true;
        window.__SDP_E2E_RELAY__ = relayUrl;
        const origFetch = window.fetch.bind(window);
        window.fetch = function (url, opts) {
          const u = String(url);
          if (u.indexOf('data/config.json') >= 0 && u.indexOf('127.0.0.1') < 0) {
            return origFetch(u, opts).then(function (res) {
              return res.clone().json().then(function (cfg) {
                cfg.accessLock = cfg.accessLock || {};
                cfg.accessLock.relayUrl = window.__SDP_E2E_RELAY__;
                cfg.accessLock.on = true;
                cfg.accessLock.mode = 'approval+code';
                return new Response(JSON.stringify(cfg), { status: 200, headers: { 'Content-Type': 'application/json' } });
              }, function () { return res; });
            });
          }
          return origFetch(url, opts);
        };
      }, RELAY_URL);
      await ctx2.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('http://127.0.0.1') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      const page2 = await ctx2.newPage();
      await page2.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page2.waitForTimeout(2600);
      const locked = await page2.evaluate(() => !!document.getElementById('sdpAccessLock'));
      check('E7c /lock (Telegram) arms the Entry Lock — a fresh student boot stops at the gate', locked === true, 'overlay=' + locked);
      await ctx2.close();
    }

    /* ── E1: the Studio panel reads #studioGasUrl live (BUG-F1 core) ──
       jsdom app-harness: unlock the studio, then prove the pasted
       #studioGasUrl value alone (never vault-saved) drives the lock relay. */
    {
      const { createApp } = require('./app-harness.cjs');
      const sentRelay = [];
      const app = await createApp({
        before(w) {
          w.localStorage.setItem('sdp.guide_seen', '0.0.7.h');
          w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.h', gasUrl: 'https://script.google.com/macros/s/OLD/exec' }));
        }
      });
      /* record every relay post the studio makes */
      const orig = app.w.SDP.Data.postRelay;
      app.w.SDP.Data.postRelay = function (url, body, cb) {
        sentRelay.push({ url: String(url), body: JSON.parse(body) });
        global.setTimeout(function () { cb(null, { ok: true, lock: { on: true, mode: 'approval+code', hasPassword: false, hasPin: false, graceHours: 72 } }); }, 5);
      };
      await app.settle(3);
      app.byId('btnStudioQuick').click();
      await app.settle(6);
      await new Promise((resolve) => app.SDP.Studio.setup('78987898', { ghToken: 'ghp_x', elevenKey: 'sk_x', gasUrl: 'https://script.google.com/macros/s/OLD/exec' }, () => resolve()));
      await app.settle(8);
      const drawer = app.byId('studioAdvancedDrawer');
      if (drawer) drawer.open = true;
      await app.settle(3);
      const card = app.byId('studioCardAccessLock');
      check('E1a the Access Lock panel paints the Unlock Policy selector + both relay test buttons (v0.0.7.g)',
        !!(card && app.byId('studioAlMode') && app.byId('btnAlSaveTestRelay') && app.byId('btnAlTestTelegram')),
        'card=' + !!card + ' mode=' + !!app.byId('studioAlMode') + ' test=' + !!app.byId('btnAlSaveTestRelay') + ' tg=' + !!app.byId('btnAlTestTelegram'));
      /* the BUG-F1 core: paste a NEW relay URL into #studioGasUrl — the live
         DOM value (never vault-saved, secrets still say the OLD url) must
         drive the very next gasLockRelay post. */
      const fld = app.byId('studioGasUrl');
      check('E1b the #studioGasUrl field exists and accepts the pasted relay URL',
        !!fld && (fld.value = RELAY_URL, fld.dispatchEvent(new app.w.Event('input', { bubbles: true })), true), 'field missing');
      await new Promise((resolve) => global.setTimeout(resolve, 150));
      sentRelay.length = 0;
      const applyBtn = app.byId('btnAlApplyMaster');
      if (applyBtn) applyBtn.click();
      await new Promise((resolve) => global.setTimeout(resolve, 300));
      await app.settle(4);
      check('E1c the BUG-F1 priority chain: the LIVE #studioGasUrl.value drives the relay post (not the stale saved secret)',
        sentRelay.length >= 1 && sentRelay[0].url === RELAY_URL,
        JSON.stringify(sentRelay.map((r) => r.url)));
      /* the quiet auto-save persists the pasted URL into sdp.settings.gasUrl */
      const saved = JSON.parse(app.w.localStorage.getItem('sdp.settings') || '{}');
      check('E1d the pasted relay URL auto-saves into sdp.settings.gasUrl on input (survives reload, no vault save needed)',
        String(saved.gasUrl || '') === RELAY_URL, 'gasUrl=' + String(saved.gasUrl || '').slice(0, 50));
      /* the Save & Test button runs the full ping → access_state → tg_test chain */
      sentRelay.length = 0;
      const testBtn = app.byId('btnAlSaveTestRelay');
      if (testBtn) testBtn.click();
      await new Promise((resolve) => global.setTimeout(resolve, 300));
      await app.settle(4);
      const actions = sentRelay.map((r) => r.body.action);
      check('E1e the Save & Test Relay + Telegram button fires ping → access_state → tg_test at the LIVE relay URL',
        sentRelay.length >= 3 && actions.indexOf('ping') >= 0 && actions.indexOf('access_state') >= 0 && actions.indexOf('tg_test') >= 0 &&
        sentRelay.every((r) => r.url === RELAY_URL),
        JSON.stringify(actions));
      app.w.SDP.Data.postRelay = orig;
      await app.close();
    }

  } finally {
    await browser.close().catch(() => {});
    relay.close();
  }

  const fails = results.filter((r) => r.status === 'FAIL').length;
  console.log('\nG27 v007f-lock-relay-e2e.cjs — ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL');
  console.log(JSON.stringify(results.filter((r) => r.status === 'FAIL'), null, 2));
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('G27 v007f-lock-relay-e2e.cjs crashed:', e);
  process.exit(1);
});
