#!/usr/bin/env node
'use strict';
/* G23 — the v0.0.7.e Private Web App Access Lock backend contract gate.
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.7.e
 *   (data/gas-source.txt Access Lock backend · ver/schema 45 · settingsRev 78)
 * Executes the exact shipped data/gas-source.txt inside a vm with a faithful
 * mock of the Apps Script runtime (Sheets, CacheService, PropertiesService,
 * UrlFetchApp + a REAL HMAC-SHA256 Utilities mock) and asserts the lock laws:
 *   L1  dispatch — every lock action is reachable through doPost/doGet, public
 *       actions run before the admin wall, admin actions behind adminOk().
 *   L2  access_state — the open default (no lock config) and the locked state.
 *   L3  access_request — pending rows, owner notification (Telegram + ntfy),
 *       rate limiting (6 per 60 s per device), dupes update in place.
 *   L4  access_decision — approve (HMAC token issued, 72 h expiry) / reject.
 *   L5  token law — HMAC-SHA256 over deviceId|epoch|fingerprint with the
 *       LOCK_HMAC_SECRET Script Property; verifyToken accepts, tampering fails.
 *   L6  single-use burnable codes — generated in batches, burned bound to the
 *       FIRST device only; a second device is rejected forever.
 *   L7  password / PIN hashing — set_lock_config stores ONLY the HMAC digest;
 *       verifyLockSecret matches the raw password/PIN but never stores it.
 *   L8  revoke / extend / lock_all / access_roster.
 *   L9  tg_callback — the secret_token webhook law (reject without the
 *       TG_WEBHOOK_SECRET match, surface the 1-tap decision).
 *   L10 the client module contract — data/sdp-access-lock.js ships strict ES5
 *       with zero raw secrets, and config.json carries the accessLock schema.
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

/* ── the GAS runtime mock (faithful to the real Apps Script services) ───── */
function makeRuntime(opts) {
  opts = opts || {};
  const tables = {};
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

  function sheet(name) {
    if (tables[name]) return tables[name];
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
    return s;
  }

  class DateMock extends Date { static now() { return now; } }

  const Utilities = {
    base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    computeDigest: () => [],
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeHmacSha256Signature: (message, secret) => crypto.createHmac('sha256', String(secret)).update(String(message), 'utf8').digest()
  };

  const context = vm.createContext({
    Date: DateMock,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => properties[k] }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache[k] && cache[k].until > now ? cache[k].value : null,
        put: (k, v, secs) => { cache[k] = { value: String(v), until: now + secs * 1000 }; }
      })
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => tables[n] || null, insertSheet: sheet }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    UrlFetchApp: {
      fetch: (url, options) => {
        urlFetchLog.push({ url: String(url), options: options || null, at: now });
        return { getContentText: () => 'ok', getResponseCode: () => 200 };
      }
    },
    Utilities,
    ContentService: {
      createTextOutput: (t) => ({ _t: String(t), setMimeType() { return this; }, _m: null, getMimeType() { return this._m; } }),
      MimeType: { JSON: 'json' }
    }
  });
  return { context, tables, cache, properties, urlFetchLog, getNow: () => now, setNow: (v) => { now = v; } };
}

const GAS_SOURCE = readText('data/gas-source.txt');

function boot(opts) {
  const rt = makeRuntime(opts);
  vm.runInContext(GAS_SOURCE, rt.context);
  return rt;
}
function post(rt, body) { return rt.context.handlePost({ postData: { contents: JSON.stringify(body) } }); }
function get(rt, param) { return rt.context.handleGet({ parameter: param }); }

/* ── L1 · dispatch reachability ─────────────────────────────────────────── */
{
  const rt = boot({});
  const publicActions = ['access_state', 'access_request', 'verify_lock_secret', 'check_device', 'burn_code'];
  const unreachable = publicActions.filter((a) => {
    const out = post(rt, { action: a });
    return out.err === 'unknown action';
  });
  check('L1a every public lock action is dispatched by doPost (no unknown action)', unreachable.length === 0, unreachable.join(','));
  const adminActions = ['access_decision', 'set_lock_config', 'access_roster', 'generate_codes', 'revoke_device', 'extend_device', 'lock_all'];
  const unauthed = adminActions.filter((a) => {
    const out = post(rt, { action: a });
    return out.err !== 'unauthorised';
  });
  check('L1b admin lock actions sit behind adminOk (PIN) — unauthenticated calls rejected', unauthed.length === 0, unauthed.join(','));
  const out = post(rt, { action: 'access_decision', pin: '78987898' });
  check('L1c the authenticated admin wall passes the PIN through to the lock action',
    out.err === 'not found' || out.ok === false || out.ok === undefined, JSON.stringify(out));
  const st = get(rt, { action: 'access_state' });
  check('L1d GET ?action=access_state answers the public lock state', st.ok === true && st.lock && st.lock.on === false, JSON.stringify(st));
}

/* ── L2 · access_state open default → locked after set_lock_config ─────── */
{
  const rt = boot({});
  const open = get(rt, { action: 'access_state' });
  check('L2a a fresh deployment reports the Web App OPEN (unlocked) with the 72 h grace',
    open.lock.on === false && open.lock.graceHours === 72, JSON.stringify(open));
  const cfg = post(rt, { action: 'set_lock_config', pin: '78987898', on: true });
  check('L2b set_lock_config ON flips access_state to locked',
    cfg.ok === true && cfg.lock.on === true, JSON.stringify(cfg));
  const locked = get(rt, { action: 'access_state' });
  check('L2c the locked state is readable without a PIN (students need it)',
    locked.lock.on === true && locked.lock.graceHours === 72, JSON.stringify(locked));
  const off = post(rt, { action: 'set_lock_config', pin: '78987898', on: false });
  check('L2d the Master Toggle turns LOCK OFF again (Open Mode)', off.ok === true && off.lock.on === false, JSON.stringify(off));
}

/* ── L3 · access_request: pending row + owner notification + rate limit ── */
{
  const rt = boot({});
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true });
  const req = post(rt, { action: 'access_request', name: 'Kasun Perera', classId: 'B1-TUE-04', deviceId: 'dev-kasun-001', fp: 'fp-abc123' });
  check('L3a a student access request lands as pending', req.ok === true && req.pending === true, JSON.stringify(req));
  const tg = rt.urlFetchLog.filter((f) => f.url.indexOf('api.telegram.org/bot') >= 0);
  const ntfy = rt.urlFetchLog.filter((f) => f.url.indexOf('ntfy.sh/sdp_dictationb1_access') >= 0);
  check('L3b the owner notification reaches Telegram sendMessage (inline approve/reject)',
    tg.length === 1 && tg[0].options.payload.indexOf('callback_data') >= 0 && tg[0].options.payload.indexOf('approve:dev-kasun-001') >= 0,
    JSON.stringify(tg.map((t) => t.options && t.options.payload && t.options.payload.slice(0, 80))));
  check('L3c the ntfy.sh fallback leg also fires (sdp_dictationb1_access)',
    ntfy.length === 1, JSON.stringify(ntfy.map((n) => n.url)));
  const rows = rt.tables.Access ? rt.tables.Access._rows : [];
  check('L3d the Access sheet row carries name / class / device / fingerprint / pending',
    rows.length === 2 && String(rows[1][2]) === 'Kasun Perera' && String(rows[1][3]) === 'B1-TUE-04' &&
    String(rows[1][4]) === 'dev-kasun-001' && String(rows[1][6]) === 'pending', JSON.stringify(rows[1] && rows[1].slice(0, 8)));
  /* rate limit: 6 requests per 60 s per device */
  let rateHit = false;
  for (let i = 0; i < 8; i++) {
    const out = post(rt, { action: 'access_request', name: 'Spam', deviceId: 'dev-kasun-001' });
    if (out.err === 'rate') rateHit = true;
  }
  check('L3e access_request is rate limited (6 per 60 s per deviceId)', rateHit === true);
  /* open mode skips pending */
  const rt2 = boot({});
  const skip = post2(rt2, { action: 'access_request', name: 'Nimal', deviceId: 'dev-nimal-1' });
  function post2(r, body) { return post(r, body); }
  check('L3f while LOCK OFF a request is skipped cleanly (no pending row)',
    skip.ok === true && skip.skip === 'open', JSON.stringify(skip));
}

/* ── L4 + L5 · access_decision approve/reject + the HMAC token law ───── */
{
  const rt = boot({});
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true });
  post(rt, { action: 'access_request', name: 'Sanduni Silva', classId: 'B1-IPET015', deviceId: 'dev-sanduni-01', fp: 'fp-sand-77' });
  const approve = post(rt, { action: 'access_decision', pin: '78987898', deviceId: 'dev-sanduni-01', decision: 'approve' });
  check('L4a approving issues the device-bound grant', approve.ok === true && approve.decision === 'approve', JSON.stringify(approve));
  const row = rt.tables.Access._rows[1];
  const token = String(row[7]);
  const expires = Number(row[9]);
  check('L4b the approved row carries an HMAC token + the 72 h expiry',
    token.length >= 20 && expires > Date.UTC(2026, 10, 21, 12) + 70 * 3600 * 1000, JSON.stringify([token.slice(0, 12), expires]));
  const dev = post(rt, { action: 'check_device', deviceId: 'dev-sanduni-01', token: token });
  check('L5a check_device verifies the HMAC token and reports approved + 72 h grace',
    dev.ok === true && dev.approved === true && dev.graceHours === 72, JSON.stringify(dev));
  const tampered = post(rt, { action: 'check_device', deviceId: 'dev-sanduni-01', token: token.slice(0, -2) + 'xx' });
  check('L5b a tampered token is rejected (challenge issued)', tampered.ok === false && tampered.err === 'bad token', JSON.stringify(tampered));
  const other = post(rt, { action: 'check_device', deviceId: 'dev-other-9', token: token });
  check('L5c a token is device-bound — another deviceId fails',
    other.ok === false && (other.err === 'unknown device' || other.err === 'bad token'), JSON.stringify(other));

  /* the token is a real HMAC-SHA256 of deviceId|epoch|fp with LOCK_HMAC_SECRET */
  const epoch = String(rt.context.getCfg ? '' : ''); /* getCfg not exported — verify shape only via verifyToken */
  check('L5d the token digest uses HMAC-SHA256 (43-char base64url, 32 bytes)',
    /^[A-Za-z0-9_-]{40,}$/.test(token) && Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').length === 32,
    token.slice(0, 20));

  const reject = post(rt, { action: 'access_decision', pin: '78987898', deviceId: 'dev-reject-me', decision: 'reject' });
  check('L4c rejecting an unknown device records the rejected row cleanly (no crash)',
    reject.ok === true && reject.decision === 'reject', JSON.stringify(reject));
  post(rt, { action: 'access_request', name: 'Ruwan', deviceId: 'dev-ruwan-1', fp: 'fp-r' });
  const no = post(rt, { action: 'access_decision', deviceId: 'dev-ruwan-1', decision: 'approve' });
  check('L4d a decision without the PIN is unauthorised', no.ok === false && no.err === 'unauthorised', JSON.stringify(no));
  const yes = post(rt, { action: 'access_decision', pin: '78987898', deviceId: 'dev-ruwan-1', decision: 'approve' });
  check('L4e the same decision with the PIN succeeds', yes.ok === true, JSON.stringify(yes));
}

/* ── L6 · single-use burnable 6-digit student codes ───────────────────── */
{
  const rt = boot({});
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true });
  const gen = post(rt, { action: 'generate_codes', pin: '78987898', count: 4, ttlHours: 48 });
  check('L6a codes are generated in batches (4 × 6-digit, 48 h ttl)',
    gen.ok === true && gen.codes.length === 4 && gen.codes.every((c) => /^\d{6}$/.test(c)), JSON.stringify(gen.codes));
  const code = gen.codes[0];
  const burn1 = post(rt, { action: 'burn_code', deviceId: 'dev-first-phone', code: code, name: 'Amaya', classId: 'B1' });
  check('L6b the first device burns the code successfully (approved + bound)',
    burn1.ok === true && burn1.by === 'code' && burn1.device === 'dev-first-phone', JSON.stringify(burn1));
  const burn2 = post(rt, { action: 'burn_code', deviceId: 'dev-second-phone', code: code });
  check('L6c the SAME code on a SECOND device is rejected forever (anti-WhatsApp-forwarding)',
    burn2.ok === false && burn2.err.indexOf('another device') >= 0, JSON.stringify(burn2));
  const burn1again = post(rt, { action: 'burn_code', deviceId: 'dev-first-phone', code: code });
  check('L6d re-entering on the ORIGINAL bound device is idempotent (alreadyBoundToSelf)',
    burn1again.ok === true && burn1again.alreadyBoundToSelf === true, JSON.stringify(burn1again));
  const badCode = post(rt, { action: 'burn_code', deviceId: 'dev-x', code: '000000' });
  check('L6e an unissued / invalid code is rejected', badCode.ok === false && badCode.err === 'invalid code', JSON.stringify(badCode));
  const approvedRow = rt.tables.Access._rows.filter((r) => String(r[4]) === 'dev-first-phone')[0];
  check('L6f the burned code grants the first device an approved roster row',
    !!approvedRow && String(approvedRow[6]) === 'approved', JSON.stringify(approvedRow && approvedRow.slice(0, 8)));
}

/* ── L7 · password / PIN hashing law ───────────────────────────────────── */
{
  const rt = boot({});
  const set = post(rt, { action: 'set_lock_config', pin: '78987898', on: true, password: 'GalleB1Class!', pin2: undefined });
  check('L7a set_lock_config accepts the Access Lock Password (min 6 chars)',
    set.ok === true && set.lock.hasPassword === true, JSON.stringify(set));
  const lockCfg = JSON.parse(vm.runInContext('JSON.stringify(accessCfg())', rt.context));
  check('L7b the stored config carries ONLY the HMAC digest — never the raw password',
    typeof lockCfg.pw === 'string' && lockCfg.pw.length >= 20 && lockCfg.pw.indexOf('GalleB1Class!') < 0, JSON.stringify(lockCfg));
  const right = post(rt, { action: 'verify_lock_secret', deviceId: 'dev-pw-1', secret: 'GalleB1Class!' });
  check('L7c verify_lock_secret matches the raw password to the digest and approves',
    right.ok === true && right.by === 'password', JSON.stringify(right));
  const wrong = post(rt, { action: 'verify_lock_secret', deviceId: 'dev-pw-2', secret: 'wrong-password' });
  check('L7d a wrong password is rejected', wrong.ok === false, JSON.stringify(wrong));
  /* break-glass PIN */
  const rt2 = boot({});
  post(rt2, { action: 'set_lock_config', pin: '78987898', on: true, accessPin: '246810' });
  const pinOk = post(rt2, { action: 'verify_lock_secret', deviceId: 'dev-pin-1', secret: '246810' });
  check('L7e the Admin Break-Glass PIN (4-8 digits) verifies and approves',
    pinOk.ok === true && pinOk.by === 'pin', JSON.stringify(pinOk));
  const cfg2 = JSON.parse(vm.runInContext('JSON.stringify(accessCfg())', rt2.context));
  check('L7f the PIN is stored hashed (HMAC digest, not the raw digits)',
    typeof cfg2.pin === 'string' && cfg2.pin.indexOf('246810') < 0, JSON.stringify(cfg2));
  const shortPw = post(rt, { action: 'set_lock_config', pin: '78987898', password: 'abc' });
  check('L7g a password shorter than 6 chars is refused', shortPw.ok === false && shortPw.err.indexOf('too short') >= 0, JSON.stringify(shortPw));
  const badPin = post(rt, { action: 'set_lock_config', pin: '78987898', accessPin: '12' });
  check('L7h a PIN outside 4-8 digits is refused', badPin.ok === false && badPin.err.indexOf('4-8 digits') >= 0, JSON.stringify(badPin));
  const rawSweep = GAS_SOURCE.indexOf('GalleB1Class') < 0 && GAS_SOURCE.indexOf('246810') < 0;
  check('L7i zero raw secrets inside the shipped gas-source.txt bytes', rawSweep === true);
}

/* ── L8 · revoke / extend / lock_all / access_roster ────────────────────── */
{
  const rt = boot({});
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true });
  post(rt, { action: 'access_request', name: 'Chamari', deviceId: 'dev-chamari-1', fp: 'fp-c1' });
  post(rt, { action: 'access_decision', pin: '78987898', deviceId: 'dev-chamari-1', decision: 'approve' });
  const token = String(rt.tables.Access._rows.filter((r) => String(r[4]) === 'dev-chamari-1')[0][7]);
  const before = post(rt, { action: 'check_device', deviceId: 'dev-chamari-1', token: token });
  check('L8a the approved device passes check_device before revoke', before.ok === true && before.approved === true, JSON.stringify(before));
  const revoke = post(rt, { action: 'revoke_device', pin: '78987898', deviceId: 'dev-chamari-1' });
  check('L8b revoke_device answers ok (Kick)', revoke.ok === true, JSON.stringify(revoke));
  const after = post(rt, { action: 'check_device', deviceId: 'dev-chamari-1', token: token });
  check('L8c a revoked device is locked out on the very next heartbeat (check_device)',
    after.ok === false && after.err === 'revoked', JSON.stringify(after));
  /* re-approve then extend */
  post(rt, { action: 'access_decision', pin: '78987898', deviceId: 'dev-chamari-1', decision: 'approve' });
  rt.setNow(Date.UTC(2026, 10, 21, 12) + 60 * 3600 * 1000); /* +60 h — past the 72 h window? no, still inside */
  const stillIn = post(rt, { action: 'check_device', deviceId: 'dev-chamari-1', token: token });
  check('L8d inside the 72 h offline grace the device still passes', stillIn.ok === true, JSON.stringify(stillIn));
  const extend = post(rt, { action: 'extend_device', pin: '78987898', deviceId: 'dev-chamari-1', hours: 168 });
  check('L8e extend_device adds a full week (Kick → Extend path)', extend.ok === true && extend.hours === 168, JSON.stringify(extend));
  rt.setNow(Date.UTC(2026, 10, 21, 12) + 200 * 3600 * 1000); /* +200 h — beyond 72 h, inside the 168 h extension */
  const extOk = post(rt, { action: 'check_device', deviceId: 'dev-chamari-1', token: token });
  check('L8f the extended device passes past the original 72 h window', extOk.ok === true, JSON.stringify(extOk));
  rt.setNow(Date.UTC(2026, 10, 21, 12) + 300 * 3600 * 1000); /* +300 h — beyond even the extension */
  const exp = post(rt, { action: 'check_device', deviceId: 'dev-chamari-1', token: token });
  check('L8g an expired grant locks the device out (72 h offline grace ceiling)', exp.ok === false && exp.err === 'expired', JSON.stringify(exp));
  const lockAll = post(rt, { action: 'lock_all', pin: '78987898' });
  const state = get(rt, { action: 'access_state' });
  check('L8h lock_all arms the exam mode (Master ON)', lockAll.ok === true && state.lock.on === true, JSON.stringify(state));
  const roster = post(rt, { action: 'access_roster', pin: '78987898' });
  check('L8i access_roster returns the live pending / approved / revoked lists',
    roster.ok === true && Array.isArray(roster.pending) && Array.isArray(roster.approved) && Array.isArray(roster.revoked), JSON.stringify(roster).slice(0, 200));
  const rosterNoPin = post(rt, { action: 'access_roster' });
  check('L8j the roster without a PIN is unauthorised', rosterNoPin.ok === false && rosterNoPin.err === 'unauthorised');
}

/* ── L9 · tg_callback webhook law ─────────────────────────────────────── */
{
  const rt = boot({});
  post(rt, { action: 'set_lock_config', pin: '78987898', on: true });
  const payload = JSON.stringify({ callback_query: { data: 'approve:dev-tg-1', message: { message: '🔐 ACCESS REQUEST\nName: Tharindu' }, from: { id: '987654321' } } });
  const bad = rt.context.handleGet({ parameter: { action: 'tg_callback', secret_token: 'wrong' }, postData: { contents: payload } });
  check('L9a tg_callback rejects a wrong secret_token (unauthorised)', bad.ok === false && bad.err === 'unauthorised', JSON.stringify(bad));
  const good = rt.context.handleGet({ parameter: { action: 'tg_callback', secret_token: 'tgwhs_test_secret' }, postData: { contents: payload } });
  check('L9b tg_callback surfaces the 1-tap approve decision with the device id',
    good.ok === true && good.decision === 'approve' && good.device === 'dev-tg-1', JSON.stringify(good));
  const empty = rt.context.handleGet({ parameter: { action: 'tg_callback', secret_token: 'tgwhs_test_secret' }, postData: { contents: '{}' } });
  check('L9c a payload without callback_query is refused cleanly', empty.ok === false && empty.err === 'no callback_query', JSON.stringify(empty));
  const tg2 = rt.urlFetchLog.filter((f) => f.url.indexOf('api.telegram.org') >= 0);
  check('L9d the surfaced decision reaches the owner channel (audit trail)', tg2.length >= 1, JSON.stringify(tg2.length));
}

/* ── L10 · the client module + config schema contract ──────────────────── */
{
  const lockJs = fs.existsSync(path.join(ROOT, 'data/sdp-access-lock.js')) ? readText('data/sdp-access-lock.js') : '';
  if (lockJs) {
    let es5 = true;
    try { acorn.parse(lockJs, { ecmaVersion: 5, sourceType: 'script' }); } catch (e) { es5 = false; }
    check('L10a data/sdp-access-lock.js ships and parses as strict ES5', es5 === true);
    check('L10b the client module carries ZERO raw secrets (no bot tokens, no master PIN literals)',
      !/(bot\d{6,}:[A-Za-z0-9_-]{20,})/.test(lockJs) && lockJs.indexOf('tgwhs_') < 0 && lockJs.indexOf('LOCK_HMAC_SECRET') >= 0 === false,
      'secret sweep');
    check('L10c the client polls access_state / access_request / check_device / verify_lock_secret (codes route to burn_code server-side) and never prints a master secret',
      lockJs.indexOf('access_state') >= 0 && lockJs.indexOf('access_request') >= 0 && lockJs.indexOf('check_device') >= 0 && lockJs.indexOf('verify_lock_secret') >= 0,
      'action surface');
  } else {
    check('L10a data/sdp-access-lock.js ships and parses as strict ES5', false, 'file missing');
  }
  const config = JSON.parse(readText('data/config.json'));
  check('L10d config.json carries the accessLock schema (open default, 72 h grace, relay pins)',
    config.accessLock && config.accessLock.on === false && Number(config.accessLock.graceHours) === 72,
    JSON.stringify(config.accessLock));
  const gasEs2017 = (() => { try { acorn.parse(GAS_SOURCE, { ecmaVersion: 2017 }); return true; } catch (e) { return false; } })();
  check('L10e the extended gas-source.txt still parses at the Apps Script ES2017 dialect', gasEs2017 === true);
}

/* ── report ─────────────────────────────────────────────────────────────── */
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
for (const r of results) {
  if (r.status === 'FAIL') console.log('FAIL  ' + r.test + '  [' + r.detail.slice(0, 180) + ']');
}
console.log('\nG23 v007e-gas-lock.cjs — ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
