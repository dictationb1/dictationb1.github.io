#!/usr/bin/env node
'use strict';
/* G6 — real Chromium upgrade journey: a v60 device becomes a 0.0.1.a device.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 service worker policy
 * contract: docs/ARCHITECTURE_MAP.md §2 boot version check (single reload guard)
 * Preserved caches must survive; retired caches must not. Exactly one reload. */
const path = require('node:path');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const STALE = 'sdp-v60-9.0.0.4';
const SHELL = 'sdp-v0.0.1.a-shell';
const YOUDAO = 'sdp-youdao-v1';
const CLIPS = 'sdp-audio-clips';

const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}

async function launch() {
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => ![
    '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'
  ].includes(a));
  return chromium.launch({ headless: true, executablePath, args });
}

(async function main() {
  const server = await start({ root: ROOT });
  const browser = await launch();
  try {
    /* ── 1. seed a stale v60 cache next to the two preserved caches ────── */
    // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 preserved caches
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => { window.__SDP_NO_LIVE__ = true; });
    const page = await context.newPage();
    await page.goto(server.origin + '/data.html', { waitUntil: 'domcontentloaded' });
    const seeded = await page.evaluate(async (names) => {
      const stale = await caches.open(names.stale);
      await stale.put('/retired-wallpaper.mp4', new Response('stale-bytes'));
      const youdao = await caches.open(names.youdao);
      await youdao.put('https://dict.youdao.com/dictvoice?type=1&audio=afraid', new Response('mp3-bytes'));
      const clips = await caches.open(names.clips);
      await clips.put('/assets/audio/session-w1-1.mp3', new Response('clip-bytes'));
      return (await caches.keys()).sort();
    }, { stale: STALE, youdao: YOUDAO, clips: CLIPS });
    check('G6.1a a stale v60 cache and both preserved caches are seeded',
      seeded.indexOf(STALE) >= 0 && seeded.indexOf(YOUDAO) >= 0 && seeded.indexOf(CLIPS) >= 0, seeded.join(','));
    check('G6.1b the 0.0.1.a shell cache does not exist yet', seeded.indexOf(SHELL) < 0, seeded.join(','));

    /* ── 2 + 3. activating the new worker purges the retired cache ─────── */
    // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 activate handler
    const activated = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
      await caches.delete('sdp-v0.0.1.a-shell');
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await new Promise((resolve) => {
        if (reg.active) return resolve();
        const worker = reg.installing || reg.waiting;
        if (!worker) return resolve();
        worker.addEventListener('statechange', () => { if (worker.state === 'activated') resolve(); });
        setTimeout(resolve, 12000);
      });
      await navigator.serviceWorker.ready;
      await new Promise((r) => setTimeout(r, 1200));
      const names = (await caches.keys()).sort();
      const shell = await caches.open('sdp-v0.0.1.a-shell');
      const shellNames = (await shell.keys()).map((req) => new URL(req.url).pathname);
      return { names, shellNames, controller: !!navigator.serviceWorker.controller };
    }, null);

    check('G6.3a the retired sdp-v60 cache is deleted', activated.names.indexOf(STALE) < 0, activated.names.join(','));
    check('G6.3b the preserved dictionary-audio cache survives', activated.names.indexOf(YOUDAO) >= 0, activated.names.join(','));
    check('G6.3c the preserved lecturer-clip cache survives', activated.names.indexOf(CLIPS) >= 0, activated.names.join(','));
    check('G6.2a the 0.0.1.a shell cache exists after install', activated.names.indexOf(SHELL) >= 0, activated.names.join(','));
    check('G6.2b the shell precaches index.html, the CSS and all six modules',
      ['/index.html', '/assets/css/sdp-ui.css', '/data/sdp-data-sync.js', '/data/sdp-audio-speech.js',
        '/data/sdp-dictation-engine.js', '/data/sdp-ui-views.js', '/data/studio.js', '/data/data-meter.js',
        '/data/version.json', '/data/config.json', '/data/session.json',
        '/assets/fonts/NotoSansSinhala-Regular.woff2', '/assets/fonts/NotoSansSinhala-Bold.woff2',
        '/manifest.webmanifest', '/data.html', '/data/index.html']
        .every((p) => activated.shellNames.indexOf(p) >= 0),
      activated.shellNames.join(','));
    const preservedY = await page.evaluate(async (name) => {
      const cache = await caches.open(name);
      return (await cache.keys()).length;
    }, YOUDAO);
    check('G6.3d the preserved entry itself is still readable', preservedY === 1, preservedY);
    await context.close();

    /* ── 4. the boot version check reloads exactly once ────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §2 sessionStorage reload guard
    server.setOverride('/data/version.json', JSON.stringify({
      ver: 1, appVersion: '0.0.1.b', version: '0.0.1.b', buildDate: '2026-11-02',
      schema: 1, settingsRev: 1, session: '8',
      title: 'Session 8 - Personal Feelings, Opinions & Experiences (Adj)',
      updatedAt: '2026-11-02T00:00:00Z', syncRev: 1762000000001
    }, null, 1));
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(() => {
        try {
          const navs = Number(sessionStorage.getItem('__sdp_navs') || 0) + 1;
          sessionStorage.setItem('__sdp_navs', String(navs));
        } catch (e) {}
      });
      await ctx.addInitScript(() => { window.__SDP_NO_LIVE__ = true; });
      const p = await ctx.newPage();
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await p.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(3500);
      const state = await p.evaluate(() => ({
        navs: Number(sessionStorage.getItem('__sdp_navs') || 0),
        upgradedTo: sessionStorage.getItem('sdp_upgraded_to'),
        target: window.__SDP_BOOT_VERSION__,
        homeActive: !!document.querySelector('#screen-home.active'),
        caches: null
      }));
      check('G6.4a a published build mismatch records sdp_upgraded_to', state.upgradedTo === '0.0.1.b', state.upgradedTo);
      check('G6.4b the boot target is still 0.0.1.a', state.target === '0.0.1.a', state.target);
      check('G6.4c the guard limits the upgrade to exactly ONE reload', state.navs === 2, state.navs);
      check('G6.4d the page is usable after the reload', state.homeActive === true);
      await ctx.close();
    }
    server.clearOverride('/data/version.json');

    /* ── 5. offline reload still renders Home from the shell cache ─────── */
    // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 network-first fallback
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(() => { window.__SDP_NO_LIVE__ = true; });
      const p = await ctx.newPage();
      await p.goto(server.origin + '/index.html', { waitUntil: 'load' });
      await p.waitForTimeout(2500);
      const controlled = await p.evaluate(async () => {
        try {
          await navigator.serviceWorker.ready;
          return !!navigator.serviceWorker.controller;
        } catch (e) { return false; }
      });
      check('G6.5a the service worker controls the page', controlled === true, controlled);
      await ctx.setOffline(true);
      await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await p.waitForTimeout(2500);
      const offline = await p.evaluate(() => ({
        active: document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : '',
        title: document.getElementById('homeTitle') ? document.getElementById('homeTitle').textContent : '',
        hasHeader: !!document.getElementById('appHeader'),
        toast: document.getElementById('sdpDataToast') ? document.getElementById('sdpDataToast').textContent : ''
      }));
      check('G6.5b an offline reload still renders #screen-home', offline.active === 'screen-home', JSON.stringify(offline));
      check('G6.5c the offline shell keeps the header and the title', offline.hasHeader && /Smart Dictation|Dictation/i.test(offline.title), JSON.stringify(offline));
      await ctx.setOffline(false);
      await ctx.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const fails = results.filter((r) => r.status === 'FAIL');
  console.log(JSON.stringify(results, null, 2));
  console.log('\nG6 upgrade-browser.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  if (fails.length) process.exitCode = 1;
})().catch((err) => {
  console.error('G6 harness crashed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
