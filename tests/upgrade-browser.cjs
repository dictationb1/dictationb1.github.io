'use strict';
/* v57 / 6.3.0 Chromium upgrade gate. No live internet: every external request is
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
      credit: !!document.getElementById('credit'), depot: !!document.getElementById('sdpV56'),
      overflow: !!document.getElementById('topOverflow'), lang: !!document.getElementById('btnLang'), data: !!document.getElementById('topDataBadge'),
      mixer: !!document.getElementById('materialMixer'), meter: !!window.SDPDataMeter
    }));
    push('v57 boots Static Gradient with a three-control header and no fake depot/credit/mixer', state.static && !state.videoSrc && !state.credit && !state.depot && state.overflow && state.lang && state.data && !state.mixer && state.meter && errors.length === 0, Object.assign({ errors }, state));
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
      return { lo, hi, max: document.getElementById('sVideoDim').max };
    });
    push('v57 dimmer is 0-100 and shows a real WCAG contrast warning', dim.max === '100' && /warning/.test(dim.lo) && /readable/.test(dim.hi), dim);
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

  await browser.close(); await new Promise(r => server.close(r));
  console.log(JSON.stringify(results, null, 2));
  for (const r of results) if (r.status === 'FAIL') console.log('::error::' + r.test + ' :: ' + JSON.stringify(r.detail || '').slice(0, 600));
  if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
})().catch(e => { console.error(e); console.log('::error::' + String(e && e.stack || e).replace(/\r?\n/g, ' | ').slice(0, 900)); process.exit(1); });
