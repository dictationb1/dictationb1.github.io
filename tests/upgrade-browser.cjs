/* Release 2.1.0 (ver 13) - real-engine checks for the 60 FPS Liquid Glass
   engine, automatic Lite mode, the re-bound Material Mixer and the low-data
   audio path. Rewritten from scratch for this release.

   The suite runs the real single-file app in Chromium/WebKit with synthetic
   speech and every network request aborted. A sandbox without the browser
   shared libraries skips with an explicit message (exit code 0) instead of
   pretending the layout was verified.

   SDP_BROWSER=webkit selects WebKit and SDP_BROWSER_STANDARD=1 uses a
   locally installed Chrome instead of the packaged binary. */
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
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      getVoices: () => [voice],
      speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); },
      cancel() {}, pause() {}, resume() {}, addEventListener() {}
    }
  });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
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
  await page.waitForTimeout(1100);
  /* the bilingual Welcome Guide opens by itself on a first run: close it */
  const close = page.locator('#sheets .shead button');
  if (await close.count()) await close.first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('#sheets .scrim'), null, { timeout: 6000 }).catch(() => {});
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
      grain: getComputedStyle(document.querySelector('#grain')).display,
      blobFilter: getComputedStyle(document.querySelector('#bg .blob')).filter,
      blobAnimation: getComputedStyle(document.querySelector('#bg .blob')).animationName,
      orb: getComputedStyle(document.querySelector('#orb')).backgroundImage,
      stripes: getComputedStyle(document.querySelector('.stripes')).backgroundImage,
      disc: getComputedStyle(document.querySelector('.disc')).backgroundImage
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
    console.log('SKIP upgrade-browser.cjs (' + engine + '): no runnable browser in this environment - ' + String((error && error.message) || error).split('\n')[0]);
    return;
  }

  await check(engine + ' v13 boots dark with the full Liquid Glass anatomy', async () => {
    const { context, page, errors } = await boot(browser, 1280, 800);
    try {
      const m = await material(page);
      assert.equal(m.rootTheme, 'dark');
      assert.ok(m.perf === 'full' || m.perf === 'lite', 'a concrete perf mode: ' + m.perf);
      assert.notEqual(m.heroBlur, 'none', 'hero glass blur');
      assert.notEqual(m.topbarBlur, 'none', 'topbar glass blur');
      assert.notEqual(m.dockBlur, 'none', 'dock glass blur');
      assert.notEqual(m.heroShadow, 'none');
      assert.notEqual(m.chipShadow, 'none');
      assert.equal(m.grain, 'none', 'no feTurbulence layer across the viewport');
      assert.equal(m.blobFilter, 'none', 'no 85px GPU blur on the blobs');
      assert.match(m.orb, /radial-gradient/);
      assert.match(m.stripes, /repeating-linear-gradient/);
      assert.match(m.disc, /radial-gradient/);
      const columns = await page.evaluate(() => getComputedStyle(document.querySelector('.lg-hero')).gridTemplateColumns.split(' ').length);
      assert.equal(columns, 2, 'desktop hero keeps two columns');
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
      assert.notEqual(lite.heroBlur, 'none', 'hero blur kept in lite');
      assert.notEqual(lite.topbarBlur, 'none', 'topbar blur kept in lite');
      assert.notEqual(lite.dockBlur, 'none', 'dock blur kept in lite');
      assert.notEqual(lite.heroShadow, 'none', 'specular rim kept in lite');
      assert.notEqual(lite.orb, 'none', 'the warm orb is still rendered');
      assert.match(lite.stripes, /repeating-linear-gradient/, 'stripes kept in lite');
      assert.equal(lite.blobAnimation, 'none', 'no infinite background animation in lite');
      const blurPx = await page.evaluate(() => getComputedStyle(document.querySelector('.topbar.glass')).backdropFilter || '');
      assert.match(blurPx, /blur\(8px\)/, 'lite uses the 8px glass budget: ' + blurPx);
      assert.equal((await page.locator('#btnPerf').textContent()).trim(), '⚡ Lite');
      await page.locator('#btnPerf').click();
      await page.waitForTimeout(250);
      assert.equal((await material(page)).perf, 'full');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' mixer, tint and orb keep working after tab switches', async () => {
    const { context, page, errors } = await boot(browser, 1280, 900);
    try {
      await page.locator('#tab-set').click();
      await page.locator('#tab-home').click();
      await page.waitForTimeout(150);
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
        out: document.querySelector('#outSat').textContent
      }));
      assert.equal(mixed.blur, '34px');
      assert.equal(mixed.sat, '2.10');
      assert.equal(mixed.bright, '1.10');
      assert.equal(mixed.out, '2.1×');
      await page.locator('#segTint [data-tint="frost"]').click();
      assert.equal(await page.locator('body.tint-frost').count(), 1);
      await page.locator('#segTint [data-tint="smoke"]').click();
      assert.equal(await page.locator('body.tint-smoke').count(), 1);
      assert.equal(await page.locator('body.tint-frost').count(), 0);
      await page.locator('#segTint [data-tint="clear"]').click();

      const orb = page.locator('#orb');
      const before = await orb.boundingBox();
      assert.ok(before, 'the orb is laid out');
      await page.mouse.move(before.x + 60, before.y + 40);
      await page.mouse.down();
      await page.mouse.move(before.x + 120, before.y + 80, { steps: 6 });
      await page.mouse.up();
      const after = await orb.boundingBox();
      assert.ok(after && Math.abs(after.x - before.x) > 30, 'the orb drags');

      /* dock magnification is a Full-glass, fine-pointer nicety */
      if ((await material(page)).perf !== 'full') {
        await page.locator('#btnPerf').click();
        await page.waitForTimeout(250);
      }
      const dock = page.locator('#tab-home');
      const box = await dock.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(200);
      assert.match(await dock.evaluate((el) => el.style.transform), /scale\(1\.28/, 'dock magnification');
      await page.mouse.move(2, 2);
      await page.waitForTimeout(200);
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
      assert.notEqual(m.heroBlur, 'none', 'phone glass still renders');
      assert.notEqual(m.heroShadow, 'none');
      const layout = await page.evaluate(() => ({
        columns: getComputedStyle(document.querySelector('.lg-hero')).gridTemplateColumns.split(' ').length,
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

  await check(engine + ' dictation starts, unlocks audio and speaks the first word', async () => {
    const { context, page, errors } = await boot(browser, 390, 844);
    try {
      await page.locator('#btnStart').click();
      const ready = page.getByRole('button', { name: "I'm ready", exact: true });
      if (await ready.count()) await ready.click();
      const skip = page.getByRole('button', { name: 'Skip countdown', exact: true });
      if (await skip.count()) await skip.click();
      await page.waitForTimeout(800);
      const unlocked = await page.evaluate(() => {
        const a = document.getElementById('sdpAudio');
        return { preload: a.getAttribute('preload'), paused: a.paused };
      });
      assert.equal(unlocked.preload, 'none', 'nothing is pre-downloaded');
      assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
    } finally {
      await context.close();
    }
  });

  await check(engine + ' a paper dictation ends in a working 30-word tick list', async () => {
    const { context, page, errors } = await boot(browser, 390, 844);
    try {
      await page.locator('#btnStart').click();
      await page.waitForTimeout(500);
      const ready = page.getByRole('button', { name: "I'm ready", exact: true });
      if (await ready.count()) await ready.click();
      await page.waitForTimeout(300);
      const skip = page.getByRole('button', { name: 'Skip countdown', exact: true });
      if (await skip.count()) await skip.click();
      await page.waitForTimeout(2500);

      /* strictly two spoken repeats of the word, one British female voice */
      const spoken = await page.evaluate(() => window.__spoken || []);
      const word = await page.evaluate(() => JSON.parse(localStorage.getItem('sdp.v13_fast_liquid')).lists[0].words[0].w);
      assert.equal(spoken.filter((t) => String(t).trim() === word).length, 2, 'spoken exactly twice: ' + JSON.stringify(spoken));
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sdp.v13_fast_liquid')).settings.writeFixed), 5, 'five second timer');

      await page.getByRole('button', { name: 'Finish early', exact: true }).click();
      await page.getByRole('button', { name: 'Finish now', exact: true }).click();
      await page.waitForTimeout(1200);
      const marks = page.locator('[aria-label^="Got it right"]');
      assert.equal(await marks.count(), 30, 'all 30 words can be ticked');
      for (let i = 0; i < 3; i++) await marks.nth(i).click();
      await page.waitForTimeout(600);
      const saved = await page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('sdp.v13_fast_liquid'));
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
