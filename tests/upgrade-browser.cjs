'use strict';
/* v9.0.0.2 / build 60 Chromium upgrade gate (Next-Gen Hurubuhuti). No live internet: every external request is
 * aborted or mocked locally. Test PIN is constructed at runtime. */
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '..');
const PIN = require('./test-pin.cjs');
const results = [];
function push(test, ok, detail) { results.push({ test, status: ok ? 'PASS' : 'FAIL', detail }); }
(async () => {
  const mime = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.mp4': 'video/mp4', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(String(req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('nope'); }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SDP_BROWSER_BIN || await serverChromium.executablePath(), args: serverChromium.args.filter(a => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a)) });

  async function newPage(opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, opts || {}));
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    await page.addInitScript(() => { window.__SDP_QA__ = true; });
    await page.goto(base + '/index.html');
    await page.waitForTimeout(2600);
    for (let i = 0; i < 12; i++) {
      const c = page.locator('#sheets .shead button[aria-label="Close"]');
      if (await c.count()) await c.first().click().catch(() => {});
      if (await page.locator('#sheets .sheet').count() === 0) break;
      await page.waitForTimeout(200);
    }
    return { ctx, page, errors };
  }
  async function unlock(page) {
    await page.evaluate(() => { const d = document.getElementById('topOverflow'); if (d) d.open = true; const b = document.getElementById('btnAdmin'); if (b) b.click(); });
    await page.waitForTimeout(250);
    await page.evaluate((pin) => { for (const d of pin) { const b = document.querySelector('#pinPad [data-k="' + d + '"]'); if (b) b.click(); } const s = document.getElementById('pinSubmit'); if (s) s.click(); }, PIN);
    await page.locator('#adminHost').waitFor({ timeout: 6000 });
  }

  {
    const { ctx, page, errors } = await newPage();
    const state = await page.evaluate(() => ({
      static: document.body.getAttribute('data-wallpaper') === 'static',
      videoSrc: document.getElementById('bgLiveVideo').getAttribute('src'),
      credit: document.getElementById('credit') ? getComputedStyle(document.getElementById('credit')).position : 'missing', depot: !!document.getElementById('sdpV56'),
      overflow: !!document.getElementById('topOverflow'), lang: !!document.getElementById('btnLang'), data: !!document.getElementById('topDataBadge'),
      mixer: !!document.getElementById('materialMixer'), meter: !!window.SDPDataMeter
    }));
    push('v58 boots Static Gradient with a three-control header, inline signature pill and no fake depot/mixer', state.static && !state.videoSrc && state.credit === 'static' && !state.depot && state.overflow && state.lang && state.data && !state.mixer && state.meter && errors.length === 0, Object.assign({ errors }, state));
    await page.evaluate(() => { window.SDPCore.UI.setTab('set'); });
    await page.waitForTimeout(200);
    const ids = await page.evaluate(() => ['rateRange', 'volRange', 'repeatsSelect', 'readSentenceToggle', 'writeSecsRange', 'bitrateSelect'].map(id => !!document.getElementById(id)));
    push('v57 settings expose real wired control IDs', ids.every(Boolean), ids);
    const wired = await page.evaluate(() => {
      const C = window.SDPCore; C.DB.data.settings.rate = 0.7; C.DB.data.settings.volume = 0.4; C.DB.saveNow();
      C.Eng.start({}); C.Speech.unlock();
      const rate = C.Speech.desiredRate, vol = C.Speech.master().volume;
      C.Eng.stop(); return { rate, vol };
    });
    push('v57 speed and volume settings reach the actual speech engine', Math.abs(wired.rate - 0.7) < 1e-6 && Math.abs(wired.vol - 0.4) < 1e-6, wired);
    const dim = await page.evaluate(() => {
      const LW = window.SDPCore.LiveWallpaper; LW.setDim(0); const lo = document.getElementById('contrastReadout').textContent;
      LW.setDim(100); const hi = document.getElementById('contrastReadout').textContent; LW.setDim(18);
      const ratio = t => { const m = /Live WCAG contrast (\d+\.\d+):1/.exec(String(t)); return m ? Number(m[1]) : -1; };
      return { lo, hi, max: document.getElementById('sVideoDim').max, loRatio: ratio(lo), hiRatio: ratio(hi) };
    });
    push('v58 dimmer is 0-100 and the composited WCAG gauge rises with the dim', dim.max === '100' && /Live WCAG contrast \d+\.\d+:1/.test(dim.lo) && /AAA ✓/.test(dim.hi) && /readable/.test(dim.hi) && dim.loRatio > 0 && dim.hiRatio > dim.loRatio, dim);
    await page.evaluate(() => { window.SDPCore.DB.data.settings.perf = 'lite'; window.SDPCore.UI.applyPerf(); });
    const blur = await page.evaluate(() => getComputedStyle(document.querySelector('.glass')).backdropFilter || getComputedStyle(document.querySelector('.glass')).webkitBackdropFilter);
    push('v57 true Lite mode disables backdrop filters', blur === 'none', { blur });
    await ctx.close();
  }

  {
    const { ctx, page, errors } = await newPage();
    await page.evaluate(() => { window.SDPCore.UI.setTab('set'); });
    await page.evaluate(() => { const b = document.getElementById('btnOpenGallery'); if (b) b.click(); });
    await page.waitForTimeout(300);
    const gallery = await page.evaluate(() => ({
      staticBtn: !!document.getElementById('btnStaticWallpaper'),
      mb: Array.from(document.querySelectorAll('#videoGalleryList .gal-kind')).map(n => n.textContent).join(' | ')
    }));
    push('v57 wallpaper gallery is opt-in and labels exact MB sizes', gallery.staticBtn && /10\.06 MB|10\.55 MB|MB \(/.test(gallery.mb), gallery);
    await page.evaluate(() => { const b = document.querySelector('[data-gallery-select]'); if (b) b.click(); });
    await page.waitForFunction(() => { const v = document.getElementById('bgLiveVideo'); return v && v.getAttribute('src') && v.readyState >= 2; }, null, { timeout: 12000 }).catch(() => {});
    const opted = await page.evaluate(() => ({ src: document.getElementById('bgLiveVideo').getAttribute('src'), mode: window.SDPCore.DB.data.settings.wallpaperMode }));
    push('v57 applying a gallery video really loads the selected file', /hooded/.test(opted.src || '') && opted.mode === 'video', opted);
    await page.evaluate(() => { window.SDPCore.LiveWallpaper.setStatic(true); });
    const back = await page.evaluate(() => ({ src: document.getElementById('bgLiveVideo').getAttribute('src'), mode: document.body.getAttribute('data-wallpaper') }));
    push('v57 Static returns to a 0-MB background immediately', !back.src && back.mode === 'static', back);
    push('v57 gallery/opt-in flow has no page errors', errors.length === 0, errors);
    await ctx.close();
  }

  {
    const { ctx, page, errors } = await newPage();
    await unlock(page);
    let puts = 0;
    await page.route('https://api.github.com/**', async route => {
      const req = route.request();
      if (req.method() === 'PUT') { puts++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'new' } }) }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: btoa('{}'), encoding: 'base64', sha: 'old' }) });
    });
    await page.evaluate(() => { window.SDPCore.Cloud.ghToken(['g', 'hp_'].join('') + 'runtime_test'); });
    const cancelled = await page.evaluate(() => new Promise(resolve => {
      window.SDPCore.Cloud.ghPublish(r => resolve(r));
      setTimeout(() => { const ta = document.getElementById('publishPreviewWords'); const btns = Array.from(document.querySelectorAll('#sheets button')); const cancel = btns.find(b => /Cancel/.test(b.textContent)); if (ta && cancel) cancel.click(); else resolve({ ok: false, err: 'no-preview' }); }, 900);
    }));
    push('v57 publish is blocked by an editable preview until the lecturer confirms', /cancelled/i.test(cancelled.err || '') && puts === 0, { cancelled, puts });
    const confirmed = await page.evaluate(() => new Promise(resolve => {
      window.SDPCore.Cloud.ghPublish(r => resolve(r));
      setTimeout(() => { const ta = document.getElementById('publishPreviewWords'); if (ta) { ta.value = Array.from({ length: 30 }, (_, i) => 'word' + (i + 1)).join('\n'); ta.dispatchEvent(new Event('input')); } const ok = document.getElementById('btnConfirmPublish'); if (ok) ok.click(); else resolve({ ok: false, err: 'no-confirm' }); }, 900);
    }));
    await page.waitForTimeout(400);
    push('v57 confirming the 30-word preview commits through GitHub only', confirmed.ok === true && puts >= 1, { confirmed, puts });
    const radar = await page.evaluate(() => {
      window.SDPCore.Results.open({ id: 'qa', percent: 50, score: 1, wordCount: 2, mode: 'type', rows: [{ word: 'afraid', state: 'no' }, { word: 'brave', state: 'ok' }], durationSec: 10 });
      return { radar: !!document.getElementById('weaknessRadar'), csv: !!document.getElementById('btnExportWeaknessCsv'), missed: (document.getElementById('lecturerWeakness') || {}).textContent || '' };
    });
    push('v57 lecturer results include a weakness radar, error percentages and CSV export', radar.radar && radar.csv && /afraid/.test(radar.missed) && /50%/.test(radar.missed), radar);
    push('v57 publish/results flow has no page errors', errors.length === 0, errors);
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage(); const errors = []; let paid = 0;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => { if (/elevenlabs/.test(route.request().url())) paid++; return route.abort(); });
    await page.addInitScript(() => {
      window.__SDP_QA__ = true;
      Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '2g', addEventListener: function () {} }, configurable: true });
    });
    await page.goto(base + '/index.html'); await page.waitForTimeout(2200);
    const state = await page.evaluate(() => ({ static: document.body.getAttribute('data-wallpaper'), src: document.getElementById('bgLiveVideo').getAttribute('src') }));
    await page.evaluate(() => { window.SDPCore.Speech.playWord('afraid', 1, function () {}); window.SDPCore.Speech.speakStudioText('Number 31', 'en', function () {}); });
    await page.waitForTimeout(500);
    push('v57 saveData / 2G forces Static and student playback never spends ElevenLabs credits', state.static === 'static' && !state.src && paid === 0 && errors.length === 0, Object.assign({ paid, errors }, state));
    await ctx.close();
  }

  {
    /* v58: two-panel data sheet with plan chips + focus-dim controller. */
    const { ctx, page, errors } = await newPage();
    const sheet = await page.evaluate(() => new Promise(resolve => {
      const C = window.SDPCore;
      C.UI.setTab('home');
      if (C.UI.openDataSheet) C.UI.openDataSheet();
      setTimeout(() => resolve({
        open: !!document.getElementById('dataReportSheet'),
        network: !!document.getElementById('v58NetworkPanel'),
        cache: !!document.getElementById('v58CachePanel'),
        today: (document.getElementById('dataSessionTodayMB') || {}).textContent || '',
        lkr: (document.getElementById('dataSessionTodayLkr') || {}).textContent || '',
        savedMB: (document.getElementById('dataCacheSavedMB') || {}).textContent || '',
        savedLkr: (document.getElementById('dataCacheSavedLkr') || {}).textContent || '',
        planLabel: (document.getElementById('dataPlanLabel') || {}).textContent || '',
        chips: Array.from(document.querySelectorAll('#dataPlanChips .v58-plan-chip')).map(b => b.textContent),
        active: document.querySelectorAll('#dataPlanChips .v58-plan-chip[aria-pressed="true"]').length
      }), 700);
    }));
    const expectedChips = ['Student Lite — LKR 49.00/GB', 'Study Pack — LKR 99.00/GB', 'Family Share — LKR 150.00/GB', 'Classroom — LKR 220.00/GB', 'Custom Price'];
    push('v58 data sheet renders Network & Cache panels, live MB, ≈ LKR and the five plan chips',
      sheet.open && sheet.network && sheet.cache && /MB/.test(sheet.today) && /^≈/.test(sheet.lkr) &&
      /(B|MB)/.test(sheet.savedMB) && /^≈/.test(sheet.savedLkr) && /LKR \d+\.\d+\/GB/.test(sheet.planLabel) &&
      JSON.stringify(sheet.chips) === JSON.stringify(expectedChips) && sheet.active === 1 && errors.length === 0,
      Object.assign({ errors }, sheet));
    await page.evaluate(() => {
      const C = window.SDPCore;
      if (C.UI.closeSheet) C.UI.closeSheet();
      if (C.Speech.showRetryToast) C.Speech.showRetryToast('QA retry', 'en', function () {});
      const el = document.querySelector('.sdp-retry-toast');
      if (el) el.setAttribute('data-qa', '1');
    });
    await page.locator('#btnStart').click();
    await page.waitForTimeout(900);
    const focus = await page.evaluate(() => ({
      on: document.body.classList.contains('v58-focus'),
      qaToastGone: document.querySelectorAll('.sdp-retry-toast[data-qa]').length === 0
    }));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#sheets button'));
      const ready = btns.find(x => /ready/i.test(x.textContent));
      if (ready) ready.click();
    });
    await page.waitForTimeout(1200);
    const session = await page.evaluate(() => ({
      dock: !!document.getElementById('v58Dock'),
      layer: !!(window.SDPCore.Eng && window.SDPCore.Eng.layer)
    }));
    await page.evaluate(() => { window.SDPCore.Eng.stop(); });
    await page.waitForTimeout(800);
    const focusOff = await page.evaluate(() => !document.body.classList.contains('v58-focus'));
    push('v58 focus-dim activates on Start, kills the toast and the dock appears with the player', focus.on === true && focus.qaToastGone === true && session.dock === true && session.layer === true && focusOff === true, Object.assign({ focusOff }, focus, session));
    const chipClick = await page.evaluate(() => new Promise(resolve => {
      const C = window.SDPCore;
      if (C.UI.openDataSheet) C.UI.openDataSheet();
      setTimeout(() => {
        const chip = document.getElementById('v58Plan-study');
        if (chip) chip.click();
        setTimeout(() => resolve({
          label: (document.getElementById('dataPlanLabel') || {}).textContent || '',
          price: window.SDPDataMeter.price(),
          pressed: chip ? chip.getAttribute('aria-pressed') : null
        }), 300);
      }, 500);
    }));
    push('v58 tapping a plan chip persists the plan, price and active state',
      /Study Pack/.test(chipClick.label) && chipClick.price === 99 && chipClick.pressed === 'true' && errors.length === 0, Object.assign({ errors }, chipClick));
    await ctx.close();
  }

  /* ------------------------------------------------------------------
     v9.0.0.2 / build 60 — Next-Gen Hurubuhuti visual contract (mockups 6.1-6.8).
     Everything is measured on the real compositor: sizes, colours, visibility.
     ------------------------------------------------------------------ */
  {
    const { ctx, page, errors } = await newPage({ viewport: { width: 390, height: 844 } });
    const shell = await page.evaluate(() => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const box = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
      const top = document.querySelector('.topbar');
      const cluster = document.getElementById('sdpTopCluster');
      const badge = document.getElementById('topDataBadge');
      const tabs = Array.from(document.querySelectorAll('#tabbar button[data-tab]'));
      const hero = document.getElementById('homeHero');
      const grid = document.getElementById('sdpQuickPracticeGrid');
      return {
        topH: Math.round(box(top).height), topTop: Math.round(box(top).top),
        cluster: cluster ? cluster.children.length : 0,
        brandPill: (document.getElementById('sdpBrandPill') || {}).textContent,
        brandSub: (document.getElementById('sdpBrandSub') || {}).textContent,
        dataChip: badge ? cs(badge).display : 'missing',
        tabH: Math.round(box(document.getElementById('tabbar')).height),
        tabs: tabs.map((b) => b.textContent.trim()),
        heroBg: cs(hero).backgroundColor, heroImg: cs(hero).backgroundImage, heroBlur: cs(hero).backdropFilter,
        chips: (document.getElementById('sdpHeroConfigChips') || { children: [] }).children.length,
        stats: (document.getElementById('sdpHomeStatsRow') || { children: [] }).children.length,
        quick: grid ? grid.children.length : 0,
        quickCols: grid ? cs(grid).gridTemplateColumns.split(' ').length : 0,
        toast: !!document.getElementById('microToastLoad'), toastText: (document.getElementById('microToastLoad') || {}).textContent || '',
        credit: !!document.getElementById('creditPill'), docked: !!document.getElementById('creditDocked'),
        bodyBg: cs(document.body).backgroundColor, canvas: cs(document.documentElement).getPropertyValue('--bg-canvas').trim(),
        topBarBg: cs(top).backgroundColor, blurs: Array.from(document.body.querySelectorAll('*')).filter((e) => { const b = cs(e).backdropFilter; return b && b !== 'none'; }).length,
        legacy: { v57: !!document.getElementById('sdpV57Css') && document.getElementById('sdpV57Css').disabled, v58: !!document.getElementById('sdpV58Css') && document.getElementById('sdpV58Css').disabled }
      };
    });
    push('v9.0.0.2 54px topbar, brand pill v60, exactly three utility controls, no LKR chip',
      shell.topH === 54 && shell.topTop === 0 && shell.cluster === 3 && shell.brandPill === 'v60' && /CCBE Galle/.test(shell.brandSub) && shell.dataChip === 'none' && errors.length === 0,
      { shell, errors });
    push('v9.0.0.2 5-tab bar (Home · Words · Dictate · Practice · Settings) at 60px with the Dictate tab on Home',
      shell.tabH === 60 && JSON.stringify(shell.tabs) === JSON.stringify(['Home', 'Words', 'Dictate', 'Practice', 'Settings']), shell.tabs);
    push('v9.0.0.2 home: solid Zinc hero (no gradient/blur), 4 config chips, 3 stats, 2x2 quick practice',
      /rgb\(24, 24, 27\)/.test(shell.heroBg) && shell.heroImg === 'none' && shell.heroBlur === 'none' &&
      shell.chips === 4 && shell.stats === 3 && shell.quick === 4 && shell.quickCols === 2, shell);
    push('v9.0.0.2 flat dark shell: Zinc-950 canvas, translucent 54px bar, zero backdrop blur anywhere',
      shell.bodyBg === 'rgb(9, 9, 11)' && shell.canvas === '#09090B' && /rgba\(9, 9, 11/.test(shell.topBarBg) && shell.blurs === 0, shell);
    push('v9.0.0.2 legacy sheets are neutralised and the whisper-quiet toast + credit pill are on screen',
      shell.legacy.v57 && shell.legacy.v58 && shell.toast && /⚡/.test(shell.toastText) && shell.credit && shell.docked, shell);

    /* the Dictate tab goes Home and focuses the cockpit CTA */
    await page.evaluate(() => document.getElementById('tab-comm').click());
    await page.waitForTimeout(350);
    const dictate = await page.evaluate(() => ({
      screen: document.getElementById('screen-home').className,
      selected: document.getElementById('tab-home').getAttribute('aria-selected')
    }));
    push('v9.0.0.2 the Dictate tab opens Home instead of the community screen',
      dictate.screen.indexOf('hidden') < 0 && dictate.selected === 'true', dictate);

    /* settings: dictation first and visible without scrolling */
    const settings = await page.evaluate(() => {
      const C = window.SDPCore;
      C.UI.setTab('set');
      return new Promise((resolve) => setTimeout(() => {
        const host = document.getElementById('sdpNextGenSettings');
        const acc = document.getElementById('sdpAppearanceAccordion');
        const rows = host ? host.querySelectorAll('.sdp-row').length : 0;
        const vh = window.innerHeight;
        const ids = ['sdpSegMode', 'sdpSegSpeed', 'sdpSegRepeats', 'sdpRangeWait', 'sdpToggleAutoSentence', 'sdpSegLang'];
        const visible = ids.filter((id) => { const el = document.getElementById(id); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.top < vh; });
        resolve({ first: document.getElementById('screen-set').firstElementChild === host, rows, visible: visible.length,
          acc: acc ? acc.tagName.toLowerCase() : '', open: acc ? acc.open : null,
          legacyInside: !!(acc && acc.contains(document.getElementById('setBody'))),
          docH: document.documentElement.scrollHeight });
      }, 300));
    });
    push('v9.0.0.2 settings are dictation-first: six wired rows above the fold, wallpapers collapsed in Priority 3',
      settings.first && settings.rows >= 6 && settings.visible === 6 && settings.acc === 'details' && settings.open === false && settings.legacyInside,
      settings);

    /* cockpit: start a dictation and check the 4px edge bar, 34px timer pill and word map */
    await page.evaluate(() => {
      const C = window.SDPCore;
      C.DB.data.settings.mode = 'paper';
      C.UI.setTab('home');
      C.Eng.start({});
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const b = document.querySelector('#sheets button, #sheets [aria-label]'); const ready = Array.from(document.querySelectorAll('#sheets button')).find((x) => /ready/i.test(x.textContent || '')); if (ready) ready.click(); });
    await page.waitForTimeout(1200);
    const cockpit = await page.evaluate(() => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const pill = document.getElementById('sdpTimerPill');
      const bar = document.getElementById('sdpEdgeBar');
      const map = document.getElementById('sdpWordMap');
      return {
        bar: bar ? Math.round(bar.getBoundingClientRect().height) : null,
        fill: !!document.getElementById('sdpEdgeBarFill'),
        pillH: pill ? Math.round(pill.getBoundingClientRect().height) : null,
        inCard: !!(pill && pill.closest('.wordcard')),
        cdInPill: !!(pill && pill.querySelector('#cdNum')),
        dock: (document.getElementById('sdpHelperDock') || { children: [] }).children.length,
        map: map ? map.children.length : 0,
        counters: (document.getElementById('sdpLiveCounters') || { children: [] }).children.length,
        ringHidden: cs(document.querySelector('#layers .lens')).display === 'none',
        word: (document.getElementById('plWord') || {}).textContent || ''
      };
    });
    push('v9.0.0.2 cockpit: 4px edge bar, 34px in-card timer pill, 4-button dock, 30-word map',
      cockpit.bar === 4 && cockpit.fill && cockpit.pillH === 34 && cockpit.inCard && cockpit.cdInPill && cockpit.dock === 4 && cockpit.map === 30 && cockpit.counters === 3 && cockpit.ringHidden,
      cockpit);
    await ctx.close();
  }

  /* desktop rail (mockup 6.7 / 6.8) */
  {
    const { ctx, page, errors } = await newPage({ viewport: { width: 1280, height: 800 } });
    const rail = await page.evaluate(() => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const r = document.getElementById('sdpDesktopRail');
      const rect = r ? r.getBoundingClientRect().toJSON() : null;
      const app = document.getElementById('app').getBoundingClientRect();
      return {
        display: r ? cs(r).display : 'missing', width: rect ? Math.round(rect.width) : 0,
        nav: r ? r.querySelectorAll('#sdpRailNav button').length : 0,
        docked: !!document.getElementById('creditDockedDesktop'),
        tabbar: cs(document.getElementById('tabbar')).display,
        appLeft: Math.round(app.left), topLeft: Math.round(document.querySelector('.topbar').getBoundingClientRect().left)
      };
    });
    push('v9.0.0.2 desktop >=1024px: 232px left rail, docked Hansana badge, tab bar retired, app offset',
      rail.display === 'flex' && rail.width === 232 && rail.nav === 5 && rail.docked && rail.tabbar === 'none' && rail.appLeft === 232 && rail.topLeft === 232 && errors.length === 0,
      rail);
    await ctx.close();
  }

  await browser.close(); await new Promise(r => server.close(r));
  console.log(JSON.stringify(results, null, 2));
  for (const r of results) if (r.status === 'FAIL') console.log('::error::' + r.test + ' :: ' + JSON.stringify(r.detail || '').slice(0, 600));
  if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
})().catch(e => { console.error(e); console.log('::error::' + String(e && e.stack || e).replace(/\r?\n/g, ' | ').slice(0, 900)); process.exit(1); });
