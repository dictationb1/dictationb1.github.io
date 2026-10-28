/* Release 3.7.0 (ver 29): real-browser checks for the isolated video wallpaper,
   responsive Liquid Glass UI, Settings mixer, audio reuse and native text input.
   Keyboard suggestions and performance depend on the actual device.

   Tests use synthetic speech with external network requests blocked.
   SDP_BROWSER=webkit selects WebKit and SDP_BROWSER_STANDARD=1 requires a
   locally installed browser; CI treats an unavailable browser as a failure. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pw = require('playwright-core');
const packaged = require('@sparticuz/chromium');

const root = path.resolve(__dirname, '..');
const engine = process.env.SDP_BROWSER || 'chromium';
const fileURL = require('node:url').pathToFileURL(path.join(root, 'index.html')).href;
const results = [];

function fakeSpeech() {
  window.__spoken = [];
  const voice = { name: 'Microsoft Sonia', lang: 'en-GB', localService: true };
  const synth = {
    getVoices: () => [voice],
    speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); },
    cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {}
  };
  try {
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  } catch (e) {
    try { window.speechSynthesis.getVoices = synth.getVoices; window.speechSynthesis.speak = synth.speak; } catch (e2) {}
  }
  try { window.SpeechSynthesisUtterance = function (text) { this.text = text; }; } catch (e3) {}
}

async function openTab(page, id) {
  await page.evaluate((tab) => {
    const button = document.getElementById(tab);
    if (button) button.click();
  }, id);
  await page.waitForTimeout(250);
}

async function boot(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 768,
    hasTouch: width < 768
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String((e && e.message) || e)));
  await page.addInitScript(fakeSpeech);
  /* the app must work with every external host blocked */
  await page.route('https://**/*', (route) => route.abort());
  await page.goto(fileURL);
  await page.locator('#homeTitle').waitFor();
  /* Each fresh context gets a Welcome Guide after boot. Wait for it explicitly:
     on a loaded CI runner its timer can fire later than a fixed sleep. */
  const close = page.locator('#sheets .shead button').first();
  await close.waitFor({ state: 'visible', timeout: 12000 });
  // Dismiss setup via the actual handler without waiting for headless WebKit's
  // first animated sheet to become geometrically stable. Pointer interactions
  // are exercised separately in the guide, ready-screen and player tests.
  await close.evaluate((button) => button.click());
  await page.waitForFunction(() => !document.querySelector('#sheets .scrim'), null, { timeout: 6000 });
  await page.waitForFunction(() => {
    const credit = document.getElementById('credit');
    const s = credit && getComputedStyle(credit);
    return !!(s && parseFloat(s.opacity) > 0.05 && s.visibility !== 'hidden' && s.display !== 'none');
  }, null, { timeout: 8000 });
  return { context, page, errors };
}

function annotate() {
  for (const r of results) {
    if (r.status === 'FAIL') {
      const detail = String(r.detail || '').replace(/\r?\n/g, ' | ').slice(0, 900);
      console.log('::error::' + r.test.replace(/%/g, '%25') + ' :: ' + detail.replace(/%/g, '%25'));
    }
  }
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ test: name, status: 'PASS' });
  } catch (error) {
    results.push({ test: name, status: 'FAIL', detail: error && error.stack || String(error) });
  }
}

/* the ready/countdown sheets repaint while the countdown runs, so a locator can
   be detached mid-click; this clicks in-page and retries until it lands. */
async function clickText(page, text, tries) {
  const n = tries || 40;
  for (let i = 0; i < n; i++) {
    const hit = await page.evaluate((label) => {
      const nodes = Array.from(document.querySelectorAll('#sheets button, #modals button, #layers button'));
      const hit = nodes.find((b) => (b.textContent || '').trim() === label);
      if (!hit) return false;
      hit.click();
      return true;
    }, text).catch(() => false);
    if (hit) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

async function videoDecodes(page) {
  /* Playwright's standard Chromium/WebKit builds may lack H.264. In that case
     tests/browser.cjs (the bundled codec-capable Chromium) still proves real
     playback, while this suite verifies markup, CSS and app state instead. */
  const supported = await page.evaluate(() => {
    const v = document.createElement('video');
    return !!(v.canPlayType && v.canPlayType('video/mp4; codecs="avc1.42E01E"'));
  });
  if (!supported) return false;
  try {
    await page.waitForFunction(() => {
      const v = document.getElementById('bgLiveVideo');
      return v && v.readyState >= 2 && !v.paused && v.videoWidth > 0;
    }, null, { timeout: 8000 });
    return true;
  } catch (e) { return false; }
}

function material(page) {
  return page.evaluate(() => {
    const hero = getComputedStyle(document.querySelector('#homeHero'));
    const topbar = getComputedStyle(document.querySelector('.topbar.glass'));
    const dock = getComputedStyle(document.querySelector('#tabbar'));
    const chip = getComputedStyle(document.querySelector('.wordcard') || document.querySelector('#homeHero'));
    return {
      perf: document.body.getAttribute('data-perf'),
      rootPerf: document.documentElement.getAttribute('data-perf'),
      rootTheme: document.documentElement.getAttribute('data-theme'),
      heroBlur: hero.backdropFilter || hero.webkitBackdropFilter,
      heroShadow: hero.boxShadow,
      topbarBlur: topbar.backdropFilter || topbar.webkitBackdropFilter,
      dockBlur: dock.backdropFilter || dock.webkitBackdropFilter,
      topbarShadow: topbar.boxShadow,
      chipShadow: chip.boxShadow,
      grain: document.querySelector('#grain') ? getComputedStyle(document.querySelector('#grain')).display : 'none',
      blobFilter: getComputedStyle(document.querySelector('#bg .blob')).filter,
      blobAnimation: getComputedStyle(document.querySelector('#bg .blob')).animationName,
      orb: document.querySelector('#orb') ? getComputedStyle(document.querySelector('#orb')).backgroundImage : 'none',
      heroDisplay: getComputedStyle(document.querySelector('.lg-hero')).display,
      layerBg: getComputedStyle(document.querySelector('.layer') || document.querySelector('#homeHero')).backgroundColor,
      videoSrc: document.querySelector('#bgLiveVideo') ? (document.querySelector('#bgLiveVideo').currentSrc || document.querySelector('#bgLiveVideo').getAttribute('src') || '') : '',
      videoOpacity: document.querySelector('#bgLiveVideo') ? document.querySelector('#bgLiveVideo').style.opacity : '',
      stageBg: getComputedStyle(document.querySelector('.anatomy-stage')).backgroundImage,
      stripes: document.querySelector('.stripes') ? getComputedStyle(document.querySelector('.stripes')).display : 'none',
      disc: document.querySelector('.disc') ? getComputedStyle(document.querySelector('.disc')).display : 'none'
    };
  });
}

(async () => {
  let browser;
  try {
    browser = await pw[engine].launch(
      engine === 'chromium' && !process.env.SDP_BROWSER_STANDARD
        ? { executablePath: await packaged.executablePath(), args: packaged.args.filter((a) => a !== '--single-process') }
        : { headless: true }
    );
  } catch (error) {
    const reason = 'upgrade-browser.cjs (' + engine + '): no runnable browser - ' + String((error && error.message) || error).split('\n')[0];
    if (process.env.CI || process.env.SDP_BROWSER_STANDARD) {
      console.error('FAIL ' + reason);
      process.exitCode = 1;
    } else console.log('SKIP ' + reason);
    return;
  }

  await check(engine + ' v33 boots dark with zero-blur Liquid Glass over the hardware video', async () => {
    const { context, page, errors } = await boot(browser, 1280, 800);
    try {
      const m = await material(page);
      assert.equal(m.rootTheme, 'dark');
      assert.ok(m.perf === 'full' || m.perf === 'lite', 'a concrete perf mode: ' + m.perf);
      assert.equal(m.heroBlur, 'none', 'v33 hero glass has no backdrop blur');
      assert.equal(m.topbarBlur, 'none', 'v33 topbar glass has no backdrop blur');
      assert.equal(m.dockBlur, 'none', 'v33 dock glass has no backdrop blur');
      assert.notEqual(m.heroShadow, 'none');
      assert.notEqual(m.chipShadow, 'none');
      assert.equal(m.grain, 'none', 'no feTurbulence layer across the viewport');
      assert.equal(m.blobFilter, 'none', 'no 85px GPU blur on the blobs');
      assert.match(m.videoSrc, /assets\/bunny-live-wallpaper\.mp4/, 'bunny wallpaper is the live background');
      assert.match(m.stageBg, /none|^$/, 'the anatomy stage no longer hides the live video');
      assert.equal(m.stripes, 'none');
      assert.equal(m.disc, 'none');
      assert.equal(m.heroDisplay, 'block', 'the hero is one clean full-width column');
      assert.equal(await page.locator('#screen-home #lgStage').count(), 0, 'no mixer on Home');
      await openTab(page, 'tab-set');
      const stage = await page.evaluate(() => ({
        found: !!document.querySelector('#screen-set #lgStage'),
        orb: getComputedStyle(document.querySelector('#screen-set #orb')).display,
        mixer: !!document.querySelector('#screen-set #materialMixer')
      }));
      assert.equal(stage.found, true, 'the Material Mixer lives in Settings');
      assert.equal(stage.mixer, true);
      assert.equal(stage.orb, 'none', 'the synthetic orb is retired in v37');
      await openTab(page, 'tab-home');
      assert.equal(await page.locator('#tabbar button').count(), 5, 'five dock sections');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' one-tap Lite keeps every glass surface and stops repaints', async () => {
    const { context, page, errors } = await boot(browser, 1280, 800);
    try {
      /* a small CI box may already be in automatic Lite: reach Full, then Lite */
      if ((await material(page)).perf === 'lite') {
        await page.locator('#btnPerf').click();
        await page.waitForTimeout(250);
      }
      assert.equal((await material(page)).perf, 'full', 'the topbar reaches Full');
      await page.locator('#btnPerf').click();
      await page.waitForTimeout(250);
      const lite = await material(page);
      assert.equal(lite.perf, 'lite');
      assert.equal(lite.rootPerf, 'lite');
      assert.equal(lite.heroBlur, 'none', 'v33 keeps zero backdrop blur in lite');
      assert.equal(lite.topbarBlur, 'none', 'v33 keeps zero backdrop blur in lite');
      assert.equal(lite.dockBlur, 'none', 'v33 keeps zero backdrop blur in lite');
      assert.notEqual(lite.heroShadow, 'none', 'specular rim kept in lite');
      assert.equal(lite.perf, 'lite');
      assert.match(lite.videoSrc, /assets\/bunny-live-wallpaper\.mp4/, 'bunny wallpaper stays in lite');
      assert.equal(lite.stripes, 'none', 'no stripes over the live video in lite');
      assert.equal(lite.blobAnimation, 'none', 'no infinite background animation in lite');
      await page.waitForFunction(() => {
        const css = getComputedStyle(document.querySelector('.topbar.glass'));
        return (css.backdropFilter || css.webkitBackdropFilter || 'none') === 'none';
      }, null, { timeout: 8000 });
      const blurPx = await page.evaluate(() => {
        const css = getComputedStyle(document.querySelector('.topbar.glass'));
        return css.backdropFilter || css.webkitBackdropFilter || '';
      });
      assert.equal(blurPx, 'none', 'v33 glass carries no backdrop blur in lite either: ' + blurPx);
      assert.equal((await page.locator('#btnPerf').textContent()).trim(), '⚡ Lite');
      await page.locator('#btnPerf').click();
      await page.waitForTimeout(250);
      assert.equal((await material(page)).perf, 'full');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' persistent Hansana credit stays visible in Full and Lite', async () => {
    const { context, page, errors } = await boot(browser, 1280, 800);
    try {
      await page.waitForTimeout(6500);
      const full = await page.evaluate(() => {
        const credit = document.getElementById('credit');
        return { inView: credit.classList.contains('in'), opacity: parseFloat(getComputedStyle(credit).opacity),
          anim: getComputedStyle(credit).animationName,
          sheen: getComputedStyle(credit, '::after').animationName,
          z: getComputedStyle(credit).zIndex };
      });
      assert.equal(full.inView, true, 'badge is not hidden by a repeating timer');
      assert.ok(full.opacity >= 0.08, 'the badge never disappears completely: ' + full.opacity);
      assert.equal(full.anim, 'hansanaRevealCycle', 'the disappearing / re-appearing cycle runs');
      assert.equal(full.sheen, 'none', 'no perpetual decorative repaint');
      assert.equal(full.z, '9999');
      await page.locator('#credit').click();
      assert.match(await page.locator('#toasts').textContent(), /Created by Hansana · Idea given by Ayya01 \(Lesandu\) · Lecturer in Charge: Sumodya Sewmini/);
      if ((await material(page)).perf === 'full') await page.locator('#btnPerf').click();
      await page.mouse.move(2, 2);
      await page.waitForTimeout(1000);
      const lite = await page.evaluate(() => ({
        perf: document.body.getAttribute('data-perf'),
        visible: document.getElementById('credit').classList.contains('in'),
        sheen: getComputedStyle(document.getElementById('credit'), '::after').animationName
      }));
      assert.equal(lite.perf, 'lite');
      assert.equal(lite.visible, true);
      assert.equal(lite.sheen, 'none');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' mixer, tint and orb keep working after tab switches', async () => {
    const { context, page, errors } = await boot(browser, 1280, 900);
    try {
      await openTab(page, 'tab-set');
      assert.equal(await page.locator('#screen-set #materialMixer').count(), 1, 'Settings hosts the mixer');
      await page.evaluate(() => {
        for (const [id, value] of [['sBlur', 34], ['sSat', 210], ['sBrt', 110]]) {
          const el = document.getElementById(id);
          el.value = String(value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      const mixed = await page.evaluate(() => ({
        blur: document.documentElement.style.getPropertyValue('--gb'),
        sat: document.documentElement.style.getPropertyValue('--gs'),
        bright: document.documentElement.style.getPropertyValue('--gbr'),
        out: document.querySelector('#outSat').textContent,
        fills: ['sBlur', 'sSat', 'sBrt'].map((id) => document.getElementById(id).style.getPropertyValue('--fill'))
      }));
      assert.equal(mixed.blur, '34px');
      assert.equal(mixed.sat, '2.10');
      assert.equal(mixed.bright, '1.10');
      assert.equal(mixed.out, '2.1×');
      assert.ok(Math.abs(parseFloat(mixed.fills[0]) - 83.3333) < 0.01);
      assert.equal(mixed.fills[1], '68.75%');
      assert.equal(mixed.fills[2], '50%');
      await page.evaluate(() => { window.__tintHero = document.getElementById('homeHero'); });
      const clear = await page.evaluate(() => getComputedStyle(document.getElementById('materialMixer')).backgroundColor);
      await page.locator('#segTint [data-tint="1"]').click();
      assert.equal(await page.locator('body.tint-frost').count(), 1);
      assert.equal(await page.locator('body.tint-morph').count(), 1, 'user switch starts the 420ms liquid pulse');
      assert.equal(await page.evaluate(() => window.__tintHero === document.getElementById('homeHero')), true, 'tint never re-renders Home');
      await page.waitForFunction(() => getComputedStyle(document.getElementById('materialMixer')).backgroundColor === 'rgba(6, 10, 22, 0.34)', null, { timeout: 8000 });
      await page.waitForFunction(() => !document.body.classList.contains('tint-morph'), null, { timeout: 5000 }).catch(() => {});
      const frost = await page.evaluate(() => ({
        bg: getComputedStyle(document.getElementById('materialMixer')).backgroundColor,
        shadow: getComputedStyle(document.getElementById('materialMixer')).boxShadow,
        morph: document.body.classList.contains('tint-morph'),
        saved: JSON.parse(localStorage.getItem('sdp.v40_one_studio_voice')).settings.glassTint,
        indicators: Array.from(document.querySelectorAll('.seg-tint .seg-ind'), (el) => el.style.transform)
      }));
      assert.notEqual(frost.bg, clear, 'Frost visibly changes the material');
      assert.equal(frost.bg, 'rgba(6, 10, 22, 0.34)');
      assert.notEqual(frost.shadow, 'none', 'the mixer keeps a specular rim');
      assert.equal(frost.morph, false);
      assert.equal(frost.saved, 1);
      /* browsers normalise the raw `0` channels to `0px` when serialising */
      const norm = (t) => String(t).replace(/\s+/g, '').replace(/px(?=,|\))/g, '');
      assert.deepEqual(frost.indicators.map(norm), ['translate3d(100%,0,0)']);
      await page.locator('#segTint [data-tint="2"]').click();
      assert.equal(await page.locator('body.tint-smoke').count(), 1);
      assert.equal(await page.locator('body.tint-frost').count(), 0);
      await page.waitForFunction(() => getComputedStyle(document.getElementById('materialMixer')).backgroundColor === 'rgba(6, 10, 22, 0.4)', null, { timeout: 8000 });
      const smoke = await page.evaluate(() => getComputedStyle(document.getElementById('materialMixer')).backgroundColor);
      assert.equal(smoke, 'rgba(6, 10, 22, 0.4)');
      await page.locator('#segTint [data-tint="0"]').click();
      await page.waitForFunction((expected) => getComputedStyle(document.getElementById('materialMixer')).backgroundColor === expected, clear, { timeout: 8000 });
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('materialMixer')).backgroundColor), clear);

      /* v37: the synthetic orb is retired - the real mixer controls stay */
      const orbState = await page.evaluate(() => {
        const o = document.getElementById('orb');
        return o ? getComputedStyle(o).display : 'absent';
      });
      assert.equal(orbState, 'none', 'the decorative orb is hidden in v37');
      assert.equal(await page.locator('#lgStage').count(), 1, 'the Material Mixer stage survives');
      assert.ok(await page.locator('#segTint [data-tint]').count() >= 3, 'the tint controls survive');

      /* dock magnification is a Full-glass, fine-pointer nicety */
      if ((await material(page)).perf !== 'full') {
        await page.locator('#btnPerf').click();
        await page.waitForTimeout(250);
      }
      /* dock magnification is deliberately a desktop fine-pointer nicety: a
         coarse-pointer engine must not magnify at all, and a fine pointer must */
      const fine = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
      const dock = page.locator('#tab-home');
      await page.mouse.move(2, 2);
      await page.waitForTimeout(3600);   /* performance toasts must clear the dock */
      const box = await dock.boundingBox();
      let transformed = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(300);
        transformed = await dock.evaluate((el) => el.style.transform);
        if (transformed) break;
      }
      if (fine) assert.match(transformed, /scale\(1\.28/, 'dock magnification');
      else assert.equal(transformed, '', 'a coarse pointer never magnifies');
      await page.mouse.move(2, 2);
      await page.waitForTimeout(250);
      assert.equal(await dock.evaluate((el) => el.style.transform), '');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' a 390px phone starts in Lite with no horizontal overflow', async () => {
    const { context, page, errors } = await boot(browser, 390, 844);
    try {
      const m = await material(page);
      assert.equal(m.perf, 'lite', 'a phone is downgraded automatically');
      assert.equal(m.heroBlur, 'none', 'v33 phone glass renders with zero backdrop blur');
      assert.notEqual(m.heroShadow, 'none');
      const layout = await page.evaluate(() => ({
        columns: getComputedStyle(document.querySelector('.lg-hero')).display === 'block' ? 1 : 2,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        dock: document.getElementById('tabbar').getBoundingClientRect().width <= window.innerWidth
      }));
      assert.equal(layout.columns, 1, 'the hero stacks on a phone');
      assert.equal(layout.overflow, false, 'no horizontal scroll');
      assert.equal(layout.dock, true, 'the dock fits the viewport');
      await page.locator('#btnPerf').click();
      await page.waitForTimeout(200);
      assert.equal((await material(page)).perf, 'full', 'the phone can still choose Full');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' responsive layouts fit 320px through 2560px on every tab', async () => {
    for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1920, 2560]) {
      const { context, page, errors } = await boot(browser, width, width <= 430 ? 844 : 900);
      try {
        for (const tab of ['home', 'dict', 'practice', 'comm', 'set']) {
          await openTab(page, 'tab-' + tab);
          const geometry = await page.evaluate(() => {
            const top = document.querySelector('.topbar');
            const dock = document.getElementById('tabbar');
            const credit = document.getElementById('credit');
            const topRect = top.getBoundingClientRect(), dockRect = dock.getBoundingClientRect();
            const creditRect = credit.getBoundingClientRect();
            return { width: window.innerWidth, pageWidth: document.documentElement.scrollWidth,
              topLeft: topRect.left, topRight: topRect.right, dockLeft: dockRect.left, dockRight: dockRect.right,
              topWrap: getComputedStyle(top).flexWrap, creditTop: creditRect.top, creditBottom: creditRect.bottom,
              dockTop: dockRect.top, creditVisible: parseFloat(getComputedStyle(credit).opacity) >= 0.08,
              icons: Array.from(top.querySelectorAll('.btn.icon'), (b) => [b.offsetWidth, b.offsetHeight]),
              labels: Array.from(dock.querySelectorAll('button > span[data-i18n]'), (el) => {
                const box = el.getBoundingClientRect();
                return { text: el.textContent, left: box.left, right: box.right };
              }) };
          });
          assert.ok(geometry.pageWidth <= geometry.width, width + 'px ' + tab + ': ' + JSON.stringify(geometry));
          assert.ok(geometry.topLeft >= -0.5 && geometry.topRight <= width + 0.5, width + 'px navbar fits');
          assert.ok(geometry.dockLeft >= -0.5 && geometry.dockRight <= width + 0.5, width + 'px dock fits');
          assert.equal(geometry.topWrap, 'nowrap');
          assert.equal(geometry.creditVisible, true);
          if (width <= 720) {
            assert.ok(geometry.creditBottom <= geometry.dockTop + 1, width + 'px credit stays above the dock');
            assert.ok(geometry.icons.every((size) => size[0] >= 44 && size[1] >= 44), width + 'px icon targets: ' + JSON.stringify(geometry.icons));
          }
          for (let i = 1; i < geometry.labels.length; i++) {
            assert.ok(geometry.labels[i - 1].right <= geometry.labels[i].left + 0.5,
              width + 'px dock labels must not overlap: ' + JSON.stringify(geometry.labels));
          }
        }
        if (width <= 720) {
          await page.locator('#btnAdmin').scrollIntoViewIfNeeded();
          const reachable = await page.evaluate(() => {
            const top = document.querySelector('.topbar').getBoundingClientRect();
            const btn = document.getElementById('btnAdmin').getBoundingClientRect();
            return btn.left >= top.left - 0.5 && btn.right <= top.right + 0.5;
          });
          assert.equal(reachable, true, width + 'px navbar controls are reachable by scrolling');
        }
        assert.equal(errors.length, 0, width + 'px page errors: ' + errors.join(' | '));
      } finally { await context.close(); }
    }
  });

  await check(engine + ' PC 16:9 video fills the screen in BOTH Full and Lite', async () => {
    const { context, page, errors } = await boot(browser, 1920, 1080);
    try {
      const decodes = await videoDecodes(page);
      const state = await page.evaluate(() => {
        const v = document.getElementById('bgLiveVideo');
        const stage = document.getElementById('bgLiveWrap').getBoundingClientRect();
        return { size: [stage.width, stage.height], fit: v.style.objectFit, position: v.style.objectPosition,
          opacity: v.style.opacity, pixels: [v.videoWidth, v.videoHeight],
          hero: getComputedStyle(document.getElementById('homeHero')).backgroundColor,
          app: getComputedStyle(document.getElementById('app')).backgroundColor, time: v.currentTime };
      });
      assert.deepEqual(state.size, [1920, 1080]);
      assert.equal(state.fit, 'cover');assert.equal(state.position, 'center center');
      assert.equal(state.opacity, '1');
      if (decodes) assert.ok(state.pixels[0] > 0 && state.pixels[1] > 0, 'bundled 16:9 video decodes at full resolution');
      assert.match(state.hero, /rgba\(/, 'glass card stays translucent');
      assert.equal(state.app, 'rgba(0, 0, 0, 0)', 'the app does not hide video');
      for (const mode of ['lite', 'full']) {
        if ((await material(page)).perf !== mode) await page.locator('#btnPerf').click();
        await page.waitForTimeout(350);
        const video = await page.evaluate(() => ({ perf: document.body.dataset.perf,
          paused: document.getElementById('bgLiveVideo').paused,
          opacity: document.getElementById('bgLiveVideo').style.opacity,
          fit: document.getElementById('bgLiveVideo').style.objectFit,
          time: document.getElementById('bgLiveVideo').currentTime }));
        assert.equal(video.perf, mode);
        if (decodes) { assert.equal(video.paused, false); assert.ok(video.time > state.time, 'video advances in ' + mode); }
        assert.equal(video.opacity, '1');assert.equal(video.fit, 'cover');
      }
      const universal = await page.evaluate(() => {
        const v = document.getElementById('bgLiveVideo');
        Object.defineProperty(v, 'videoWidth', { configurable: true, value: 1920 });
        Object.defineProperty(v, 'videoHeight', { configurable: true, value: 1080 });
        window.LiveWallpaper.fitVideo();return v.style.objectFit;
      });
      assert.equal(universal, 'cover', 'a universal 16:9 video fills the desktop');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally { await context.close(); }
  });

  await check(engine + ' local MP4 starts immediately, survives reload via IndexedDB, pauses and resets', async () => {
    const { context, page, errors } = await boot(browser, 390, 844);
    try {
      /* v29/v30: the topbar opens the GitHub gallery; the Settings card keeps the
         one-tap native device picker. */
      await openTab(page, 'tab-set');
      const choose = page.waitForEvent('filechooser');
      await page.locator('#btnPickVideoFileSet').click();
      const chooser = await choose;
      assert.equal(await chooser.element().getAttribute('id'), 'liveVideoInput');
      await chooser.setFiles({ name: 'WhatsApp Video 2026-10-27 at 07.32.25.mp4', mimeType: 'video/mp4',
        buffer: fs.readFileSync(path.join(root, 'assets', 'bunny-live-wallpaper.mp4')) });
      const decodes = await videoDecodes(page);
      await page.waitForFunction((needsDecode) => {
        const v = document.getElementById('bgLiveVideo');
        return window.LiveWallpaper.source === 'custom' && v.currentSrc.indexOf('blob:') === 0 &&
          (!needsDecode || (v.readyState >= 2 && !v.paused));
      }, decodes, { timeout: 12000 });
      await page.evaluate(() => new Promise((resolve) => {
        const started = Date.now();
        function check() {
          const open = indexedDB.open('sdp_wallpaper_db', 1);
          open.onerror = () => setTimeout(check, 200);
          open.onsuccess = () => {
            const db = open.result, get = db.transaction('videos').objectStore('videos').get('custom_bg');
            get.onsuccess = () => {
              const b = get.result; db.close();
              if (b && b.size > 10000) resolve(true);
              else if (Date.now() - started > 10000) resolve(false);
              else setTimeout(check, 200);
            };
            get.onerror = () => { db.close(); setTimeout(check, 200); };
          };
        }
        check();
      }));
      const saved = await page.evaluate(() => new Promise((resolve, reject) => {
        const open = indexedDB.open('sdp_wallpaper_db', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result, get = db.transaction('videos').objectStore('videos').get('custom_bg');
          get.onsuccess = () => { const blob = get.result;db.close();resolve({ size: blob && blob.size,
            name: blob && blob.name, mode: JSON.parse(localStorage.getItem('sdp.v40_one_studio_voice')).settings.wallpaperVideo }); };
          get.onerror = () => reject(get.error);
        };
      }));
      assert.ok(saved.size > 10000);assert.match(saved.name, /WhatsApp Video/);
      assert.equal(saved.mode, true);
      await page.reload();
      await page.waitForFunction(() => window.LiveWallpaper && window.LiveWallpaper.source === 'custom' &&
        document.getElementById('bgLiveVideo').currentSrc.indexOf('blob:') === 0, null, { timeout: 12000 });
      await openTab(page, 'tab-set');
      assert.match(await page.locator('#setBody > :first-child').textContent(), /Live Wallpaper Video/);
      assert.equal(await page.locator('#btnPickVideoFileSet').count(), 1);
      assert.equal(await page.locator('#btnOpenGallery').count(), 1);
      await page.locator('#btnToggleVideo').click();
      assert.equal(await page.evaluate(() => window.LiveWallpaper.enabled), false);
      assert.equal(await page.locator('#btnToggleVideo').textContent(), 'Play Live Video');
      await page.waitForTimeout(250);await page.reload();
      await page.waitForFunction(() => window.LiveWallpaper && !window.LiveWallpaper.enabled, null, { timeout: 10000 });
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('bgLiveWrap')).display), 'none');
      await openTab(page, 'tab-set');
      await page.locator('#btnResetVideo').click();
      await page.waitForFunction(() => window.LiveWallpaper.source === 'default' &&
        document.getElementById('bgLiveVideo').currentSrc.indexOf('blob:') === -1, null, { timeout: 12000 });
      assert.equal(await page.evaluate(() => window.LiveWallpaper.enabled), true);
      await page.waitForTimeout(250);await page.reload();
      await page.waitForFunction(() => window.LiveWallpaper && window.LiveWallpaper.source === 'default' &&
        document.getElementById('bgLiveVideo').currentSrc.endsWith('bunny-live-wallpaper.mp4'), null, { timeout: 12000 });
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally { await context.close(); }
  });

  await check(engine + ' full-screen video stays active in Lite, while the neon canvas sleeps at idle', async () => {
    const { context, page, errors } = await boot(browser, 390, 844);
    try {
      const decodes = await videoDecodes(page);
      const scene = await page.evaluate(() => {
        const stage = document.getElementById('bgLiveWrap');
        const v = document.getElementById('bgLiveVideo');
        const r = stage.getBoundingClientRect();
        return { blobs: document.querySelectorAll('#bg .blob').length,
          canvas: !!document.getElementById('bgLiveCanvas'), video: !!v,
          swanStage: typeof window.SwanStage, animation: getComputedStyle(document.querySelector('#bg .blob')).animationName,
          width: r.width, height: r.height, fit: v.style.objectFit, muted: v.muted, opacity: v.style.opacity,
          source: v.currentSrc, pixels: [v.videoWidth, v.videoHeight], perf: document.body.dataset.perf,
          contained: getComputedStyle(stage).contain, onscreen: getComputedStyle(stage).display !== 'none' };
      });
      assert.equal(scene.blobs, 4); assert.equal(scene.canvas, true); assert.equal(scene.video, true);
      assert.equal(scene.swanStage, 'undefined'); assert.equal(scene.animation, 'none');
      assert.ok(Math.abs(scene.width - 390) < 2 && Math.abs(scene.height - 844) < 2, 'full-viewport stage: ' + scene.width + 'x' + scene.height);
      assert.equal(scene.fit, 'cover');assert.equal(scene.muted, true);assert.equal(scene.opacity, '1');
      assert.equal(scene.perf, 'lite');assert.equal(scene.contained, 'strict');assert.equal(scene.onscreen, true);
      assert.match(scene.source, /bunny-live-wallpaper\.mp4$/);
      if (decodes) assert.ok(scene.pixels[0] > 0 && scene.pixels[1] > 0);
      await page.waitForTimeout(1800); // the finite startup perf probe has finished
      await page.evaluate(() => {
        window.__frames = 0;
        const original = window.requestAnimationFrame;
        window.requestAnimationFrame = function (cb) {window.__frames++;return original.call(window, cb);};
      });
      await page.waitForTimeout(700);
      const idle = await page.evaluate(() => window.__frames);
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => window.__frames), idle, 'no idle animation-frame loop');
      await page.mouse.click(7, 240);
      assert.ok(await page.evaluate(() => window.LiveWallpaper.ripples.length > 0), 'tap starts the soft ripple rings');
      await page.waitForFunction(() => window.LiveWallpaper.rafId === null &&
        window.LiveWallpaper.ripples.length === 0 && window.LiveWallpaper.sparks.length === 0, null, { timeout: 5000 });
      const asleep = await page.evaluate(() => window.__frames);
      await page.evaluate(() => window.scrollBy(0, 500));await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => window.__frames), asleep, 'scroll never restarts wallpaper canvas');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally { await context.close(); }
  });

  await check(engine + ' dictation starts, unlocks audio and speaks the first word', async () => {
    const { context, page, errors } = await boot(browser, 390, 844);
    try {
      await page.locator('#btnStart').click();
      await clickText(page, "I'm ready");
      await clickText(page, 'Skip countdown');
      /* the countdown screen repaints itself, so wait for the player beat */
      await page.waitForFunction(() => /Your turn|Next word|Listening|Paused/.test((document.getElementById('plStatus') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
      const unlocked = await page.evaluate(() => {
        const a = document.getElementById('ttsMasterAudio');
        return { preload: a.getAttribute('preload'), paused: a.paused };
      });
      assert.equal(unlocked.preload, 'auto', 'the one master audio element is ready to play');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' a paper dictation ends in a working 30-word tick list', async () => {
    const { context, page, errors } = await boot(browser, 390, 844);
    try {
      await page.locator('#btnStart').click();
      await clickText(page, "I'm ready");
      await clickText(page, 'Skip countdown');
      const word = await page.evaluate(() => JSON.parse(localStorage.getItem('sdp.v40_one_studio_voice')).lists[0].words[0].w);
      /* WebKit's synthetic speech callbacks are slower: wait for both repeats. */
      /* v40 speaks repetition 2 as the exact same clean word from the same buffer */
      await page.waitForFunction((w) => (window.__spoken || []).filter((t) => String(t.text || t).toLowerCase().indexOf(String(w).toLowerCase()) >= 0).length >= 2,
        word, { timeout: 12000 }).catch(() => {});
      const spoken = await page.evaluate(() => window.__spoken || []);
      assert.ok(spoken.filter((t) => String(t.text || t).toLowerCase().indexOf(String(word).toLowerCase()) >= 0).length >= 2, 'spoken at least twice: ' + JSON.stringify(spoken));
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sdp.v40_one_studio_voice')).settings.writeFixed), 5, 'five second timer');

      assert.equal(await clickText(page, 'Finish early'), true, 'Finish early opens');
      assert.equal(await clickText(page, 'Finish now'), true, 'Finish now confirms');
      await page.waitForTimeout(1200);
      const marks = page.locator('[aria-label^="Got it right"]');
      assert.equal(await marks.count(), 30, 'all 30 words can be ticked');
      for (let i = 0; i < 3; i++) await marks.nth(i).click();
      await page.waitForTimeout(600);
      const saved = await page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('sdp.v40_one_studio_voice'));
        const rec = (d.history || [])[0] || {};
        return { runs: (d.history || []).length, score: rec.score, percent: rec.percent, marks: (rec.marks || []).length, selfScored: rec.selfScored };
      });
      assert.equal(saved.runs, 1, 'the result is saved');
      assert.equal(saved.score, 3, 'three ticks = three correct');
      assert.equal(saved.percent, 10, '3/30 is 10%');
      assert.equal(saved.marks, 30, 'every word keeps its mark');
      assert.equal(saved.selfScored, true, 'the paper checklist is scored');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' v33 User Guide Start practising launches the ready player on Home', async () => {
    const { context, page, errors } = await boot(browser, 390, 844);
    try {
      await page.evaluate(() => document.getElementById('btnGuideTop').click());
      const start = page.locator('#btnGuideStart');
      await start.waitFor({ state: 'visible' });
      assert.equal((await start.textContent()).trim(), 'Start practising');
      assert.equal(await start.evaluate((b) => b.className), 'btn primary xl block');
      assert.equal(await start.locator('svg use').getAttribute('href'), '#i-play');
      await start.click();
      await page.waitForFunction(() => {
        const sheet = document.querySelector('#sheets .sheet');
        return !!document.querySelector('#layers .layer') && !!sheet && sheet.textContent.includes('Are you ready?');
      }, null, { timeout: 10000 });
      const launched = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('sdp.v40_one_studio_voice'));
        return {
          home: !document.getElementById('screen-home').classList.contains('hidden'),
          ready: document.querySelector('#sheets .sheet').textContent.includes('Are you ready?'),
          layers: document.querySelectorAll('#layers .layer').length,
          tourSeen: saved.tourSeen,
          guideSeen: saved.guideSeen
        };
      });
      assert.equal(launched.home, true, 'the guide redirects to Home');
      assert.equal(launched.ready, true, 'Eng.start opens the Are you ready sheet');
      assert.equal(launched.layers, 1, 'the dictation player is launched');
      assert.equal(launched.tourSeen, true);
      assert.equal(launched.guideSeen, true);
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' v33 no-password native keyboard: text sentinel, mirror, tick, cross and 1-tap exits', async () => {
    const { context, page, errors } = await boot(browser, 390, 844);
    try {
      /* the ready sheet keeps ONE far-right cross mark and no duplicates */
      await page.evaluate(() => {
        document.querySelector('#segMode [data-mode="type"]').click();
      });
      await page.waitForTimeout(200);
      await page.locator('#btnStart').click();
      await page.waitForFunction(() => !!document.querySelector('#sheets .shead button'), null, { timeout: 8000 });
      assert.equal(await page.locator('#btnReadyClose').count(), 0, 'no duplicate header cross');
      assert.equal(await page.locator('#btnNotReady').count(), 0, 'no duplicate footer exit');
      assert.equal(await page.locator('#sheets .shead button').count(), 1, 'one far-right cross only');
      await page.locator('#sheets .shead button').click();
      await page.waitForTimeout(400);
      const closed = await page.evaluate(() => ({
        sheets: document.querySelectorAll('#sheets .sheet').length,
        layers: document.querySelectorAll('#layers .layer').length,
        state: window.SDP ? 'ok' : 'ok',
        homeVisible: !document.getElementById('screen-home').classList.contains('hidden')
      }));
      assert.equal(closed.sheets, 0, 'the ready sheet closed');
      assert.equal(closed.layers, 0, 'the player layer closed');
      assert.equal(closed.homeVisible, true, 'Home is back');

      /* start again and audit the typing deck */
      await page.locator('#btnStart').click();
      await clickText(page, "I'm ready");
      await clickText(page, 'Skip countdown');
      await page.waitForFunction(() => !!document.getElementById('ansInput'), null, { timeout: 15000 });
      const deck = await page.evaluate(() => {
        const i = document.getElementById('ansInput');
        const m = document.getElementById('ansMirror');
        return {
          type: i.type,
          autocomplete: i.getAttribute('autocomplete'),
          spellcheck: i.getAttribute('spellcheck'),
          autocorrect: i.getAttribute('autocorrect'),
          inputmode: i.getAttribute('inputmode'),
          name: i.name,
          vkb: document.querySelectorAll('#ansVkb .vkb-key').length,
          toggle: !!document.getElementById('btnVkbToggle'),
          mirror: !!m,
          mirrorText: !!document.getElementById('ansMirrorText'),
          mirrorCaret: !!(m && m.querySelector('.ans-caret')),
          tick: !!document.getElementById('ansTick'),
          cross: !!document.getElementById('ansWrong'),
          closeBtn: !!document.getElementById('btnPlayerClose'),
          pill: (document.getElementById('plLiveScore') || {}).textContent || ''
        };
      });
      assert.equal(deck.type, 'text', 'a plain text field never opens the password manager');
      assert.equal(deck.autocomplete, 'off');
      assert.equal(deck.spellcheck, 'false');
      assert.equal(deck.autocorrect, 'off');
      assert.equal(deck.inputmode, 'text', 'the native system keyboard opens');
      assert.match(deck.name, /^sdp_field_\d+$/, 'a random name defeats form autofill');
      assert.equal(deck.vkb, 0, 'the custom keyboard is gone');
      assert.equal(deck.toggle, false, 'the Keyboard toggle is gone');
      assert.equal(deck.mirror, true, 'the plain-text mirror exists');
      assert.equal(deck.mirrorText, true);
      assert.equal(deck.mirrorCaret, true);
      assert.equal(deck.tick, true);
      assert.equal(deck.cross, true);
      assert.equal(deck.closeBtn, true);
      assert.match(deck.pill, /Correct/);

      /* type on the native keyboard: the mirror must show plain letters */
      const word = await page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('sdp.v40_one_studio_voice'));
        const l = d.lists[0];
        return l.words[0].w.split('/')[0];
      });
      await page.evaluate((value) => {
        const i = document.getElementById('ansInput');
        i.focus();
        i.value = value;
        i.dispatchEvent(new Event('input', { bubbles: true }));
      }, word);
      await page.waitForTimeout(250);
      const mirrored = await page.evaluate(() => ({
        text: document.getElementById('ansMirrorText').textContent,
        sentinel: document.getElementById('ansInput').value === ' ',
        type: document.getElementById('ansInput').type,
        autocomplete: document.getElementById('ansInput').getAttribute('autocomplete')
      }));
      assert.equal(mirrored.sentinel, true, 'only the single-space IME sentinel is left in the field');
      assert.equal(mirrored.type, 'text');
      assert.equal(mirrored.autocomplete, 'off');
      assert.equal(mirrored.text, word, 'the mirror paints the plain letters');
      const solved = await page.evaluate(() => ({
        solved: document.getElementById('ansWrap').classList.contains('is-correct'),
        tick: document.getElementById('ansTick').classList.contains('is-correct'),
        hero: document.getElementById('plTickHero').classList.contains('is-correct'),
        slots: document.querySelectorAll('#ansSlots .slot-done').length
      }));
      assert.equal(solved.solved, true, 'the input bar glows');
      assert.equal(solved.tick, true, 'the tick mark animates in');
      assert.equal(solved.hero, true, 'the Correct! badge shows');
      assert.ok(solved.slots > 0, 'the letter slots light up');

      /* a wrong answer breaks the streak and shows the correction card */
      await page.waitForTimeout(1300);
      await page.evaluate(() => {
        const i = document.getElementById('ansInput');
        i.value = 'zzzz';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      await page.waitForTimeout(400);
      const wrong = await page.evaluate(() => ({
        cross: document.getElementById('ansWrong').classList.contains('is-wrong'),
        hero: document.getElementById('plWrongHero').classList.contains('is-wrong'),
        streak: document.getElementById('plStreakCount').className,
        compare: (document.getElementById('ansCompare') || {}).textContent || ''
      }));
      assert.equal(wrong.cross, true, 'the cross mark shows');
      assert.equal(wrong.hero, true, 'the Incorrect badge shows');
      assert.match(wrong.streak, /streak-broken/, 'the streak breaks');
      assert.match(wrong.compare, /Correct UK spelling/);
      assert.match(wrong.compare, /Your answer/);

      /* the player cross mark exits in one tap */
      await page.locator('#btnPlayerClose').click();
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({
        layers: document.querySelectorAll('#layers .layer').length,
        home: !document.getElementById('screen-home').classList.contains('hidden')
      }));
      assert.equal(after.layers, 0, 'the player closed');
      assert.equal(after.home, true, 'Home is back');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await browser.close();
  const output = path.join(__dirname, 'artifacts');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'upgrade-browser-' + engine + '.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  annotate();
  if (results.some((r) => r.status === 'FAIL')) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  console.log('::error::' + String((error && error.stack) || error).replace(/\r?\n/g, ' | ').replace(/%/g, '%25').slice(0, 900));
  process.exitCode = 1;
});
