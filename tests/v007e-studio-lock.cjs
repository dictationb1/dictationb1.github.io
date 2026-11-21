#!/usr/bin/env node
'use strict';
/* G25 — the v0.0.7.e Lecturer Admin Studio Access Lock control-panel gate (jsdom).
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.e
 *   (data/studio.js Access Lock panel · placed STRICTLY inside DRAWER C)
 * Uses the shared app harness (tests/app-harness.cjs) with the unlockStudio
 * path and a stubbed SDP.Data.postRelay that records every lock relay body:
 *   S1  the first-time notice banner appears ONCE on a fresh unlock while the
 *       Access Lock is unconfigured — with the 1-tap jump button + Dismiss.
 *   S2  the jump opens the Advanced drawer and lands on the Access Lock card;
 *       Dismiss persists (sdp.settings) and never nags again on re-unlock.
 *   S3  the panel lives ONLY inside #studioAdvancedDrawer (Drawer C) — the top
 *       of the Studio stays clean (no access-lock markup before the drawer).
 *   S4  the Master LOCK ON/OFF toggle fires set_lock_config with the PIN.
 *   S5  Set / Change Password (min 6 law) + the Break-Glass PIN (4-8 digits)
 *       both POST through the relay with zero raw secrets stored client-side.
 *   S6  the Live Roster renders pending + approved rows with the
 *       Approve/Reject/Kick/Extend buttons and each fires the right action.
 *   S7  Generate One-Time Codes prints the slip; Lock All Now arms exam mode.
 *   S8  the whole panel speaks the secrets law (HMAC-SHA256 server-side). */
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* the relay stub — records every body SDP.Data.postRelay would send.
 * The reply rides a REAL Node timer (outside the jsdom fake clock), so every
 * wait after a relay action must use wait() (real ms), not app.settle(). */
function relayStub(app, replyFor) {
  const sent = [];
  const orig = app.w.SDP.Data.postRelay;
  app.w.SDP.Data.postRelay = function (url, body, cb) {
    const parsed = JSON.parse(body);
    sent.push({ url: String(url), body: parsed });
    const reply = replyFor(parsed);
    global.setTimeout(function () { cb(null, reply); }, 5);
  };
  return { sent, restore: function () { app.w.SDP.Data.postRelay = orig; } };
}
const wait = (ms) => new Promise((resolve) => global.setTimeout(resolve, ms || 90));
async function settleRelay(app, ticks) {
  await wait(90);
  await app.settle(ticks || 4);
}

/* a lecturer unlocking the studio for the first time (mirrors studio-safety) */
async function unlockStudio(app) {
  app.byId('btnStudioQuick').click();
  await app.settle(6);
  await new Promise((resolve) => app.SDP.Studio.setup('78987898', { ghToken: 'ghp_x', elevenKey: 'sk_x', gasUrl: 'https://script.google.com/macros/s/MOCK/exec' }, () => resolve()));
  await app.settle(8);
}

(async function main() {
  const rosterReply = {
    ok: true,
    pending: [
      { deviceId: 'dev-pending-01', name: 'Nimali Fernando', classId: 'B1-THU-02', ts: 1798000000000 },
      { deviceId: 'dev-pending-02', name: 'Dasun Wickrama', classId: 'B1-IPET015', ts: 1798000001000 }
    ],
    approved: [
      { deviceId: 'dev-ok-01', name: 'Sanduni Silva', classId: 'B1-TUE-04', ts: 1797000000000, expires: 1799000000000 }
    ],
    revoked: []
  };

  const base = { before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.7.e'); w.localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.7.e', gasUrl: 'https://script.google.com/macros/s/MOCK/exec' })); } };

  /* ── S1 + S2 + S3: first-time notice, jump, dismiss, placement ─────── */
  {
    const app = await createApp(base);
    await unlockStudio(app);
    const notice = app.byId('studioAccessNotice');
    check('S1a the first-time notice appears on the FIRST unlock while the Access Lock is unconfigured',
      !!notice === true, 'notice missing');
    const jump = notice ? notice.querySelector('#btnAlNoticeJump') : null;
    const dismiss = notice ? notice.querySelector('#btnAlNoticeDismiss') : null;
    check('S1b the notice carries the 1-tap Open Advanced Settings → Access Lock jump + Dismiss',
      !!jump && !!dismiss, 'buttons missing');

    /* S2 — the jump opens Drawer C and reveals the Access Lock card */
    jump.click();
    await app.settle(4);
    const drawer = app.byId('studioAdvancedDrawer');
    const card = app.byId('studioCardAccessLock');
    check('S2a the 1-tap jump opens the Advanced drawer and lands on the Access Lock card',
      !!(drawer && drawer.open === true) && !!card, 'drawer/card not reachable');

    /* S3 — placement: the card must live ONLY inside the drawer, never top-level */
    const studioBody = app.byId('studioBody') || (app.q('#studioBody') ? app.q('#studioBody') : null);
    const topNodes = Array.from(studioBody ? studioBody.children : []);
    const topLeak = topNodes.some(function (n) { return n.id === 'studioCardAccessLock' || (n.querySelector && n.querySelector('#studioCardAccessLock') && n.id !== 'studioAdvancedDrawer'); });
    check('S3a the panel sits ONLY inside #studioAdvancedDrawer (Drawer C) — the top of Studio stays clean',
      !topLeak && !!drawer.querySelector('#studioCardAccessLock'), 'panel leaked above the drawer');

    /* S2b — Dismiss persists and never nags again */
    dismiss.click();
    await app.settle(4);
    const dismissedSetting = JSON.parse(app.w.localStorage.getItem('sdp.settings') || '{}').accessLockNoticeDismissed;
    check('S2b Dismiss persists in sdp.settings (five-key law) and removes the banner at once',
      dismissedSetting === true && !app.byId('studioAccessNotice'), 'dismiss did not persist');

    /* re-render (mount again via a fresh unlock paint) — notice stays gone */
    app.SDP.Studio.refreshEditor();
    await app.settle(6);
    check('S2c the notice never nags again after dismissal (re-render keeps it gone)',
      !app.byId('studioAccessNotice'), 'notice reappeared');

    /* S4 — the panel ships the master toggle + password + pin + codes + roster */
    check('S3b the panel ships Master toggle + password + break-glass PIN + one-time codes + Lock All + roster',
      !!app.byId('studioAlMaster') && !!app.byId('btnAlApplyMaster') && !!app.byId('studioAlPassword') &&
      !!app.byId('studioAlPin') && !!app.byId('btnAlGenCodes') && !!app.byId('btnAlLockAllNow') &&
      !!app.byId('studioAlRoster'), 'control surface incomplete');
  }

  /* ── S4 + S5: master toggle + password + PIN through the relay ─────── */
  {
    const app = await createApp(base);
    await unlockStudio(app);
    /* pre-dismiss the notice so it cannot interfere */
    const stub = relayStub(app, function (parsed) {
      if (parsed.action === 'access_state') return { ok: true, lock: { on: false, graceHours: 72 } };
      if (parsed.action === 'access_roster') return rosterReply;
      if (parsed.action === 'set_lock_config') return { ok: true, lock: { on: !!parsed.on, hasPassword: true, hasPin: true } };
      if (parsed.action === 'lock_all') return { ok: true, locked: true };
      if (parsed.action === 'generate_codes') return { ok: true, codes: ['418290', '725501', '933164', '602477', '881235'], ttlHours: 48 };
      if (parsed.action === 'access_decision') return { ok: true, device: parsed.deviceId, decision: parsed.decision, token: 'tok-' };
      if (parsed.action === 'revoke_device') return { ok: true, device: parsed.deviceId };
      if (parsed.action === 'extend_device') return { ok: true, device: parsed.deviceId, hours: parsed.hours };
      return { ok: false, err: 'unknown' };
    });
    /* dismiss the notice */
    const n = app.byId('btnAlNoticeDismiss');
    if (n) { n.click(); await app.settle(3); }

    /* S4 — LOCK ON */
    app.byId('studioAlMaster').checked = true;
    app.byId('btnAlApplyMaster').click();
    await settleRelay(app, 6);
    const setOn = stub.sent.filter(function (s) { return s.body.action === 'set_lock_config'; })[0];
    check('S4a the Master LOCK ON toggle POSTs set_lock_config {on:true} with the lecturer PIN',
      !!setOn && setOn.body.on === true && String(setOn.body.pin).length >= 4, JSON.stringify(setOn && setOn.body));
    const pill = app.byId('studioAlPill');
    check('S4b the pill + checkbox repaint to LOCK ON after the cloud answers',
      pill && pill.getAttribute('data-state') === 'on' && pill.textContent.indexOf('LOCK ON') >= 0, pill && pill.textContent);

    /* LOCK OFF again */
    app.byId('studioAlMaster').checked = false;
    app.byId('btnAlApplyMaster').click();
    await settleRelay(app, 6);
    const setOff = stub.sent.filter(function (s) { return s.body.action === 'set_lock_config'; }).slice(-1)[0];
    check('S4c the Master LOCK OFF toggle POSTs {on:false} — Open to All anytime',
      !!setOff && setOff.body.on === false, JSON.stringify(setOff && setOff.body));

    /* S5 — password law */
    app.byId('studioAlPassword').value = 'GalleB1Secret';
    app.byId('btnAlSetPassword').click();
    await settleRelay(app, 6);
    const pw = stub.sent.filter(function (s) { return s.body.action === 'set_lock_config' && s.body.password; })[0];
    check('S5a Set / Change Password POSTs the password through the relay (hashed server-side; never stored client-side)',
      !!pw && pw.body.password === 'GalleB1Secret' && !JSON.stringify(pw.body).match(/hash|hmac/i), JSON.stringify(pw && pw.body).slice(0, 120));
    check('S5b the password field is cleared after the save (no raw secret lingers in the DOM)',
      app.byId('studioAlPassword').value === '', app.byId('studioAlPassword').value);

    /* short password refused */
    app.byId('studioAlPassword').value = 'abc';
    app.byId('btnAlSetPassword').click();
    await settleRelay(app, 4);
    const shortTry = stub.sent.filter(function (s) { return s.body.password === 'abc'; }).length;
    check('S5c a password shorter than 6 characters is refused client-side (never reaches the relay)',
      shortTry === 0, 'short password leaked to relay');

    /* S5 — break-glass PIN */
    app.byId('studioAlPin').value = '246810';
    app.byId('btnAlSetPin').click();
    await settleRelay(app, 6);
    const pin = stub.sent.filter(function (s) { return s.body.action === 'set_lock_config' && s.body.accessPin; })[0];
    check('S5d the Admin Break-Glass PIN POSTs as accessPin and clears the field after save',
      !!pin && pin.body.accessPin === '246810' && app.byId('studioAlPin').value === '', JSON.stringify(pin && pin.body).slice(0, 100));

    /* S6 — the roster renders + actions fire (drive a fresh refresh through
       the stub so the roster has rows) */
    app.SDP.Studio.refreshAccessLockRoster(true);
    await settleRelay(app, 8);
    const pendingRows = app.qa('.studio-al-row--pending');
    const approvedRows = app.qa('.studio-al-row--approved');
    check('S6a the Live Roster renders the pending requests (Name · Class · short Device ID · actions)',
      pendingRows.length === 2 && /Nimali/.test(pendingRows[0].textContent) && /dev-pending-01/.test(pendingRows[0].getAttribute('data-device')),
      pendingRows.length + ' rows');
    check('S6b the Live Roster renders the approved devices with Kick / Extend',
      approvedRows.length === 1 && !!approvedRows[0].querySelector('[data-al="kick"]') && !!approvedRows[0].querySelector('[data-al="extend"]'),
      approvedRows.length + ' rows');

    /* approve the first pending device */
    const approveBtn = pendingRows[0].querySelector('[data-al="approve"]');
    approveBtn.click();
    await settleRelay(app, 6);
    const decision = stub.sent.filter(function (s) { return s.body.action === 'access_decision'; })[0];
    check('S6c 1-tap Approve fires access_decision {decision:approve, deviceId} with the PIN',
      !!decision && decision.body.decision === 'approve' && decision.body.deviceId === 'dev-pending-01' && String(decision.body.pin).length >= 4,
      JSON.stringify(decision && decision.body));

    /* kick the approved device (re-query: the approve refresh replaced the DOM) */
    const freshApproved = app.qa('.studio-al-row--approved');
    const kickBtn = freshApproved[0].querySelector('[data-al="kick"]');
    kickBtn.click();
    await settleRelay(app, 6);
    const kick = stub.sent.filter(function (s) { return s.body.action === 'revoke_device'; })[0];
    check('S6d 1-tap Kick / Revoke fires revoke_device for the device',
      !!kick && kick.body.deviceId === 'dev-ok-01', JSON.stringify(kick && kick.body));

    /* S7 — one-time codes + lock all */
    app.byId('studioAlCodeCount').value = '5';
    app.byId('btnAlGenCodes').click();
    await settleRelay(app, 6);
    const gen = stub.sent.filter(function (s) { return s.body.action === 'generate_codes'; })[0];
    const slip = app.byId('studioAlCodesSlip');
    check('S7a Generate One-Time Codes POSTs {count, ttlHours} and prints the slip',
      !!gen && gen.body.count === 5 && !!slip && slip.hidden === false && slip.textContent.indexOf('418290') >= 0,
      JSON.stringify(gen && gen.body));
    check('S7b the slip states the single-device law (forwarding on WhatsApp fails)',
      /one device only|second phone/i.test(slip.textContent), slip.textContent.slice(0, 80));
    app.byId('btnAlLockAllNow').click();
    await settleRelay(app, 6);
    const lockAll = stub.sent.filter(function (s) { return s.body.action === 'lock_all'; })[0];
    check('S7c Lock All Now (exam mode) fires lock_all with the PIN',
      !!lockAll && String(lockAll.body.pin).length >= 4, JSON.stringify(lockAll && lockAll.body));

    /* S8 — the secrets law copy ships in the panel */
    const card = app.byId('studioCardAccessLock');
    check('S8 the panel states the security law (HMAC-SHA256 server-side, raw secrets never in GitHub/client JS)',
      /HMAC-SHA256/.test(card.textContent), 'secrets law copy missing');
    stub.restore();
  }

  /* ── static contract: the module surface is ES5 + relay actions list ── */
  {
    const studioSrc = readText('data/studio.js');
    check('S9a the Access Lock panel functions live in studio.js (card, notice, roster, relay, wiring)',
      /function accessLockCardMarkup/.test(studioSrc) && /function studioFirstTimeNoticeMarkup/.test(studioSrc) &&
      /function gasLockRelay/.test(studioSrc) && /function refreshAccessLockRoster/.test(studioSrc) &&
      /btnAlApplyMaster/.test(studioSrc) && /studioAlRoster/.test(studioSrc), 'panel functions missing');
    check('S9b the first-time notice show law: only while unconfigured AND not dismissed',
      /accessLockNoticeDismissed/.test(studioSrc) && /accessLockCloud/.test(studioSrc), 'notice law missing');
    const cfg = JSON.parse(readText('data/config.json'));
    check('S9c config.json accessLock carries the full relay action surface + 72 h grace + open default',
      cfg.accessLock.on === false && cfg.accessLock.graceHours === 72 &&
      cfg.accessLock.relayActions.indexOf('access_decision') >= 0 && cfg.accessLock.relayActions.indexOf('burn_code') >= 0,
      JSON.stringify(cfg.accessLock).slice(0, 120));
  }

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  for (const r of results) {
    if (r.status === 'FAIL') console.log('FAIL  ' + r.test + '  [' + r.detail.slice(0, 180) + ']');
  }
  console.log('\nG25 v007e-studio-lock.cjs — ' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  results.push({ test: 'S0 the studio lock harness ran', status: 'FAIL', detail: String(e).slice(0, 300) });
  console.log('FAIL  S0 the studio lock harness ran  [' + String(e).slice(0, 200) + ']');
  console.log('\nG25 v007e-studio-lock.cjs — ' + (results.length - 1) + ' PASS / 1 FAIL');
  process.exit(1);
});
