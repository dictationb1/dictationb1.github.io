'use strict';
/* Shared jsdom harness for the v0.0.1.a modules.
 * contract: docs/ARCHITECTURE_MAP.md §2 — the six modules load in the fixed R10
 * order and register window.SDP; the harness reproduces exactly that, with fake
 * timers, WebCrypto and a deterministic fetch stub. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const FakeTimers = require('@sinonjs/fake-timers');

const ROOT = path.resolve(__dirname, '..');
/* contract: docs/ARCHITECTURE_MAP.md §2 fixed load order */
const MODULES = [
  'data/data-meter.js',
  'data/sdp-data-sync.js',
  'data/sdp-audio-speech.js',
  'data/sdp-dictation-engine.js',
  'data/sdp-ui-views.js',
  'data/studio.js'
];

function readJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function memStorage() {
  const map = new Map();
  const writes = [];
  return {
    map,
    writes,
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) { writes.push(String(k)); map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
    key(i) { return Array.from(map.keys())[i] || null; },
    get length() { return map.size; }
  };
}

/**
 * createApp({ before, files, fetch, html, noInit })
 *   before(w)  – seed localStorage / globals before any module runs
 *   files      – extra or replacement files served by the fetch stub
 *   noInit     – do not dispatch DOMContentLoaded (call app.boot() yourself)
 */
async function createApp(opts) {
  opts = opts || {};
  const html = opts.html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e && e.message ? e.message : e)));
  vc.on('error', (...args) => errors.push('console.error: ' + args.join(' ')));

  const dom = new JSDOM(html, {
    url: 'https://example.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const w = dom.window;

  const clock = FakeTimers.withGlobal(w).install({
    now: Date.UTC(2026, 10, 1, 9, 0, 0),
    toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame']
  });

  Object.defineProperty(w, 'crypto', { value: require('node:crypto').webcrypto, configurable: true });
  w.scrollTo = () => {};
  w.__SDP_NO_LIVE__ = true;
  if (typeof w.matchMedia !== 'function') w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });

  /* deterministic fetch: serves the real payloads unless the test overrides one */
  const files = Object.assign({
    'data/version.json': fs.readFileSync(path.join(ROOT, 'data/version.json'), 'utf8'),
    'data/config.json': fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'),
    'data/session.json': fs.readFileSync(path.join(ROOT, 'data/session.json'), 'utf8'),
    'data/elevenlabs-audio.json': fs.readFileSync(path.join(ROOT, 'data/elevenlabs-audio.json'), 'utf8')
  }, opts.files || {});
  const calls = [];
  w.fetch = function (url, init) {
    calls.push({ url: String(url), init: init || null });
    if (typeof opts.fetch === 'function') {
      const custom = opts.fetch(String(url), init);
      if (custom !== undefined) return custom;
    }
    const clean = String(url).split('?')[0].replace(/^\.\//, '').replace(/^\//, '');
    const body = files[clean];
    if (body === undefined) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')), text: () => Promise.resolve('') });
    }
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve(JSON.parse(body)),
      text: () => Promise.resolve(body),
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer)
    });
  };

  if (typeof opts.before === 'function') opts.before(w);

  const ctx = dom.getInternalVMContext();
  for (const rel of MODULES) vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });

  const SDP = w.SDP;
  const byId = (id) => w.document.getElementById(id);
  const q = (sel) => w.document.querySelector(sel);
  const qa = (sel) => Array.from(w.document.querySelectorAll(sel));

  async function settle(ticks) {
    for (let i = 0; i < (ticks || 6); i++) {
      await new Promise((resolve) => setImmediate(resolve));
      clock.tick(20);
    }
  }

  if (!opts.noInit) {
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    await settle(opts.settleTicks || 8);
  }

  return {
    w, dom, clock, SDP, byId, q, qa, errors, calls, files,
    html,
    status: () => ({ version: SDP && SDP.version, words: SDP && SDP.Sync ? SDP.Sync.wordCount() : -1 }),
    settle,
    /* step the beat clock forward and let promises drain */
    async advance(ms) {
      const step = 250;
      let left = ms;
      while (left > 0) {
        clock.tick(Math.min(step, left));
        left -= step;
        await new Promise((resolve) => setImmediate(resolve));
      }
    },
    realErrors: () => errors.filter((e) => !/Not implemented: (HTMLMediaElement|window\.scroll|window\.alert)/.test(e)),
    close() { try { SDP.Engine.stop(); } catch (e) {} clock.uninstall(); dom.window.close(); }
  };
}

module.exports = { createApp, readJSON, memStorage, MODULES, ROOT };
