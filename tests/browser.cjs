#!/usr/bin/env node
'use strict';
/* G5 — real Chromium layout, routing and accessibility gate.
 * contract: docs/UI_COMPONENT_GUIDE.md §2 header/navigation, §3 beat ring & toast
 * contract: docs/ARCHITECTURE_MAP.md §R3 single screen, §R4 input law, §R5 ring
 * Served over http://127.0.0.1 so real layout, real focus and real SW-free paint. */
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
const FORBIDDEN = ['bgLiveWrap', 'bgLiveVideo', 'btnLiveVideo', 'liveVideoInput', 'dimTpl', 'dimHostSet',
  'sVideoDim', 'topDataBadge', 'topDataMB', 'topDataLkr', 'btnDataSheet', 'dataSheet', 'guideSheet',
  'btnReadyTest', 'screen-comm', 'tab-comm', 'commBadge', 'btnMsg', 'printview', 'v58Rail',
  'sdpDesktopRail', 'sdpV56', 'materialMixer'];

async function launch() {
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => ![
    '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'
  ].includes(a));
  return chromium.launch({ headless: true, executablePath, args });
}

/* Every page: no live polling, and no host outside the local server. */
async function openPage(browser, origin, viewport, opts) {
  opts = opts || {};
  const context = await browser.newContext({
    viewport,
    serviceWorkers: opts.serviceWorkers || 'block'
  });
  /* operational pages skip the first-visit guide so it cannot intercept a tap;
     the guide itself is exercised by G7. */
  await context.addInitScript((seedGuide) => {
    window.__SDP_NO_LIVE__ = true;
    try { if (seedGuide) localStorage.setItem('sdp.guide_seen', '0.0.1.c'); } catch (e) {}
  }, opts.guide !== true);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  return { context, page, errors };
}

async function bootSettings(page, settings) {
  await page.evaluate((s) => {
    localStorage.setItem('sdp.settings', JSON.stringify(s));
    localStorage.setItem('sdp.guide_seen', '0.0.1.c');
  }, settings);
  await page.reload({ waitUntil: 'domcontentloaded' });
}

(async function main() {
  const server = await start({ root: ROOT });
  const browser = await launch();
  const errorsAll = [];

  try {
    /* ── 1 + 2. header geometry and matte surfaces ────────────────────── */
    // contract: docs/UI_COMPONENT_GUIDE.md §2 — 54px header, first card <= 68px
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
      const { context, page, errors } = await openPage(browser, server.origin, viewport);
      await page.waitForTimeout(700);
      const geo = await page.evaluate(() => {
        const header = document.getElementById('appHeader').getBoundingClientRect();
        const card = document.querySelector('#screen-home .card').getBoundingClientRect();
        const headerStyle = getComputedStyle(document.getElementById('appHeader'));
        const cardStyle = getComputedStyle(document.querySelector('#screen-home .card'));
        return {
          headerHeight: header.height,
          headerTop: header.top,
          cardTop: card.top,
          headerBlur: headerStyle.backdropFilter || headerStyle.webkitBackdropFilter,
          cardBlur: cardStyle.backdropFilter || cardStyle.webkitBackdropFilter,
          headerBg: headerStyle.backgroundColor,
          bodyScrollX: document.documentElement.scrollWidth - window.innerWidth
        };
      });
      const tag = viewport.width + 'x' + viewport.height;
      check('G5.1a [' + tag + '] header is 54px tall (±2px)', Math.abs(geo.headerHeight - 54) <= 2, geo.headerHeight);
      check('G5.1b [' + tag + '] header sits flush at the top (zero gap)', geo.headerTop === 0, geo.headerTop);
      check('G5.1c [' + tag + '] first card starts <= 68px from the viewport top', geo.cardTop <= 68, geo.cardTop);
      check('G5.2a [' + tag + '] header uses no backdrop blur', geo.headerBlur === 'none', geo.headerBlur);
      check('G5.2b [' + tag + '] cards use no backdrop blur', geo.cardBlur === 'none', geo.cardBlur);
      check('G5.1d [' + tag + '] no horizontal page overflow', geo.bodyScrollX <= 0, geo.bodyScrollX);
      const navVisible = await page.evaluate(() => {
        const tabbar = getComputedStyle(document.getElementById('tabbar')).display;
        const rail = getComputedStyle(document.getElementById('sdpSideRail')).display;
        const railWidth = document.getElementById('sdpSideRail').getBoundingClientRect().width;
        return { tabbar, rail, railWidth };
      });
      if (viewport.width < 1024) {
        check('G5.2c [' + tag + '] mobile shows the bottom tab bar only', navVisible.tabbar !== 'none' && navVisible.rail === 'none', JSON.stringify(navVisible));
      } else {
        check('G5.2d [' + tag + '] desktop shows the 232px rail only', navVisible.rail === 'flex' && navVisible.tabbar === 'none' && Math.abs(navVisible.railWidth - 232) <= 1, JSON.stringify(navVisible));
      }
      check('G5.2e [' + tag + '] no page errors on boot', errors.length === 0, errors.join(' | '));
      errorsAll.push(...errors);
      await context.close();
    }

    /* ── 3 + 4. routing and the words explorer ────────────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R3 exactly one .screen is active
    {
      const { context, page, errors } = await openPage(browser, server.origin, { width: 390, height: 844 });
      await page.waitForTimeout(600);
      const tabs = ['home', 'player', 'practice', 'dict', 'settings'];
      for (const name of tabs) {
        await page.click('#tab-' + name);
        await page.waitForTimeout(120);
        const state = await page.evaluate(() => {
          const screens = Array.from(document.querySelectorAll('.screen'));
          const visible = screens.filter((s) => getComputedStyle(s).display !== 'none');
          return {
            visibleIds: visible.map((s) => s.id),
            activeCount: screens.filter((s) => s.classList.contains('active')).length,
            displayOfActive: visible.length ? getComputedStyle(visible[0]).display : 'none'
          };
        });
        check('G5.3 [' + name + '] activates exactly one screen', state.visibleIds.length === 1 && state.visibleIds[0] === 'screen-' + name && state.activeCount === 1 && state.displayOfActive === 'block', JSON.stringify(state));
      }
      await page.click('#tab-dict');
      await page.waitForTimeout(150);
      const cards = await page.evaluate(() => document.querySelectorAll('#dictList .dict-card').length);
      check('G5.4a the Words tab renders all 30 cards immediately', cards === 30, cards);
      const cardFields = await page.evaluate(() => {
        const first = document.querySelector('#dictList .dict-card');
        return {
          ipa: !!first.querySelector('.d-p'),
          pos: !!first.querySelector('.d-pos'),
          english: !!first.querySelector('.d-m'),
          sinhala: !!first.querySelector('.word-si'),
          sentence: !!first.querySelector('.d-s'),
          play: !!first.querySelector('[data-play]')
        };
      });
      check('G5.4b each card shows IPA, POS, English, Sinhala, sentence and Play', Object.values(cardFields).every(Boolean), JSON.stringify(cardFields));
      const search = await page.evaluate(async () => {
        const input = document.getElementById('dictSearch');
        input.value = 'charm';
        input.dispatchEvent(new Event('input'));
        await new Promise((r) => setTimeout(r, 60));
        return document.querySelectorAll('#dictList .dict-card').length;
      });
      check('G5.4c search narrows the list instantly', search === 1, search);
      check('G5.3b no page errors while routing', errors.length === 0, errors.join(' | '));
      errorsAll.push(...errors);
      await context.close();
    }

    /* ── 5. focus and input law ───────────────────────────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R4 focus & input law
    {
      const { context, page } = await openPage(browser, server.origin, { width: 390, height: 844 });
      await bootSettings(page, { mode: 'paper', writeSecs: 8, repeats: 1, pauseSecs: 1, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark' });
      await page.waitForTimeout(500);
      await page.click('#btnStart');
      await page.waitForTimeout(500);
      const paper = await page.evaluate(() => ({
        inputs: document.querySelectorAll('#typeInput').length,
        stageHasInput: !!document.querySelector('#beatStage input')
      }));
      check('G5.5a paper mode renders no #typeInput anywhere', paper.inputs === 0 && !paper.stageHasInput, JSON.stringify(paper));

      await page.click('#btnModeSwitch');
      await page.waitForTimeout(300);
      const typing = await page.evaluate(() => {
        const input = document.getElementById('typeInput');
        return {
          exists: !!input,
          inStage: !!document.querySelector('#beatStage #typeInput'),
          autocomplete: input && input.getAttribute('autocomplete'),
          autocapitalize: input && input.getAttribute('autocapitalize'),
          spellcheck: input && input.getAttribute('spellcheck')
        };
      });
      check('G5.5b typing mode mounts #typeInput inside #beatStage', typing.exists && typing.inStage, JSON.stringify(typing));
      check('G5.5c #typeInput disables autocomplete/autocapitalise/spellcheck',
        typing.autocomplete === 'off' && typing.autocapitalize === 'off' && typing.spellcheck === 'false', JSON.stringify(typing));
      const scroll = await page.evaluate(() => {
        window.scrollTo(0, 0);
        const stage = document.getElementById('beatStage');
        stage.scrollIntoView({ block: 'center' });
        const before = window.scrollY;
        const input = document.getElementById('typeInput');
        input.focus({ preventScroll: true });
        return { before, after: window.scrollY, focused: document.activeElement === input };
      });
      check('G5.5d focusing the input never yanks the page', scroll.before === scroll.after && scroll.focused,
        JSON.stringify(scroll));
      await page.click('#btnModeSwitch');
      await page.waitForTimeout(200);
      const backToPaper = await page.evaluate(() => document.querySelectorAll('#typeInput').length);
      check('G5.5e switching back to paper removes #typeInput from the DOM', backToPaper === 0, backToPaper);
      await context.close();
    }

    /* ── 6. beat ring colours ─────────────────────────────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R5 ring colours
    {
      const { context, page } = await openPage(browser, server.origin, { width: 390, height: 844 });
      await bootSettings(page, { mode: 'paper', writeSecs: 8, repeats: 1, pauseSecs: 1, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark' });
      await page.waitForTimeout(400);
      await page.click('#btnStart');
      await page.waitForTimeout(300);
      const readRing = () => page.evaluate(() => {
        const ring = document.getElementById('beatRing');
        return {
          stroke: ring.getAttribute('stroke'),
          computed: getComputedStyle(ring).stroke,
          state: document.getElementById('beatStateText').textContent,
          seconds: document.getElementById('beatSeconds').textContent
        };
      });
      const listening = await readRing();
      check('G5.6a listening ring is sky (#38BDF8)', listening.stroke === '#38BDF8' && /Listening/.test(listening.state), JSON.stringify(listening));
      await page.waitForTimeout(3400);
      const writing = await readRing();
      check('G5.6b writing ring is emerald (#10B981)', writing.stroke === '#10B981' && /Write Now/.test(writing.state), JSON.stringify(writing));
      await page.waitForTimeout(5200);
      const warning = await readRing();
      check('G5.6c the last three seconds warn in amber (#F59E0B)', warning.stroke === '#F59E0B', JSON.stringify(warning));
      await context.close();
    }

    /* ── 7. whisper data toast ────────────────────────────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R9 whisper data toast
    {
      const { context, page } = await openPage(browser, server.origin, { width: 390, height: 844 });
      await page.waitForTimeout(700);
      const toast = await page.evaluate(() => {
        const node = document.getElementById('sdpDataToast');
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return {
          text: node.textContent,
          height: box.height,
          maxHeight: style.maxHeight,
          pointerEvents: style.pointerEvents,
          opacity: style.opacity,
          hidden: node.hidden,
          fixed: style.position
        };
      });
      check('G5.7a the toast is present once per load with a KB reading', /KB/.test(toast.text) && toast.hidden === false, JSON.stringify(toast));
      check('G5.7b the toast is at most 26px tall', toast.height <= 26 && toast.maxHeight === '26px', JSON.stringify(toast));
      check('G5.7c the toast never steals a tap (pointer-events: none)', toast.pointerEvents === 'none', toast.pointerEvents);
      check('G5.7d the toast is fixed in place', toast.fixed === 'fixed', toast.fixed);
      await page.waitForTimeout(3000);
      const faded = await page.evaluate(() => {
        const node = document.getElementById('sdpDataToast');
        return { opacity: getComputedStyle(node).opacity, hidden: node.hidden };
      });
      check('G5.7e the toast fades out after ~2.4s', faded.opacity === '0' || faded.hidden === true, JSON.stringify(faded));
      await context.close();
    }

    /* ── 8. no retired ids in the live DOM ────────────────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §3 retired ids and strings
    {
      const { context, page } = await openPage(browser, server.origin, { width: 1280, height: 800 });
      await page.waitForTimeout(600);
      const hits = await page.evaluate((list) => {
        const html = document.documentElement.outerHTML;
        return list.filter((needle) => html.indexOf(needle) >= 0);
      }, FORBIDDEN);
      check('G5.8a zero retired ids or strings in the live DOM', hits.length === 0, hits.join(', '));
      const video = await page.evaluate(() => document.querySelectorAll('video').length);
      check('G5.8b no <video> element or wallpaper survives', video === 0, video);
      await context.close();
    }

    /* ── 9. the /data transparency route renders ──────────────────────── */
    // contract: docs/ARCHITECTURE_MAP.md §R9 /data transparency pair
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await context.addInitScript(() => { window.__SDP_NO_LIVE__ = true; });
      const page = await context.newPage();
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:')) return route.continue();
        return route.abort();
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      for (const route of ['/data.html', '/data/']) {
        await page.goto(server.origin + route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        const info = await page.evaluate(() => ({
          rows: document.querySelectorAll('#byteTable tr').length,
          plans: document.querySelectorAll('#planChips .chip').length,
          storage: document.querySelectorAll('#storageTable tr').length,
          hasTitle: /transparency/i.test(document.body.textContent),
          noVideo: document.querySelectorAll('video').length === 0
        }));
        // contract: docs/ARCHITECTURE_MAP.md §I1 — the storage audit lists all 12 honest localStorage keys
        check('G5.9 [' + route + '] renders byte table, 5 plans and storage audit',
          info.rows >= 4 && info.plans === 5 && info.storage === 12 && info.hasTitle && info.noVideo, JSON.stringify(info));
      }
      const si = await (async () => {
        await page.goto(server.origin + '/data/?lang=si', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);
        return page.evaluate(() => document.documentElement.getAttribute('lang'));
      })();
      check('G5.9c the /data route honours ?lang=si', si === 'si', si);
      check('G5.9d the /data route throws no page errors', errors.length === 0, errors.join(' | '));
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const fails = results.filter((r) => r.status === 'FAIL');
  console.log(JSON.stringify(results, null, 2));
  console.log('\nG5 browser.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  if (fails.length) process.exitCode = 1;
})().catch((err) => {
  console.error('G5 harness crashed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
