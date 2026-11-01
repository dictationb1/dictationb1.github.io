'use strict';
/* v58 / 7.0.0 Chromium upgrade gate. No live internet: every external request is
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
    await page.evaluate(() => { const d = document.getElementById('topOverflow'); if (d) d.open = true; const a = document.getElementById('sdpAppearanceAccordion'); if (a) a.open=true; const b = document.getElementById('btnAdmin'); if (b) b.click(); });
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
      creditDocked: !!document.getElementById('creditDocked') && getComputedStyle(document.getElementById('creditDocked')).position === 'static',
      mixer: !!document.getElementById('materialMixer'), meter: !!window.SDPDataMeter
    }));
    push('v58 boots Static Gradient with a three-control header, inline signature pill and no fake depot/mixer', state.static && !state.videoSrc && (state.credit === 'static' || state.creditDocked) && !state.depot && state.overflow && state.lang && state.data && !state.mixer && state.meter && errors.length === 0, Object.assign({ errors }, state));
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
    await page.waitForFunction(() => !!document.getElementById('sVideoDim') && !!document.getElementById('contrastReadout'), null, { timeout: 5000 }).catch(() => {});
    const dim = await page.evaluate(() => {
      const LW = window.SDPCore.LiveWallpaper; LW.setDim(0); const lo = document.getElementById('contrastReadout').textContent;
      LW.setDim(100); const hi = document.getElementById('contrastReadout').textContent; LW.setDim(18);
      const ratio = t => { const m = /WCAG contrast (\d+\.\d+):1/.exec(String(t)); return m ? Number(m[1]) : -1; };
      return { lo, hi, max: document.getElementById('sVideoDim').max, loRatio: ratio(lo), hiRatio: ratio(hi) };
    });
    push('v58 dimmer is 0-100 and the composited WCAG gauge rises with the dim', dim.max === '100' && /WCAG contrast \d+\.\d+:1/.test(dim.lo) && /AAA ✓/.test(dim.hi) && /readable/.test(dim.hi) && dim.loRatio > 0 && dim.hiRatio > dim.loRatio, dim);
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
      staticBtn: !!document.getElementById('btnStaticWallpaper') || !!document.querySelector('[data-gallery-static]') || /Static/.test(document.getElementById('videoGalleryList') ? document.getElementById('videoGalleryList').textContent : ''),
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
        network: !!document.getElementById('sdpNetworkPanel'),
        cache: !!document.getElementById('sdpCachePanel'),
        today: (document.getElementById('dataSessionTodayMB') || {}).textContent || '',
        lkr: (document.getElementById('dataSessionTodayLkr') || {}).textContent || '',
        savedMB: (document.getElementById('dataCacheSavedMB') || {}).textContent || '',
        savedLkr: (document.getElementById('dataCacheSavedLkr') || {}).textContent || '',
        planLabel: (document.getElementById('dataPlanLabel') || {}).textContent || '',
        chips: Array.from(document.querySelectorAll('#dataPlanChips .sdp-plan-chip')).map(b => b.textContent),
        active: document.querySelectorAll('#dataPlanChips .sdp-plan-chip[aria-pressed="true"]').length
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

  {
    const { ctx, page, errors } = await newPage();
    const home = await page.evaluate(() => {
      const shown = (sel) => { const n = document.querySelector(sel); return !!n && n.offsetParent !== null; };
      const absent = (sel) => { const n = document.querySelector(sel); return !n || n.offsetParent === null; };
      const bar = document.querySelector('.topbar').getBoundingClientRect();
      const badge = document.getElementById('topDataBadge');
      return {
        barH: Math.round(bar.height), barTop: Math.round(bar.top),
        badgeGone: !!badge && badge.offsetParent === null,
        legacy: ['#v58VoiceBadge', '#segMode', '#homeMeta', '#homeStats', '.v58-bento', '.v58-rail', '.sdp-retry-toast'].map(absent),
        v60: ['#sdpHomeGreeting', '#homeHero', '#sdpHeroConfigChips', '#sdpHomeStatsRow', '#sdpQuickPracticeGrid'].map(shown)
      };
    });
    push('v60 next-gen Home: 54px flush topbar, legacy clutter absent, next-gen blocks visible',
      home.barH <= 56 && home.barTop === 0 && home.badgeGone && home.legacy.every(Boolean) && home.v60.every(Boolean), home);
    const setState = await page.evaluate(() => new Promise(resolve => {
      window.SDPCore.UI.setTab('set');
      setTimeout(() => {
        const box = document.getElementById('sdpNextGenSettings');
        const acc = document.getElementById('sdpAppearanceAccordion');
        const body = document.getElementById('setBody');
        resolve({
          boxTop: box ? Math.round(box.getBoundingClientRect().top) : -1,
          boxFirst: !!box && document.getElementById('screen-set').firstElementChild === box,
          accOpen: acc ? acc.open : null,
          bodyInAcc: !!(body && body.closest('details#sdpAppearanceAccordion'))
        });
      }, 300);
    }));
    push('v60 Settings opens on the priority-1 panel with #setBody collapsed inside the accordion',
      setState.boxFirst && setState.boxTop >= 0 && setState.boxTop < 140 && setState.accOpen === false && setState.bodyInAcc, setState);
    const cockpit = await page.evaluate(() => new Promise(resolve => {
      const C = window.SDPCore;
      C.Eng.start({});
      setTimeout(() => {
        try { if (C.Eng.skipReady) C.Eng.skipReady(); } catch (e) {}
        setTimeout(() => {
          const vis = (id) => { const n = document.getElementById(id); return !!n && n.offsetParent !== null; };
          const lens = document.querySelector('#layers .lens');
          const lbody = document.querySelector('#layers .lbody');
          const cardNode = document.getElementById('sdpCockpitCard');
          const grid = document.querySelector('#layers .ctrlgrid');
          const foot = document.querySelector('#layers .lfoot');
          const gRect = grid ? grid.getBoundingClientRect() : null;
          const fRect = foot ? foot.getBoundingClientRect() : null;
          resolve({
            lbodyScroll: lbody ? lbody.scrollTop : -1,
            lbodyHeight: lbody ? Math.round(lbody.scrollHeight) : -1,
            cardTop: cardNode ? Math.round(cardNode.getBoundingClientRect().top) : -1,
            cardFullyVisible: cardNode ? (cardNode.getBoundingClientRect().top >= 0 && cardNode.getBoundingClientRect().bottom <= (window.innerHeight + 1)) : false,
            gridOnscreen: gRect ? (gRect.top < window.innerHeight && gRect.bottom > 0) : false,
            footOnscreen: fRect ? (fRect.top < window.innerHeight && fRect.bottom > 0) : false,
            sheetOpen: !!document.querySelector('#sheets .sheet:not(.hidden)'),
            card: vis('sdpCockpitCard'), edge: vis('sdpEdgeBar'), timer: vis('sdpTimerPill'),
            dock: vis('sdpCockpitDock'), map: vis('sdpWordMapCard'),
            lensGone: !lens || lens.offsetParent === null,
            status: (document.getElementById('plStatus') || {}).textContent || ''
          });
        }, 1200);
      }, 600);
    }));
    push('v60 active dictation shows the cockpit card, edge bar, timer pill, dock and word map',
      cockpit.card && cockpit.edge && cockpit.timer && cockpit.dock && cockpit.map && cockpit.lensGone, cockpit);
    push('v60.4 Bug5: no ready sheet, .lbody never scrolls, cockpit card stays in view and legacy .ctrlgrid/.lfoot are off-layout',
      !cockpit.sheetOpen && cockpit.lbodyScroll === 0 && cockpit.cardTop < 240 && cockpit.cardFullyVisible && !cockpit.gridOnscreen && !cockpit.footOnscreen && cockpit.lbodyHeight < 1200, cockpit);
    /* ---------------- v60 / 9.0.1.0 live-video bug regression block --------- */
    const video = await page.evaluate(async () => {
      const wait = (n) => new Promise((r) => setTimeout(r, n));
      const bar = document.querySelector('.topbar');
      const barRect = bar.getBoundingClientRect();
      const visKids = [];
      for (const c of bar.children) {
        const cs = getComputedStyle(c);
        if (cs.display !== 'none' && cs.visibility !== 'hidden') visKids.push(c.id || c.className);
      }
      const cd = document.getElementById('creditDocked');
      document.getElementById('tab-dict').click();
      await wait(700);
      const cards = document.querySelectorAll('#dictList .sdp-word-card');
      let tall = 0;
      for (const c of cards) if (c.getBoundingClientRect().height > 60) tall++;
      const sd = document.getElementById('screen-dict');
      const dictVisible = !!sd && getComputedStyle(sd).display !== 'none';
      window.SDPCore.UI.setTab('set');
      await wait(700);
      const testVoice = document.getElementById('sdpTestVoice');
      const toastsBefore = document.querySelectorAll('#toasts .toast').length;
      if (testVoice) testVoice.click();
      await wait(500);
      const toastText = Array.from(document.querySelectorAll('#toasts .toast')).slice(toastsBefore).map((t) => (t.textContent || '').trim()).join(' | ');
      const host = document.getElementById('screen-set');
      const ng = document.getElementById('sdpNextGenSettings');
      const sibs = [];
      if (host) for (const c of host.children) {
        if (c === ng) continue;
        const cs = getComputedStyle(c);
        sibs.push({ id: c.id || c.className, hidden: cs.display === 'none' || cs.visibility === 'hidden' || !!(c.closest && c.closest('details#sdpAppearanceAccordion')) });
      }
      window.SDPCore.UI.setTab('home');
      const legacyVisible = [];
      for (const n of document.querySelectorAll('#screen-home *, #screen-comm *')) {
        if (n.children.length > 3) continue;
        const t = (n.textContent || '').replace(/^\s+/, '').slice(0, 34);
        if (/^(Session progress|Smart Dictation Player v58)/.test(t) && (n.getClientRects().length > 0 || n.offsetParent !== null)) legacyVisible.push(t);
      }
      return {
        ready: document.body.getAttribute('data-v61-ready'),
        cloak: !!document.getElementById('sdpPrePaintCloak'),
        barFull: Math.round(barRect.width) === window.innerWidth && Math.round(barRect.top) === 0,
        barKids: visKids,
        barLeak: !!document.querySelector('.topbar #btnLock') || !!document.querySelector('.topbar #chipNet') || !!document.querySelector('.topbar .brand'),
        creditPos: cd ? getComputedStyle(cd).position : 'missing',
        cards: cards.length, tall, screenVisible: dictVisible,
        testVoice: !!testVoice, toastText, settingsSiblings: sibs, legacyVisible
      };
    });
    push('v60.4 Bug1: data-v61-ready is set and the pre-paint cloak ships in <head>', video.ready === '1' && video.cloak, video);
    push('v60.4 Bug2: .topbar is a full-bleed 56px bar with only #sdpBrandCluster + #sdpTopActions and no leaked legacy text',
      video.barFull && video.barKids.length === 2 && video.barKids.indexOf('sdpBrandCluster') >= 0 && video.barKids.indexOf('sdpTopActions') >= 0 && !video.barLeak, video.barKids);
    push('v60.4 Bug3: #creditDocked is statically positioned', video.creditPos === 'static', video.creditPos);
    push('v60.4 Bug4: the Words tab renders >= 25 tall .sdp-word-card items',
      video.screenVisible && video.cards >= 25 && video.tall >= 25, { cards: video.cards, tall: video.tall, visible: video.screenVisible });
    push('v60.4 Bug6: Test voice speaks without raising an error toast', video.testVoice && !/wrong|failed|error/i.test(video.toastText), { testVoice: video.testVoice, toasts: video.toastText });
    push('v60.4 Bug7: every #screen-set sibling of #sdpNextGenSettings is hidden or inside the collapsed accordion',
      video.settingsSiblings.every((s) => s.hidden), video.settingsSiblings);
    push('v60.4 Bug8: no Session progress / Smart Dictation Player v58 block is visible', video.legacyVisible.length === 0, video.legacyVisible);
    push('v60 next-gen UI raises no page errors', errors.length === 0, errors);
    await ctx.close();
  }

  {
    const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',r=>r.abort());
    await page.addInitScript(()=>{window.__SDP_QA__=true;window.__mountProbe={};document.addEventListener('DOMContentLoaded',()=>{window.__mountProbe.domReady=performance.now();requestAnimationFrame(()=>{window.__mountProbe.ready=!!document.querySelector('body[data-v61-ready="1"]');window.__mountProbe.delta=performance.now()-window.__mountProbe.domReady;window.__mountProbe.opacity=getComputedStyle(document.getElementById('app')).opacity;});});});
    await page.goto(base+'/index.html');await page.waitForFunction(()=>window.__mountProbe.ready===true);
    const mount=await page.evaluate(()=>Object.assign({},window.__mountProbe,{styles:document.querySelectorAll('style').length,legacy:!!document.querySelector('#sdpV57Css,#sdpV58Css,#sdpNextGenCss'),bar:(()=>{const e=document.querySelector('.topbar'),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {top:r.top,height:r.height,blur:s.backdropFilter,children:Array.from(e.children).map(n=>n.id)};})(),credit:['creditFoot','creditDocked'].map(id=>getComputedStyle(document.getElementById(id)).position)}));
    push('v61 FOUC: mount keyed before first frame, one static stylesheet',mount.ready&&mount.delta<=50&&mount.opacity==='1'&&mount.styles<=2&&!mount.legacy,mount);
    push('v61 solid 56px topbar has exactly the brand and action clusters',mount.bar.top===0&&mount.bar.height<=56&&mount.bar.blur==='none'&&mount.bar.children.join(',')==='sdpBrandCluster,sdpTopActions',mount.bar);
    push('v61 footer credits never cover controls',mount.credit.every(x=>x==='static'),mount.credit);
    const words=await page.evaluate(()=>{document.getElementById('tab-dict').click();return Array.from(document.querySelectorAll('#dictList .sdp-word-card')).map(n=>n.getBoundingClientRect().height);});
    push('v61 Words synchronously renders 30 full-field cards',words.length===30&&words.every(h=>h>50),{count:words.length,minHeight:Math.min.apply(null,words)});
    const cockpit=await page.evaluate(()=>{document.getElementById('btnStart').click();const b=document.querySelector('.layer.player .lbody');return {card:!!document.getElementById('sdpCockpitCard'),scroll:b?b.scrollTop:-1,grids:document.querySelectorAll('.ctrlgrid').length,children:b?Array.from(b.children).map(n=>n.id):[]};});
    push('v61 Start opens one cockpit directly with zero scroll-yank',cockpit.card&&cockpit.scroll===0&&cockpit.grids===0&&cockpit.children.join(',')==='sdpCockpitCard,sdpCockpitCounters,sdpWordMapCard',cockpit);
    await page.waitForTimeout(300);
    const voice=await page.evaluate(async()=>{window.SDPCore.Eng.stop(true);window.SDPCore.UI.setTab('set');let args=null;const say=window.SDPCore.Speech.say;window.SDPCore.Speech.say=function(items,opt,cb){args=items;return say.call(this,items,opt,cb);};document.getElementById('sdpTestVoice').click();await new Promise(r=>setTimeout(r,150));return {array:Array.isArray(args),text:args&&args[0],errors:document.querySelectorAll('#toasts .toast.bad,#toasts .toast.error').length};});
    push('v61 Test voice passes a whole sentence array, zero error toasts',voice.array&&voice.text==='This is Alice, your UK English dictation voice.'&&voice.errors===0,voice);
    push('v61 single-UI browser flow has zero page errors',errors.length===0,errors);
    await ctx.close();
  }

  await browser.close(); await new Promise(r => server.close(r));
  console.log(JSON.stringify(results, null, 2));
  for (const r of results) if (r.status === 'FAIL') console.log('::error::' + r.test + ' :: ' + JSON.stringify(r.detail || '').slice(0, 600));
  if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
})().catch(e => { console.error(e); console.log('::error::' + String(e && e.stack || e).replace(/\r?\n/g, ' | ').slice(0, 900)); process.exit(1); });
