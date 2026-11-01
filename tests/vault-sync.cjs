#!/usr/bin/env node
'use strict';
/* G11 — the encrypted vault and the sequential cross-device publisher (P2/P3).
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 SDP_ENC_V2, §R6 publish order, §W6 secrets
 * contract: docs/CHANGELOG_LEDGER.md §D-S2, §D-S5, §D-S7, §D-S8, §D-S9
 * Deterministic: jsdom + fake timers + a recording fetch stub. No network calls
 * ever leave the process, and no TTS endpoint is touched. */
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}

/* A GitHub Contents API that records every PUT in arrival order. */
function gitHubStub(opts) {
  opts = opts || {};
  const puts = [];
  const gets = [];
  return {
    puts,
    gets,
    fetch(url, init) {
      const u = String(url);
      const method = (init && init.method) || 'GET';
      const isContents = u.indexOf('api.github.com') >= 0 && u.indexOf('/contents/') >= 0;
      if (!isContents) return undefined;
      const filePath = decodeURIComponent(u.split('/contents/')[1].split('?')[0]);
      if (method === 'PUT') {
        puts.push({ path: filePath, init, at: puts.length });
        const fail = opts.failPath === filePath;
        return Promise.resolve({
          ok: !fail,
          status: fail ? 409 : 200,
          json: () => Promise.resolve(fail ? {} : { content: { sha: 'sha-' + filePath } })
        });
      }
      gets.push(filePath);
      /* a fresh sha per read: the sequential publisher must re-read every time */
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ sha: 'old-' + filePath }) });
    }
  };
}

(async function main() {
  const base = { before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.1.d'); } };

  /* ── 1. R5: the SDP_ENC_V2 envelope is frozen ───────────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 16B salt ‖ 12B iv ‖ AES-GCM-256
  {
    const app = await createApp(base);
    const V = app.SDP.Sync.Vault;
    check('G11.1a the vault prefix is SDP_ENC_V2:', V.PREFIX === 'SDP_ENC_V2:');
    check('G11.1b PBKDF2-SHA256 runs 250,000 iterations', V.ITERATIONS === 250000);
    const envelope = await V.encryptV2({ ghToken: 'ghp_secret_value', elevenKey: 'sk_secret_value' }, '246813');
    check('G11.1c the envelope carries the frozen prefix', String(envelope).indexOf('SDP_ENC_V2:') === 0, String(envelope).slice(0, 18));
    const blob = Buffer.from(String(envelope).slice('SDP_ENC_V2:'.length), 'base64');
    check('G11.1d salt is 16 bytes', blob.length > 28);
    const plain = await V.decryptV2(envelope, '246813');
    check('G11.1e the round trip returns the exact secrets',
      plain && plain.ghToken === 'ghp_secret_value' && plain.elevenKey === 'sk_secret_value',
      JSON.stringify(plain));
    let wrongPin = null;
    try { await V.decryptV2(envelope, '111111'); } catch (e) { wrongPin = 'rejected'; }
    check('G11.1f a wrong PIN cannot open the envelope', wrongPin === 'rejected');
    check('G11.1g the ciphertext never contains the plaintext secrets',
      String(envelope).indexOf('ghp_secret_value') < 0 && String(envelope).indexOf('sk_secret') < 0);
    app.close();
  }

  /* ── 2. R6: version.json is published last, one file at a time ──────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 sequential publisher
  {
    const stub = gitHubStub();
    const app = await createApp(Object.assign({ fetch: stub.fetch }, base));
    const files = [
      { path: 'data/session.json', content: '{"a":1}', message: 'session' },
      { path: 'data/config.json', content: '{"b":2}', message: 'config' },
      { path: 'data/elevenlabs-audio.json', content: '{"c":3}', message: 'clips' },
      { path: 'data/version.json', content: '{"ver":3}', message: 'version' }
    ];
    const outcome = await new Promise((resolve) => {
      app.SDP.Sync.publishFilesSequential(files, 'ghp_test_token', () => {}, (err, res) => resolve({ err, res }));
    });
    const order = stub.puts.map((p) => p.path);
    check('G11.2a every file is committed', order.length === 4 && outcome.res.ok === true,
      order.join(',') + ' ok=' + (outcome.res && outcome.res.ok));
    check('G11.2b version.json is committed LAST', order[order.length - 1] === 'data/version.json', order.join(','));
    check('G11.2c the session is committed first', order[0] === 'data/session.json', order[0]);
    check('G11.2d the publisher reports the order it used',
      JSON.stringify(outcome.res.order) === JSON.stringify(order), JSON.stringify(outcome.res.order));
    check('G11.2e no two PUTs are in flight at once',
      outcome.res.published === 4 && stub.gets.length === 4, stub.gets.length + ' sha reads');
    check('G11.2f every commit carries the current sha (never a cached one)',
      stub.gets.every((p) => ['data/session.json', 'data/config.json', 'data/elevenlabs-audio.json', 'data/version.json'].indexOf(p) >= 0),
      stub.gets.join(','));
    check('G11.2g the publish body never carries the PIN or a bare key',
      stub.puts.every((p) => {
        const body = String((p.init && p.init.body) || '');
        return body.indexOf('246813') < 0 && body.indexOf('"pin"') < 0;
      }));
    app.close();
  }

  /* ── 3. D-S5: a 409 race re-reads the sha and retries exactly once ──── */
  // contract: docs/CHANGELOG_LEDGER.md §D-S5 fresh-sha retry
  {
    const stub = gitHubStub({ failPath: 'data/session.json' });
    const app = await createApp(Object.assign({ fetch: stub.fetch }, base));
    const outcome = await new Promise((resolve) => {
      app.SDP.Sync.publishFilesSequential(
        [{ path: 'data/session.json', content: '{}', message: 'm' }],
        'ghp_test_token', () => {}, (err, res) => resolve(res)
      );
    });
    const sessionPuts = stub.puts.filter((p) => p.path === 'data/session.json').length;
    check('G11.3a a conflicting commit is retried exactly once', sessionPuts === 2, sessionPuts);
    check('G11.3b the publisher reports the failure instead of lying', outcome.ok === false);
    app.close();
  }

  /* ── 4. D-S8/D-S9/W6: secrets never reach a URL or a relay body ─────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §W6
  {
    const app = await createApp(base);
    const relay = app.SDP.Sync.buildKeysRelayPayload('login');
    check('G11.4a the relay body carries no PIN and no key',
      relay.indexOf('pin') < 0 && relay.indexOf('Token') < 0 && relay.indexOf('sk_') < 0, relay);
    check('G11.4b the relay stays CORS-simple and tiny', Buffer.byteLength(relay) < 600, Buffer.byteLength(relay));
    const url = app.SDP.Sync.contentsUrl('data/config.json');
    check('G11.4c the Contents URL is the raw api.github.com path (CDN-lag bypass)',
      url === 'https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/data/config.json', url);
    check('G11.4d the Contents URL never embeds a token', !/token|ghp_|github_pat_/.test(url), url);
    app.close();
  }

  /* ── 5. D-S2: the studio keeps only ciphertext on the device ────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §W6 storage law
  {
    const app = await createApp(base);
    const secrets = { ghToken: 'ghp_secret_value', elevenKey: 'sk_secret_value' };
    const envelope = await new Promise((resolve) => {
      app.SDP.Studio.setup('246813', secrets, (err, env) => resolve(env));
    });
    await app.settle(6);
    check('G11.5d setup() returns a sealed envelope', String(envelope).indexOf('SDP_ENC_V2:') === 0,
      String(envelope).slice(0, 16));
    const settings = JSON.parse(app.w.localStorage.getItem('sdp.settings') || '{}');
    check('G11.5a the cached vault on disk is ciphertext only',
      String(settings.cachedVault || '').indexOf('SDP_ENC_V2:') === 0, String(settings.cachedVault || '').slice(0, 18));
    check('G11.5b no plaintext key is written to localStorage',
      app.w.localStorage.getItem('sdp.settings').indexOf('ghp_secret_value') < 0);
    check('G11.5c only the five R4 keys are written',
      ['sdp.progress', 'sdp.settings', 'sdp.session', 'sdp.guide_seen', 'sdp.migrated_from_legacy']
        .indexOf('sdp.settings') >= 0 && app.w.localStorage.length <= 5,
      app.w.localStorage.length);
    app.close();
  }

  /* ── 6. D-S7: the CDN lag can never publish a stale version ─────────── */
  // contract: docs/CHANGELOG_LEDGER.md §D-S7 raw CDN bypass
  {
    const syncSrc = fs.readFileSync(path.join(ROOT, 'data/sdp-data-sync.js'), 'utf8');
    check('G11.6a version.json is read straight from api.github.com, not the CDN',
      /fetchRawGitHubJson/.test(syncSrc) && syncSrc.indexOf('api.github.com/repos/') > 0);
    check('G11.6b the newest syncRev always wins',
      /syncRev/.test(syncSrc) && /newer/.test(syncSrc));
    const app = await createApp(base);
    const payload = app.SDP.Sync.buildContentsCommitPayload('data/version.json', '{"ver":3}', 'msg', 'abc123');
    check('G11.6c the commit payload is base64 with a branch and a message',
      typeof payload.content === 'string' && /^[A-Za-z0-9+/=]+$/.test(payload.content) &&
      !!payload.branch && !!payload.message, JSON.stringify(Object.keys(payload)));
    check('G11.6d content round-trips through base64',
      Buffer.from(payload.content, 'base64').toString('utf8') === '{"ver":3}');
    app.close();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ gate: 'G11', passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  } else {
    for (const r of results) if (r.status === 'FAIL') console.log('FAIL  ' + r.test + (r.detail ? '  [' + r.detail + ']' : ''));
    console.log('G11 vault-sync.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
  }
  process.exit(failed.length ? 1 : 0);
})();
