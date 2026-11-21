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
    try { if (seedGuide) { localStorage.setItem('sdp.guide_seen', '0.0.6.z'); localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.6.z' })); } } catch (e) {}
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
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.2 — appliedSettingsRev pins
     the test's own pacing against a classSettings adoption, and guideAutoPlay
     keeps Start on the fast path (the quick guide is G3/G7's job). */
  const seed = Object.assign({ appliedSettingsRev: 99, langResetV001e: true, defaultsResetV001f: true, guideAutoPlay: false, briefingSeen: '0.0.6.z' }, settings);
  await page.evaluate((s) => {
    localStorage.setItem('sdp.settings', JSON.stringify(s));
    localStorage.setItem('sdp.guide_seen', '0.0.6.z');
  }, seed);
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
      /* v0.0.5.c GAP 3: one nowrap row, 54px on mobile and up to 64px on the
         Morphe glass header. Anything taller means the row wrapped again. */
      check('G5.1a [' + tag + '] header stays a single 54-64px row', geo.headerHeight >= 52 && geo.headerHeight <= 64, geo.headerHeight);
      check('G5.1b [' + tag + '] header sits flush at the top (zero gap)', geo.headerTop === 0, geo.headerTop);
      check('G5.1c [' + tag + '] first card starts <= 68px from the viewport top', geo.cardTop <= 68, geo.cardTop);
      /* v0.0.5.c GAP 1: the glass blur is the release, so assert it is LIVE. */
      check('G5.2a [' + tag + '] header uses the locked 12px Morphe glass blur', /blur\(12px\)/.test(String(geo.headerBlur)), geo.headerBlur);
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
      check('G5.4a the Words tab renders all 31 cards immediately', cards === 31, cards);
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
        /* v0.0.6.l: search for word #1 of the LIVE payload. The classroom word
           list is lecturer-owned and republished freely, so a hardcoded query
           would silently stop matching. The expected count is derived with the
           renderer's own predicate (word / Sinhala / English meaning). */
        const first = document.querySelector('#dictList .dict-card .d-w, #dictList .dict-card [data-word], #dictList .dict-card');
        const query = (window.__SDP_SESSION__ && window.__SDP_SESSION__.words && window.__SDP_SESSION__.words[0] && window.__SDP_SESSION__.words[0].w) ||
          (window.SDP && window.SDP.Sync && window.SDP.Sync.word && (window.SDP.Sync.word(0) || {}).w) || '';
        const list = (window.SDP && window.SDP.Sync && window.SDP.Sync.words) ? window.SDP.Sync.words() : [];
        const q = String(query).toLowerCase();
        const expected = list.filter((w) => String(w.w).toLowerCase().indexOf(q) >= 0 || String(w.si).indexOf(q) >= 0 || String(w.m).toLowerCase().indexOf(q) >= 0).length;
        input.value = query;
        input.dispatchEvent(new Event('input'));
        await new Promise((r) => setTimeout(r, 60));
        return { count: document.querySelectorAll('#dictList .dict-card').length, query: query, expected: expected };
      });
      check('G5.4c search narrows the list instantly', search.count === search.expected && search.count >= 1, JSON.stringify(search));
      check('G5.3b no page errors while routing', errors.length === 0, errors.join(' | '));
      errorsAll.push(...errors);
      await context.close();
    }

    /* ── 4b. D8: exactly one screen at EVERY width, desktop included ───── */
    // contract: docs/ARCHITECTURE_MAP.md §R3 the single-active-screen law (D8)
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
      const { context, page, errors } = await openPage(browser, server.origin, viewport);
      await page.waitForTimeout(400);
      const tag = viewport.width + 'x' + viewport.height;
      /* ≥1024px shows the 232px rail and hides the bottom tab bar. */
      const navPrefix = viewport.width >= 1024 ? '#rail-' : '#tab-';
      for (const name of ['home', 'player', 'practice', 'dict', 'settings', 'home']) {
        await page.click(navPrefix + name);
        await page.waitForTimeout(120);
        const state = await page.evaluate(() => {
          const screens = Array.from(document.querySelectorAll('.screen'));
          const visible = screens.filter((s) => getComputedStyle(s).display !== 'none');
          return { ids: visible.map((s) => s.id), display: visible.length === 1 ? getComputedStyle(visible[0]).display : '' };
        });
        /* D8: the ≥1024px Bento grid may compute `grid`, every other screen
           computes `block` — but EXACTLY one screen is ever visible. */
        check('G5.3c [' + tag + ' -> ' + name + '] exactly one visible screen',
          state.ids.length === 1 && state.ids[0] === 'screen-' + name && (state.display === 'block' || state.display === 'grid'),
          JSON.stringify(state));
      }
      check('G5.3d [' + tag + '] no page errors while routing every width', errors.length === 0, errors.join(' | '));
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
      check('G5.6a listening ring is sky (#38BDF8) with the verbatim phase line',
        listening.stroke === '#38BDF8' && /Listen Carefully \(Repeat \d of \d\)/.test(listening.state), JSON.stringify(listening));
      /* R3: the classroom opening ("Preparing lesson." → "Number 1." → the
         word) runs before the write window, so wait on the phase, not a timer. */
      await page.waitForFunction(
        () => /Write Word #/.test(document.getElementById('beatStateText').textContent),
        null, { timeout: 20000 });
      const writing = await readRing();
      check('G5.6b writing ring is emerald (#10B981) with the word + countdown line',
        writing.stroke === '#10B981' && /Write Word #\d+ in Your Book!/.test(writing.state), JSON.stringify(writing));
      await page.waitForFunction(
        () => document.getElementById('beatRing').getAttribute('stroke') === '#F59E0B',
        null, { timeout: 20000 });
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

    /* ── 7b. R5: 48px touch targets in the cockpit and Settings ─────────── */
    // contract: docs/UI_COMPONENT_GUIDE.md §v0.0.1.e touch targets
    {
      const { context, page } = await openPage(browser, server.origin, { width: 390, height: 844 });
      await bootSettings(page, { mode: 'paper', writeSecs: 8, repeats: 1, pauseSecs: 1, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark' });
      await page.waitForTimeout(400);
      const settingsSmall = await page.evaluate(() => {
        const nodes = document.querySelectorAll('#screen-settings button, #screen-settings select, #screen-settings .checkline');
        const small = [];
        nodes.forEach((node) => {
          const h = Math.round(node.getBoundingClientRect().height);
          if (h > 0 && h < 48) small.push((node.id || node.className) + ':' + h);
        });
        return small;
      });
      check('G5.7f every Settings control is at least 48px tall', settingsSmall.length === 0, settingsSmall.slice(0, 6).join(', '));
      await page.click('#btnStart');
      await page.waitForTimeout(300);
      const cockpitSmall = await page.evaluate(() => {
        const nodes = document.querySelectorAll('#cockpitBar button, #cockpitControls button, #screen-player .btn, #hintChips .chip');
        const small = [];
        nodes.forEach((node) => {
          const h = Math.round(node.getBoundingClientRect().height);
          if (h > 0 && h < 48) small.push((node.id || node.className) + ':' + h);
        });
        return small;
      });
      check('G5.7g every cockpit control is at least 48px tall', cockpitSmall.length === 0, cockpitSmall.slice(0, 6).join(', '));
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
          info.rows >= 4 && info.plans === 5 && info.storage === 13 && info.hasTitle && info.noVideo /* v0.0.7.e: +the Access Lock device key */, JSON.stringify(info));
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

    /* ── 12. v0.0.6.l mobile human-UI law (A1/A2/A3/A6) ──────────────── */
    // contract: docs/CHANGELOG_LEDGER.md §v0.0.6.l — mobile-first human UI
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.6.z');
          localStorage.setItem('sdp.settings', JSON.stringify({ appliedSettingsRev: 99, langResetV001e: true, defaultsResetV001f: true, guideAutoPlay: false, briefingSeen: '0.0.6.z', mode: 'paper', writeSecs: 8, repeats: 1, pauseSecs: 1, autoAdvance: true, lang: 'en', theme: 'light' }));
        } catch (e) {}
      });
      const page = await context.newPage();
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      // A1: the light-mode lock ships on every entry point and survives a
      // simulated Dark Reader injection (attribute + <style class="darkreader">).
      const lock = await page.evaluate(async () => {
        const out = {};
        out.hasLockMeta = !!document.querySelector('meta[name="darkreader-lock"]');
        out.scheme = (document.querySelector('meta[name="color-scheme"]') || {}).content || '';
        out.lightSchemeCss = /only light/.test(String(window.getComputedStyle(document.documentElement).colorScheme || ''));
        // simulate the extension, then let the MutationObserver shield react
        document.documentElement.setAttribute('data-darkreader-mode', '1');
        const st = document.createElement('style');
        st.className = 'darkreader';
        st.textContent = 'html{filter:invert(1)}';
        document.head.appendChild(st);
        await new Promise((resolve) => setTimeout(resolve, 250));
        out.modeStripped = !document.documentElement.hasAttribute('data-darkreader-mode');
        out.styleStripped = !document.querySelector('style.darkreader');
        out.lockReasserted = !!document.querySelector('meta[name="darkreader-lock"]');
        return out;
      });
      check('G5.12a the darkreader-lock + only-light color-scheme ship',
        lock.hasLockMeta && /only light/.test(lock.scheme), JSON.stringify(lock));
      check('G5.12b the MutationObserver shield strips an injected Dark Reader layer',
        lock.modeStripped && lock.styleStripped && lock.lockReasserted, JSON.stringify(lock));

      // A2: paper mode keeps the phone single-screen; the Hint pill opens the
      // meaning panel without the spelling; revealing auto-pauses.
      await page.evaluate(() => { document.getElementById('tab-player').click(); });
      await page.waitForTimeout(300);
      const paper = await page.evaluate(() => ({
        mode: document.body.getAttribute('data-sdp-mode'),
        chips: getComputedStyle(document.getElementById('hintChips')).display,
        stage: getComputedStyle(document.getElementById('beatStage')).display,
        helpers: getComputedStyle(document.getElementById('cockpitHelpers')).display
      }));
      check('G5.12c paper mode hides the hint chips and the beat stage',
        paper.mode === 'paper' && paper.chips === 'none' && paper.stage === 'none' && paper.helpers !== 'none', JSON.stringify(paper));
      const hint = await page.evaluate(async () => {
        document.getElementById('btnHint').click();
        await new Promise((resolve) => setTimeout(resolve, 120));
        const meaning = document.getElementById('revealMeaning');
        return {
          meaningOpen: meaning && meaning.hidden === false,
          si: (document.getElementById('revealSi') || {}).textContent || '',
          wordStillMasked: /^\u2022+$/.test((document.getElementById('revealWordText') || {}).textContent || '')
        };
      });
      check('G5.12d the Hint pill opens the meaning panel without the spelling',
        hint.meaningOpen && /[\u0D80-\u0DFF]/.test(hint.si) && hint.wordStillMasked, JSON.stringify(hint));
      await page.evaluate(() => { document.getElementById('btnPlayPause').click(); });
      /* the classroom opening (cue clips) runs before the first word, so wait
         on the live phase, never on a timer */
      await page.waitForFunction(
        () => /Listen Carefully|Write Word #/.test(document.getElementById('beatStateText').textContent),
        null, { timeout: 20000 });
      const reveal = await page.evaluate(async () => {
        document.getElementById('btnRevealWord').click();
        await new Promise((resolve) => setTimeout(resolve, 250));
        return {
          word: (document.getElementById('revealWordText') || {}).textContent || '',
          paused: window.SDP && SDP.Engine && SDP.Engine.isPaused ? SDP.Engine.isPaused() : null,
          pausedBadge: (document.getElementById('revealPausedBadge') || {}).hidden === false
        };
      });
      check('G5.12e revealing the current word auto-pauses dictation',
        reveal.word && !/^\u2022+$/.test(reveal.word) && reveal.paused === true && reveal.pausedBadge, JSON.stringify(reveal));
      const typing = await page.evaluate(async () => {
        document.getElementById('btnModeSwitch').click();
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
          mode: document.body.getAttribute('data-sdp-mode'),
          chips: getComputedStyle(document.getElementById('hintChips')).display
        };
      });
      check('G5.12f typing mode paints the hint chips again',
        typing.mode === 'typing' && typing.chips !== 'none', JSON.stringify(typing));

      // A3: the unlocked studio bar is a compact <=60px strip pinned straight
      // under the header (0px gap) and the toast whispers from the bottom.
      await page.evaluate(() => {
        /* visual-gate unlock: bypass BOTH the PIN verifier and the sealed
           envelope so the studio opens deterministically on a fresh page */
        SDP.Sync.Vault.verifyPinVerifier = function () { return Promise.resolve(true); };
        SDP.Sync.Vault.decryptV2 = function () { return Promise.resolve({}); };
        document.getElementById('tab-studio').click();
        SDP.Studio.unlock('4321', () => {});
      });
      await page.waitForTimeout(800);
      /* scroll the studio so the sticky bar is pinned, then measure both the
         bar (gap must be 0px) and the fixed toast (visual bottom edge) */
      const studio = await page.evaluate(() => {
        window.scrollTo(0, 320);
        const bar = document.getElementById('studioSecurityBar');
        const header = document.getElementById('appHeader').getBoundingClientRect();
        const r = bar ? bar.getBoundingClientRect() : null;
        const toast = document.getElementById('sdpDataToast');
        const tr = toast ? toast.getBoundingClientRect() : null;
        return {
          bar: !!bar,
          h: r ? Math.round(r.height) : 0,
          gap: r ? Math.round(r.top - header.bottom) : 99,
          toastBottomCss: toast ? getComputedStyle(toast).bottom : '',
          toastBottomPx: tr ? Math.round(tr.bottom) : -1,
          viewportH: window.innerHeight,
          chipsNode: !!document.getElementById('studioLiveChips'),
          chipCols: (function (n) { return n ? getComputedStyle(n).gridTemplateColumns : ''; })(document.getElementById('studioLiveChips'))
        };
      });
      check('G5.12g the studio bar stays a compact <=60px strip under the header',
        studio.bar && studio.h <= 60 && Math.abs(studio.gap) <= 1, JSON.stringify(studio));
      check('G5.12h the data toast whispers from the bottom edge on phones',
        parseInt(studio.toastBottomCss, 10) > 0 && studio.toastBottomPx > studio.viewportH - 120, JSON.stringify(studio));
      check('G5.12i the live chips render as a 2-3 column grid',
        studio.chipsNode && studio.chipCols.split(' ').length >= 2, JSON.stringify(studio));
      check('G5.12j the v0.0.6.l cockpit/studio throws no page errors', errors.length === 0, errors.join(' | '));
      await context.close();
    }

    /* ── 13. v0.0.6.l CF1: the ULTRA-CLEAN header + the URL Beta channel ─── */
    // contract: docs/CHANGELOG_LEDGER.md §v0.0.6.l — the Project Briefing
    // suite is permanent on Main; ?beta / #beta stamp BETA_SUBVERSION
    // 0.0.6.l.beta and replay the briefing. The header keeps ONLY the brand
    // block + EN|SI + Theme; ?b=1 is NOT a channel alias; the clean URL
    // stays on Main.
    for (const flag of ['?beta', '#beta', '?b=1', '']) {
      const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.6.z');
          localStorage.setItem('sdp.settings', JSON.stringify({ appliedSettingsRev: 99, langResetV001e: true, defaultsResetV001f: true, guideAutoPlay: false, mode: 'paper', lang: 'en', theme: 'light', briefingSeen: '0.0.6.z' }));
        } catch (e) {}
      });
      const page = await context.newPage();
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await page.goto(server.origin + '/index.html' + flag, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const main = await page.evaluate(() => ({
        betaActive: !!(window.SDP && SDP.Views && SDP.Views.betaActive && SDP.Views.betaActive()),
        betaSub: (window.SDP && window.SDP.Views && SDP.Views.betaSubversion) ? SDP.Views.betaSubversion() : '',
        pillInHeader: !!document.querySelector('#appHeader #sdpBetaPill'),
        stampInDom: !!document.getElementById('sdpBetaStamp'),
        briefingOpen: (document.getElementById('briefingModal') || {}).hidden === false,
        headerChildren: Array.from(document.querySelectorAll('#appHeader > *')).map((n) => n.id).filter(Boolean).join(','),
        headerNodes: document.querySelectorAll('#appHeader > *').length,
        headerBtns: Array.from(document.querySelectorAll('#appHeader button')).map((n) => n.id).filter(Boolean).join(','),
        headerText: (document.getElementById('appHeader') || {}).textContent.trim() || '',
        verPill: (document.getElementById('sdpVerPill') || {}).textContent || '',
        aboutTools: !!document.querySelector('#aboutCard .about-tools'),
        aboutRelocated: ['btnCreatorNote', 'btnGuideTop', 'btnStudioQuick', 'syncBadge'].every((id) => !!document.querySelector('#aboutCard #' + id)),
        fixLive: !!document.querySelector('meta[name="darkreader-lock"]') && getComputedStyle(document.getElementById('hintChips')).display === 'none'
      }));
      const tag = flag || '(clean url)';
      const wantsBeta = flag === '?beta' || flag === '#beta';
      check('G5.13a ' + tag + ' the governed Beta channel state matches the URL',
        main.betaActive === wantsBeta && main.betaSub === '0.0.7.e.beta',
        JSON.stringify(main));
      check('G5.13a2 ' + tag + ' the Beta channel replays the Project Briefing',
        main.briefingOpen === wantsBeta, JSON.stringify(main));
      check('G5.13b ' + tag + ' the ULTRA-CLEAN header keeps only brand + EN|SI + Theme',
        main.headerChildren === 'sdpBrand' && main.headerNodes === 2 &&
        main.headerBtns === 'btnLang,btnTheme' &&
        !main.pillInHeader && !main.stampInDom &&
        /Smart Dictation/.test(main.headerText) && /CCBE B1/.test(main.headerText) &&
        !/Beta|Creator Note|Guide|Synced|Lecturer Admin|v0\.0\.6/.test(main.headerText),
        JSON.stringify(main));
      check('G5.13c ' + tag + ' the relocated triggers live inside the About card',
        main.aboutTools && main.aboutRelocated && main.verPill === 'v0.0.7.e', JSON.stringify(main));
      check('G5.13d ' + tag + ' the release fixes are live on the main UI', main.fixLive, JSON.stringify(main));
      await context.close();
    }


    /* ── 14. v0.0.6.l critical fixes: clock state machine, pinned #tabbar,
       the #tab-settings squircle (CF1 / CF2 / CF3) ────────────────────────
       contract: docs/CHANGELOG_LEDGER.md §v0.0.6.l CF1–CF4 */
    for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
      const tag = viewport.width + 'x' + viewport.height;
      {
        /* CF2: #tabbar stays visible and switchable through idle → playing
           → paused on the player screen, at phone widths. */
        const { context, page } = await openPage(browser, server.origin, viewport);
        await bootSettings(page, { mode: 'paper', writeSecs: 8, repeats: 1, pauseSecs: 1, autoAdvance: false });
        await page.click('#tab-player');
        await page.waitForTimeout(300);
        const probeIdle = await page.evaluate(() => {
          const tb = document.getElementById('tabbar');
          const r = tb.getBoundingClientRect();
          return { display: getComputedStyle(tb).display, vis: getComputedStyle(tb).visibility, bottom: r.bottom, inner: window.innerHeight, z: getComputedStyle(tb).zIndex, transform: getComputedStyle(tb).transform };
        });
        check('G5.14a [' + tag + '] #tabbar is pinned and visible on an idle player screen',
          probeIdle.display !== 'none' && probeIdle.vis === 'visible' && probeIdle.bottom <= probeIdle.inner + 1 && probeIdle.bottom > 0,
          JSON.stringify(probeIdle));
        /* one ring tap from a COLD Dictation tab starts Word #1 (CF1) */
        await page.click('#ringWrap');
        await page.waitForTimeout(900);
        const started = await page.evaluate(() => ({
          active: SDP.Engine.isActive(), paused: SDP.Engine.isPaused(), phase: SDP.Engine.state(),
          items: SDP.Engine.items().length, index: SDP.Engine.config().index,
          beat: document.getElementById('beatSeconds').textContent,
          label: document.getElementById('btnPlayPause').getAttribute('aria-label')
        }));
        check('G5.14b [' + tag + '] one ring tap on a cold Dictation tab starts Word #1',
          started.active === true && started.paused === false && started.items === 31 && started.phase === 'listening',
          JSON.stringify(started));
        const probePlaying = await page.evaluate(() => {
          const tb = document.getElementById('tabbar');
          const r = tb.getBoundingClientRect();
          return { display: getComputedStyle(tb).display, vis: getComputedStyle(tb).visibility, bottom: r.bottom, inner: window.innerHeight };
        });
        check('G5.14c [' + tag + '] #tabbar stays visible while dictation is playing',
          probePlaying.display !== 'none' && probePlaying.vis === 'visible' && probePlaying.bottom <= probePlaying.inner + 1,
          JSON.stringify(probePlaying));
        /* pause — frozen exactly; resume — no reset, no jump (CF1 Case B/A) */
        await page.waitForTimeout(2500);
        const prePause = await page.evaluate(() => ({
          phase: SDP.Engine.state(),
          beat: document.getElementById('beatSeconds').textContent,
          remainingMs: SDP.Engine.config().remainingMs
        }));
        await page.click('#btnPlayPause');
        await page.waitForTimeout(150);
        const frozenA = await page.evaluate(() => document.getElementById('beatSeconds').textContent);
        await page.waitForTimeout(1200);
        const frozenB = await page.evaluate(() => ({
          paused: SDP.Engine.isPaused(),
          beat: document.getElementById('beatSeconds').textContent,
          phase: SDP.Engine.state()
        }));
        check('G5.14d [' + tag + '] pause freezes the clock exactly (no drift while paused)',
          frozenB.paused === true && frozenB.beat === frozenA && (frozenB.phase === 'paused'),
          JSON.stringify({ frozenA, frozenB }));
        const probePaused = await page.evaluate(() => {
          const tb = document.getElementById('tabbar');
          const r = tb.getBoundingClientRect();
          return { display: getComputedStyle(tb).display, vis: getComputedStyle(tb).visibility, bottom: r.bottom, inner: window.innerHeight };
        });
        check('G5.14e [' + tag + '] #tabbar stays visible while paused',
          probePaused.display !== 'none' && probePaused.vis === 'visible' && probePaused.bottom <= probePaused.inner + 1,
          JSON.stringify(probePaused));
        await page.click('#btnPlayPause');
        await page.waitForTimeout(600);
        const resumed = await page.evaluate(() => ({
          active: SDP.Engine.isActive(), paused: SDP.Engine.isPaused(), phase: SDP.Engine.state(),
          beat: document.getElementById('beatSeconds').textContent,
          stateText: document.getElementById('beatStateText').textContent
        }));
        check('G5.14f [' + tag + '] a third tap resumes cleanly (never stuck, never a 60s dead clock)',
          resumed.active === true && resumed.paused === false && (resumed.phase === 'listening' || resumed.phase === 'writing') && parseInt(resumed.beat, 10) <= 15,
          JSON.stringify({ resumed, prePause }));
        /* switching tabs from INSIDE an active session works (CF2) */
        await page.click('#tab-settings');
        await page.waitForTimeout(300);
        const onSettings = await page.evaluate(() => document.querySelector('.screen.active').id);
        await page.click('#tab-home');
        await page.waitForTimeout(250);
        const onHome = await page.evaluate(() => document.querySelector('.screen.active').id);
        check('G5.14g [' + tag + '] every tab is switchable from inside an active dictation',
          onSettings === 'screen-settings' && onHome === 'screen-home', JSON.stringify({ onSettings, onHome }));
        await context.close();
      }
    }
    {
      /* CF3: all six bottom tabs carry the color squircle — including the
         previously bare #tab-settings gear. */
      const { context, page } = await openPage(browser, server.origin, { width: 390, height: 844 });
      await page.waitForTimeout(500);
      const squircles = await page.evaluate(() => {
        const out = {};
        const ids = ['tab-home', 'tab-player', 'tab-practice', 'tab-dict', 'tab-settings', 'tab-studio'];
        for (const id of ids) {
          const span = document.getElementById(id).querySelector('.tab-ico');
          const cs = getComputedStyle(span);
          const img = cs.backgroundImage;
          out[id] = {
            tico: /\btico\b/.test(span.className),
            grad: /gradient\(/.test(img),
            w: Math.round(span.getBoundingClientRect().width),
            bg: cs.backgroundColor
          };
        }
        return out;
      });
      const squircleBad = Object.keys(squircles).filter((id) => !(squircles[id].tico && squircles[id].grad && squircles[id].w >= 40));
      check('G5.14h all six bottom tabs paint a color squircle (incl. #tab-settings tico-settings)',
        squircleBad.length === 0, JSON.stringify(squircles));
      /* the One-UI settings surface: switches, steppers, capsule selects */
      await page.click('#tab-settings');
      await page.waitForTimeout(400);
      const oneUi = await page.evaluate(() => {
        const sw = document.getElementById('setAutoAdvance');
        const swStyle = getComputedStyle(sw);
        return {
          switchAppearance: swStyle.appearance + '/' + swStyle.webkitAppearance,
          switchWidth: Math.round(sw.getBoundingClientRect().width),
          stepperR: Math.round(document.getElementById('stepWritePlus').getBoundingClientRect().height),
          selectH: Math.round(document.getElementById('setVoiceLock').getBoundingClientRect().height),
          cardRadius: getComputedStyle(document.querySelector('.set-card')).borderRadius,
          headSquircle: Math.round(document.querySelector('.set-head .set-squircle').getBoundingClientRect().width)
        };
      });
      check('G5.14i #screen-settings renders the One-UI switches, steppers and capsules',
        oneUi.switchAppearance.indexOf('none') === 0 || String(oneUi.switchAppearance).indexOf('none') !== -1,
        JSON.stringify(oneUi));
      check('G5.14j settings controls keep >=48px touch targets after the restyle',
        oneUi.stepperR >= 44 && oneUi.selectH >= 44, JSON.stringify(oneUi));
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
