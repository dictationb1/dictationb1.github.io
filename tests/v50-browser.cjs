'use strict';
/* v50 uses real Chromium HTMLMediaElement decoding and event delivery. The
   network is intercepted with a silent WAV fixture, so this verifies media
   mechanics and layout, not the sound or availability of external providers. */
const assert = require('node:assert/strict');

function wav(seconds) {
  const rate = 8000, samples = rate * seconds, dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}
const fixture = wav(8);

async function pageWithAudio(browser, fileURL, viewport, reducedMotion) {
  const context = await browser.newContext({viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://**/*', (route) => {
    const url = route.request().url();
    if (/^https:\/\/dict\.youdao\.com\/dictvoice/.test(url) || /^https:\/\/ssl\.gstatic\.com\/dictionary\//.test(url)) {
      return route.fulfill({status:200, contentType:'audio/wav', body:fixture});
    }
    return route.abort();
  });
  await page.goto(fileURL);
  await page.waitForSelector('#guideSheet');
  await page.locator('#guideSheet .shead button[aria-label="Close"]').evaluate((button) => button.click());
  await page.waitForFunction(() => !document.querySelector('#guideSheet'));
  return {context, page, errors};
}
async function begin(page) {
  await page.locator('#btnStart').click();
  await page.locator('#btnReadyGo').click();
  await page.waitForSelector('#btnPause');
  await page.evaluate(() => window.Eng.startWord(0));
}
async function playStarted(page) {
  await page.waitForFunction(() => {
    const a = document.getElementById('ttsMasterAudio');
    return a && a.readyState >= 1 && !a.paused && a.currentTime > 0;
  }, null, {timeout:10000});
}
async function finishCurrentClip(page, timeout = 15000) {
  // Let the real media element finish naturally; the intercepted WAV response
  // does not implement HTTP range requests, so seeking would stall in Chromium.
  await page.waitForFunction(() => window.Eng.phase === 'write', null, {timeout});
}

module.exports = async function runV50(browser, check, fileURL) {
  await check('v50 real Chromium media rate, helper timer and pause lifecycle', async () => {
    const {context, page, errors} = await pageWithAudio(browser, fileURL, {width:393,height:851}, false);
    try {
      assert.equal(await page.evaluate(() => document.body.getAttribute('data-perf')), 'full');
      await begin(page);
      await page.locator('#btnSlow').click();
      const immediate = await page.evaluate(() => {
        const audio = document.getElementById('ttsMasterAudio');
        return {rate:audio.playbackRate, normal:audio.defaultPlaybackRate, sub:document.getElementById('plSub').textContent};
      });
      assert.equal(immediate.rate, 0.72); assert.equal(immediate.normal, 0.72);
      assert.match(immediate.sub, /Speaking slowly/);
      await playStarted(page);
      const actual = await page.evaluate(() => {
        const a = document.getElementById('ttsMasterAudio');
        return {rate:a.playbackRate, normal:a.defaultPlaybackRate, duration:a.duration, ready:a.readyState, paused:a.paused};
      });
      assert.equal(actual.rate, 0.72); assert.equal(actual.normal, 0.72);
      assert.ok(actual.duration >= 7.9 && actual.ready >= 1 && !actual.paused, JSON.stringify(actual));

      await page.locator('#btnSentence').click(); await playStarted(page);
      const sentence = await page.locator('#plSub').textContent();
      assert.match(sentence, /^💬 .*_______/); assert.doesNotMatch(sentence, /afraid/i);
      await page.waitForTimeout(5300);
      assert.equal(await page.locator('#plSub').textContent(), sentence);
      assert.deepEqual(await page.evaluate(() => ({idx:window.Eng.idx, phase:window.Eng.phase, timer:window.Eng.countdown})), {idx:0,phase:'helper',timer:null});
      await finishCurrentClip(page);
      assert.ok(await page.evaluate(() => window.Eng.countdown && window.Eng.countdown.left > 0));

      await page.locator('#btnSpell').click(); await playStarted(page);
      assert.equal(await page.locator('#plSub').textContent(), '🔤 Spelling: A · F · R · A · I · D');
      await page.waitForTimeout(5300);
      assert.equal(await page.locator('#plSub').textContent(), '🔤 Spelling: A · F · R · A · I · D');
      assert.equal(await page.evaluate(() => window.Eng.idx), 0);
      await finishCurrentClip(page);

      // Replay contains three natural clips (number and two word passes).
      // No writing timer may run during any of those clips.
      await page.locator('#btnReplay').click(); await playStarted(page);
      await page.waitForTimeout(5300);
      assert.equal(await page.locator('#plSub').textContent(), '🔊 Repeating word…');
      assert.deepEqual(await page.evaluate(() => ({idx:window.Eng.idx, phase:window.Eng.phase, timer:window.Eng.countdown})), {idx:0,phase:'helper',timer:null});
      await finishCurrentClip(page, 40000);
      assert.ok(await page.evaluate(() => window.Eng.countdown && window.Eng.countdown.left > 0));

      await page.locator('#btnPause').click();
      assert.equal(await page.locator('#btnPause').textContent(), '▶ Resume');
      assert.equal(await page.locator('#plProgText').textContent(), '⏸ Paused · Dictation #1 of 30');
      assert.equal(await page.locator('#plStepBadge').textContent(), '⏸ Paused · Dictation #1 of 30');
      assert.equal(await page.locator('#plSub').textContent(), '⏸ Session paused. Click Resume to continue.');
      await page.locator('#btnPause').click(); await playStarted(page);
      assert.match(await page.locator('#plSub').textContent(), /Welcome back/);
      assert.equal(await page.evaluate(() => window.Eng.phase), 'resume');
      await page.waitForFunction(() => window.Eng.phase === 'listen', null, {timeout:15000});
      assert.equal(await page.evaluate(() => window.Eng.idx), 0);
      assert.equal(await page.locator('#btnPause').textContent(), '⏸ Pause');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  await check('v50 Chromium migrates v49 once without losing personal data', async () => {
    const initial = await pageWithAudio(browser, fileURL, {width:393,height:851}, false);
    const seed = await initial.page.evaluate(() => JSON.parse(localStorage.getItem('sdp.v50_all_p0_p6_fixed')));
    await initial.context.close();
    seed.v = 49; seed.settingsRev = 49; seed.settings.perf = 'lite';
    seed.history = [{id:'migration-history', wordCount:30}];
    seed.comments = [{id:'migration-comment', text:'keep this comment'}];
    seed.lists.push({id:'migration-personal', name:'Personal', words:[{w:'treasure', s:'A treasure is precious.', m:'Something valuable.'}]});
    const originalPinHash = seed.admin.pinHash;
    const context = await browser.newContext({viewport:{width:393,height:851}});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addInitScript((oldData) => {
        if (!sessionStorage.getItem('migration-seeded')) {
          localStorage.removeItem('sdp.v50_all_p0_p6_fixed');
          localStorage.setItem('sdp.v49_working_sound_system', JSON.stringify(oldData));
          sessionStorage.setItem('migration-seeded', '1');
        }
      }, seed);
      await page.route('https://**/*', (route) => route.abort());
      await page.goto(fileURL);
      await page.waitForFunction(() => window.SDP && localStorage.getItem('sdp.v50_all_p0_p6_fixed'));
      const migrated = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('sdp.v50_all_p0_p6_fixed'));
        return {v:data.v, rev:data.settingsRev, perf:data.settings.perf, rendered:document.body.getAttribute('data-perf'),
          history:data.history[0].id, comment:data.comments[0].text, pin:data.admin.pinHash,
          personal:data.lists.some((list) => list.id === 'migration-personal' && list.words[0].w === 'treasure')};
      });
      assert.deepEqual(migrated, {v:50, rev:50, perf:'full', rendered:'full', history:'migration-history',
        comment:'keep this comment', pin:originalPinHash, personal:true});
      await page.evaluate(() => document.getElementById('btnPerf').click());
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('sdp.v50_all_p0_p6_fixed')).settings.perf === 'lite');
      await page.reload();
      await page.waitForFunction(() => window.SDP && document.body.getAttribute('data-perf') === 'lite');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sdp.v50_all_p0_p6_fixed')).settings.perf), 'lite');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  for (const viewport of [{width:1366,height:768}, {width:393,height:851}]) {
    for (const reduced of [false, true]) {
      await check('v50 credit clearance and glass at ' + viewport.width + 'px' + (reduced ? ' reduced motion' : ''), async () => {
        const {context, page, errors} = await pageWithAudio(browser, fileURL, viewport, reduced);
        try {
          assert.equal(await page.evaluate(() => document.body.classList.contains('credit-intro')), true, 'closing guide retriggers the entrance');
          const home = await page.evaluate(() => {
            const hero = document.getElementById('homeHero');
            const style = getComputedStyle(hero), pseudo = getComputedStyle(hero, '::before');
            const credit = getComputedStyle(document.getElementById('credit'));
            return {perf:document.body.getAttribute('data-perf'), root:document.documentElement.getAttribute('data-perf'),
              sheen:pseudo.display, shadow:style.boxShadow, background:style.backgroundImage,
              intro:credit.animationName, running:credit.animationPlayState};
          });
          assert.equal(home.perf, 'full'); assert.equal(home.root, 'full'); assert.notEqual(home.sheen, 'none');
          assert.match(home.shadow, /inset/); assert.match(home.background, /linear-gradient/);
          assert.equal(home.intro, 'creditHero'); assert.equal(home.running, 'running');
          await page.locator('#btnPerf').click();
          const lite = await page.evaluate(() => ({perf:document.body.getAttribute('data-perf'), display:getComputedStyle(document.getElementById('homeHero'), '::before').display, shadow:getComputedStyle(document.getElementById('homeHero')).boxShadow}));
          assert.equal(lite.perf, 'lite'); assert.notEqual(lite.display, 'none'); assert.match(lite.shadow, /inset/);
          await begin(page);
          assert.equal(await page.evaluate(() => document.body.classList.contains('credit-intro')), true, 'closing Ready retriggers the entrance');
          const visual = await page.evaluate(() => {
            const card = document.querySelector('.wordcard');
            return {display:getComputedStyle(card, '::before').display, shadow:getComputedStyle(card).boxShadow};
          });
          assert.notEqual(visual.display, 'none'); assert.match(visual.shadow, /inset/);
          const samples = await page.evaluate(async () => {
            const credit = document.getElementById('credit');
            document.body.classList.remove('credit-intro');
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const cs = getComputedStyle(credit);
            const animation = credit.getAnimations().find((a) => a.animationName === 'hansanaCinemaCycle');
            if (!animation) return {name:cs.animationName, duration:cs.animationDuration, missing:true};
            animation.pause();
            const overlaps = (a,b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
            const rows = [];
            for (const time of [0,700,1750,3500,4400,5250,6020,6990]) {
              animation.currentTime = time;
              const bounds = credit.getBoundingClientRect();
              const targets = ['#btnRestart','#btnFinishEarly','#btnPause','.layer .lhead h2'];
              const collisions = targets.filter((selector) => { const node = document.querySelector(selector); return node && overlaps(bounds,node.getBoundingClientRect()); });
              rows.push({time,opacity:parseFloat(getComputedStyle(credit).opacity),collisions});
            }
            return {name:cs.animationName,duration:cs.animationDuration,iteration:cs.animationIterationCount,rows};
          });
          assert.equal(samples.name, 'hansanaCinemaCycle', JSON.stringify(samples));
          assert.equal(samples.duration, '7s'); assert.equal(samples.iteration, 'infinite');
          assert.ok(samples.rows.find((r) => r.time === 4400).opacity < 0.1, JSON.stringify(samples));
          assert.ok(samples.rows.find((r) => r.time === 6020).opacity > 0.9, JSON.stringify(samples));
          for (const row of samples.rows) assert.deepEqual(row.collisions, [], JSON.stringify(row));
          assert.deepEqual(errors, []);
        } finally { await context.close(); }
      });
    }
  }
};
