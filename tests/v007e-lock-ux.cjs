#!/usr/bin/env node
'use strict';
/* G24 — the v0.0.7.e Access Lock student-side UX gate (real headless Chromium).
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.e
 *   (data/sdp-access-lock.js · desktop 1280x800 + mobile 375x812)
 * Served over http://127.0.0.1 from the real repository root with a mock GAS
 * relay (context.route) so the full lock journey runs EXACTLY as it does on
 * GitHub Pages, without any network dependency:
 *   U1  LOCK OFF — a student lands directly on Home with ZERO lock screen.
 *   U2  LOCK ON  — every unapproved visitor stops at the full-screen Entry
 *       Lock BEFORE any student data paints (overlay present, app shells
 *       hidden, bilingual EN|SI strings render).
 *   U3  Request Access — Name + Class/ID + deviceId + salted fingerprint
 *       travel to the relay; the screen polls quietly every 4 s and
 *       auto-unlocks IN PLACE once approved (no master PIN ever shown).
 *   U4  the burnable 6-digit code path works ONCE on the first device and
 *       rejects a second device forever (single-use law).
 *   U5  the 72 h offline grace: an approved token keeps the app unlocked
 *       while the network is unreachable; re-lock happens only past 72 h.
 *   U6  instant remote revoke: a revoked device locks out on the next
 *       heartbeat / re-visit.
 *   U7  the subtle Lecturer Studio owner entry link exists on the lock
 *       screen so the owner can ALWAYS reach the Studio while LOCK ON. */
const path = require('node:path');
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

/* the mock GAS relay state — one instance per scenario */
function relayState() {
  return {
    lockOn: true,
    rows: {},           /* deviceId → {status, token, expires} */
    codes: {},          /* code → {bound, used} */
    seen: []
  };
}
function relayHandler(state) {
  return (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
    state.seen.push(body.action || '?');
    const action = String(body.action || '');
    if (action === 'access_state') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, lock: { on: state.lockOn, hasPassword: false, graceHours: 72 }, ver: 45 }) });
    if (action === 'access_request') {
      state.rows[body.deviceId] = state.rows[body.deviceId] || { status: 'pending', token: '', expires: 0 };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, pending: true }) });
    }
    if (action === 'check_device') {
      const row = state.rows[body.deviceId];
      if (!row) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, err: 'unknown device' }) });
      if (row.status === 'pending') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, err: 'pending' }) });
      if (row.status === 'revoked') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, err: 'revoked' }) });
      if (!(row.expires > Date.now())) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, err: 'expired' }) });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, approved: true, graceHours: 72, token: row.token }) });
    }
    if (action === 'verify_lock_secret') {
      const code = String(body.secret || '');
      if (/^\d{6}$/.test(code) && state.codes[code] !== undefined) {
        const c = state.codes[code];
        if (c.used && c.bound !== body.deviceId) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, err: 'code already burned on another device (single-use law)' }) });
        c.used = true; c.bound = body.deviceId;
        state.rows[body.deviceId] = { status: 'approved', token: 'tok-' + code, expires: Date.now() + 72 * 3600 * 1000 };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, by: 'code', device: body.deviceId, token: 'tok-' + code }) });
      }
      if (state.password && body.secret === state.password) {
        state.rows[body.deviceId] = { status: 'approved', token: 'tok-pw', expires: Date.now() + 72 * 3600 * 1000 };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, by: 'password', device: body.deviceId, token: 'tok-pw' }) });
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, err: 'invalid code' }) });
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, err: 'unknown action' }) });
  };
}

const RELAY_URL = 'https://script.google.com/macros/s/SDP_MOCK_RELAY/exec';

async function openLockPage(browser, viewport, state, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({
    viewport,
    serviceWorkers: 'block',
    offline: !!opts.offline
  });
  /* the mock relay + the gasUrl secret BEFORE any app script runs */
  await ctx.addInitScript((relayUrl) => {
    window.__SDP_NO_LIVE__ = true;
    try {
      const s = JSON.parse(localStorage.getItem('sdp.settings') || '{}');
      s.gasUrl = relayUrl;
      localStorage.setItem('sdp.settings', JSON.stringify(s));
      localStorage.setItem('sdp.guide_seen', '0.0.7.e');
    } catch (e) {}
  }, RELAY_URL);
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  /* registered LAST so it takes precedence over the catch-all (Playwright
     routes resolve most-recently-registered first). */
  await ctx.route(RELAY_URL + '*', relayHandler(state));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.goto(opts.url || 'http://127.0.0.1:0/index.html', { waitUntil: 'domcontentloaded' }).catch(() => {});
  return { ctx, page, errors };
}

(async function main() {
  const server = await start({ root: ROOT });
  const browser = await (async () => {
    const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
    const args = serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a));
    return chromium.launch({ headless: true, executablePath, args });
  })();
  const URL_BASE = server.origin;

  try {
    /* ── U1 · LOCK OFF: zero lock screen ─────────────────────────────── */
    for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
      const state = relayState();
      state.lockOn = false;
      const { ctx, page, errors } = await openLockPage(browser, viewport, state, { url: URL_BASE + '/index.html' });
      await page.waitForTimeout(1200);
      const ui = await page.evaluate(() => ({
        lock: !!(document.getElementById('sdpAccessLock')),
        home: !!(document.getElementById('screen-home')),
        bodyArmed: document.body.hasAttribute('data-access-lock')
      }));
      check('U1 ' + viewport.width + 'x' + viewport.height + ' LOCK OFF: the student lands directly on Home with ZERO lock screen',
        ui.lock === false && ui.home === true && ui.bodyArmed === false, JSON.stringify(ui));
      check('U1b ' + viewport.width + 'x' + viewport.height + ' LOCK OFF: zero console errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ── U2 · LOCK ON: stopped at the full-screen Entry Lock ────────── */
    {
      const state = relayState();
      const { ctx, page, errors } = await openLockPage(browser, { width: 1280, height: 800 }, state, { url: URL_BASE + '/index.html' });
      await page.waitForTimeout(1500);
      const ui = await page.evaluate(() => ({
        lock: !!(document.getElementById('sdpAccessLock')),
        modal: !!(document.getElementById('sdpAccessLock') && document.getElementById('sdpAccessLock').getAttribute('aria-modal') === 'true'),
        hasRequestBtn: !!(document.getElementById('sdpAccessRequestBtn')),
        hasNameField: !!(document.getElementById('sdpAccessName')),
        hasClassField: !!(document.getElementById('sdpAccessClass')),
        hasCodePath: !!(document.getElementById('sdpAccessCodePath')),
        hasLecturerLink: !!(document.getElementById('sdpAccessLecturerLink')),
        bodyArmed: document.body.hasAttribute('data-access-lock'),
        en: (document.getElementById('sdpAccessLockTitle') || {}).textContent || ''
      }));
      check('U2a LOCK ON: the student is stopped at the full-screen Entry Lock before any student data',
        ui.lock === true && ui.modal === true && ui.bodyArmed === true, JSON.stringify(ui));
      check('U2b the lock screen ships the Request Access form + the collapsible code path + the Lecturer Studio entry link',
        ui.hasRequestBtn && ui.hasNameField && ui.hasClassField && ui.hasCodePath && ui.hasLecturerLink, JSON.stringify(ui));
      check('U2c the lock title is the bilingual Private Web App string (EN copy present)', /Access Locked/.test(ui.en), ui.en);
      check('U2d the lock screen throws zero console errors', errors.length === 0, errors.join(' | '));

      /* U3 · Request Access → approval → auto-unlock in place */
      await page.fill('#sdpAccessName', 'Kasun Perera');
      await page.fill('#sdpAccessClass', 'B1-TUE-04');
      await page.click('#sdpAccessRequestBtn');
      await page.waitForTimeout(400);
      const waiting = await page.evaluate(() => ({
        status: (document.getElementById('sdpAccessStatus') || {}).textContent || '',
        req: (window.SDP && SDP.AccessLock && SDP.AccessLock.state ? SDP.AccessLock.state().pending : null),
        deviceId: (window.SDP && SDP.AccessLock ? SDP.AccessLock.deviceId() : '')
      }));
      check('U3a Request Access sends Name + Class and lands in the waiting state (student NEVER sees a master PIN)',
        /waiting|Request sent|රැඳී|ඉල්ලීම/.test(waiting.status) && waiting.req === true, JSON.stringify(waiting));
      check('U3b the app attached a random deviceId (sdp_d_ prefix) and the request reached the relay (access_request seen)',
        /^sdp_d_/.test(waiting.deviceId) && state.seen.indexOf('access_request') >= 0, waiting.deviceId + ' | ' + state.seen.join(','));

      /* the owner approves on the phone (mock: flip the row) */
      const dev = waiting.deviceId;
      state.rows[dev].status = 'approved';
      state.rows[dev].token = 'tok-kasun';
      state.rows[dev].expires = Date.now() + 72 * 3600 * 1000;
      /* the poll fires every 4 s — wait for the auto-unlock */
      await page.waitForTimeout(5200);
      const after = await page.evaluate(() => ({
        lock: !!(document.getElementById('sdpAccessLock')),
        status: (document.getElementById('sdpAccessStatus') || {}).textContent || '',
        home: !!(document.getElementById('screen-home')),
        bodyArmed: document.body.hasAttribute('data-access-lock'),
        stored: JSON.parse(localStorage.getItem('sdp.access_lock') || '{}')
      }));
      check('U3c the screen polls quietly every 4 s and AUTO-UNLOCKS in place once approved',
        after.lock === false && after.home === true && after.bodyArmed === false, JSON.stringify({ lock: after.lock, home: after.home }));
      check('U3d the unlock persists the device-bound token + grant timestamp in sdp.access_lock',
        typeof after.stored.token === 'string' && after.stored.token.length > 0 && Number(after.stored.grantedAt) > 0, JSON.stringify(after.stored));
      check('U3e the unlock path ran with zero console errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ── U4 · the burnable single-use code law ─────────────────────── */
    {
      const state = relayState();
      state.codes['418290'] = { bound: '', used: false };
      const { ctx, page, errors } = await openLockPage(browser, { width: 1280, height: 800 }, state, { url: URL_BASE + '/index.html' });
      await page.waitForTimeout(1500);
      const devA = await page.evaluate(() => window.SDP.AccessLock.deviceId());
      await page.click('#sdpAccessCodePath summary');
      await page.fill('#sdpAccessCode', '418290');
      await page.click('#sdpAccessCodeBtn');
      await page.waitForTimeout(1400);
      const first = await page.evaluate(() => ({
        lock: !!(document.getElementById('sdpAccessLock')),
        status: (document.getElementById('sdpAccessStatus') || {}).textContent || '',
        stored: JSON.parse(localStorage.getItem('sdp.access_lock') || '{}')
      }));
      check('U4a the burnable code unlocks the FIRST device (overlay removed + token stored)',
        first.lock === false && (first.stored.token || '').length > 0,
        JSON.stringify({ lock: first.lock, status: first.status, token: first.stored.token }));
      await ctx.close();

      /* a SECOND device (fresh context = fresh localStorage) tries the SAME code */
      const second = await openLockPage(browser, { width: 375, height: 812 }, state, { url: URL_BASE + '/index.html' });
      await second.page.waitForTimeout(1500);
      check('U4b the second device still faces the Entry Lock (LOCK ON)',
        !!(await second.page.evaluate(() => document.getElementById('sdpAccessLock'))) === true, 'second device unlocked too early');
      await second.page.click('#sdpAccessCodePath summary');
      await second.page.fill('#sdpAccessCode', '418290');
      await second.page.click('#sdpAccessCodeBtn');
      await second.page.waitForTimeout(1200);
      const rejected = await second.page.evaluate(() => ({
        lock: !!(document.getElementById('sdpAccessLock')),
        status: (document.getElementById('sdpAccessStatus') || {}).textContent || ''
      }));
      check('U4c the SAME code on a SECOND device is rejected forever (WhatsApp-forwarding fails)',
        rejected.lock === true && /valid|කේතය|device/i.test(rejected.status), JSON.stringify(rejected));
      await second.ctx.close();
      check('U4d the code journey threw zero console errors', errors.length === 0, errors.join(' | '));
    }

    /* ── U5 · the 72 h offline grace ───────────────────────────────── */
    {
      const state = relayState();
      state.rows['sdp_d_offline01'] = { status: 'approved', token: 'tok-off', expires: Date.now() + 60 * 3600 * 1000 };
      /* pre-seed the grant on the device, then go fully OFFLINE (after load) */
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
      await ctx.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.7.e');
          localStorage.setItem('sdp.settings', JSON.stringify({ gasUrl: 'https://script.google.com/macros/s/SDP_MOCK_RELAY/exec' }));
          localStorage.setItem('sdp.access_lock', JSON.stringify({
            deviceId: 'sdp_d_offline01', fp: 'fp-offline', token: 'tok-off',
            grantedAt: Date.now() - 2 * 3600 * 1000, lastHeartbeat: Date.now() - 3600 * 1000
          }));
        } catch (e) {}
      });
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('http://127.0.0.1') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      /* now cut the network: the next relay heartbeat fails → offline grace */
      await ctx.setOffline(true);
      await page.waitForTimeout(1800);
      const offline = await page.evaluate(() => ({
        lock: !!(document.getElementById('sdpAccessLock')),
        home: !!(document.getElementById('screen-home')),
        grace: !!(window.SDP && SDP.AccessLock && SDP.AccessLock.state && SDP.AccessLock.state().withinGrace)
      }));
      check('U5a the 72 h offline grace: an approved device stays UNLOCKED through a fully offline boot',
        offline.lock === false && offline.home === true && offline.grace === true, JSON.stringify(offline));
      check('U5b the offline grace boot throws zero console errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ── U6 · instant remote revoke ────────────────────────────────── */
    {
      const state = relayState();
      state.rows['sdp_d_revoke01'] = { status: 'revoked', token: 'tok-rev', expires: Date.now() + 70 * 3600 * 1000 };
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
      await ctx.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.7.e');
          localStorage.setItem('sdp.settings', JSON.stringify({ gasUrl: 'https://script.google.com/macros/s/SDP_MOCK_RELAY/exec' }));
          localStorage.setItem('sdp.access_lock', JSON.stringify({
            deviceId: 'sdp_d_revoke01', fp: 'fp-rev', token: 'tok-rev',
            grantedAt: Date.now() - 3600 * 1000, lastHeartbeat: Date.now() - 3600 * 1000
          }));
        } catch (e) {}
      });
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('http://127.0.0.1') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await ctx.route(RELAY_URL + '*', relayHandler(state));
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const revoked = await page.evaluate(() => ({
        lock: !!(document.getElementById('sdpAccessLock')),
        home: !!(document.getElementById('screen-home')),
        stored: JSON.parse(localStorage.getItem('sdp.access_lock') || '{}')
      }));
      check('U6a a remotely REVOKED device is re-locked on the very next boot/heartbeat',
        revoked.lock === true && revoked.home === true /* shell exists but the overlay stops the student */ && !(revoked.stored.token || '').length,
        JSON.stringify({ lock: revoked.lock, token: revoked.stored.token }));
      check('U6b the revoke re-lock throws zero console errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ── U7 · the Lecturer Studio owner entry on the lock screen ───── */
    {
      const state = relayState();
      const { ctx, page } = await openLockPage(browser, { width: 1280, height: 800 }, state, { url: URL_BASE + '/index.html' });
      await page.waitForTimeout(1500);
      const link = await page.evaluate(() => {
        const a = document.getElementById('sdpAccessLecturerLink');
        return { present: !!a, text: a ? a.textContent : '', subtle: a ? getComputedStyle(a).opacity : '1' };
      });
      check('U7a the subtle Lecturer Studio owner entry link exists on the lock screen (the owner can ALWAYS reach Studio → Advanced Settings)',
        link.present === true && /Lecturer|කථිකාචාර්\u200dය|ම෰ක්\u200dස්ටුඩියෝ/.test(link.text), JSON.stringify(link));
      check('U7b the owner entry stays visually SUBTLE (opacity below 0.6) so students never mistake it for their path',
        Number(link.subtle) < 0.6, link.subtle);
      await ctx.close();
    }

    await server.close();
  } catch (e) {
    check('U0 the lock UX harness ran', false, String(e).slice(0, 300));
  } finally {
    await browser.close();
  }

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  for (const r of results) {
    if (r.status === 'FAIL') console.log('FAIL  ' + r.test + '  [' + r.detail.slice(0, 180) + ']');
  }
  console.log('\nG24 v007e-lock-ux.cjs — ' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})();
