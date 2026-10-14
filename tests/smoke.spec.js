// Focused regression coverage. This is NOT the complete v2 acceptance suite.
const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const session = require('../data/session.json');
const words = session.words.map(x => x.w);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('window.SDP = {',
  'window.__qa = {Admin:Admin,DB:DB,Eng:Eng,Speech:Speech,UI:UI,Published:Published}; window.SDP = {');
async function boot(page, voices = []) {
  await page.addInitScript(voices => {
    window.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', {value: {
      getVoices: () => voices, cancel() {}, addEventListener() {},
      speak(u) { window.__spoken.push({text:u.text, lang:u.lang}); setTimeout(() => u.onend && u.onend(), 5); }
    }});
    window.SpeechSynthesisUtterance = function(text) {this.text = text;};
    HTMLMediaElement.prototype.play = function() {return Promise.resolve();};
    HTMLMediaElement.prototype.pause = function() {};
    window.__frames = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => {window.__frames++; return raf(cb);};
  }, voices);
  await page.route('https://app.test/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({contentType:'text/html', body:html});
    const file = path.join(root, url.pathname);
    if (fs.existsSync(file) && file.startsWith(root + path.sep)) return route.fulfill({contentType:'application/json', body:fs.readFileSync(file)});
    return route.fulfill({status:404, body:''});
  });
  await page.goto('https://app.test/');
  await expect(page.locator('#homeKicker')).toContainText('1');
  await page.waitForTimeout(150);
  await page.evaluate(() => {window.__qa.DB.data.tourSeen = true; document.querySelectorAll('#sheets .shead button').forEach(b=>b.click());});
}
test('boot, starter publication, defaults and visible build', async ({page}) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await boot(page);
  expect(await page.evaluate(() => window.__qa.DB.data.cachedPublished.words.length)).toBe(30);
  expect(await page.evaluate(() => window.__qa.DB.data.settings.repeats)).toBe(2);
  expect(await page.evaluate(() => window.__qa.DB.data.settings.sentence)).toBe(false);
  await expect(page.getByText('Build v2.0.0 (2026-10-14)', {exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
test('eight paste formats preserve all thirty words', async ({page}) => {
  await boot(page);
  const formats=[words.join('\n'), words.map((w,i)=>`${i+1}. ${w}`).join('\n'), words.map(w=>`• ${w}`).join('\n'),
    words.map(w=>`${w} - a simple meaning`).join('\n'), 'word,meaning,sentence\n'+words.map(w=>`${w},a simple meaning,This is an example.`).join('\n'),
    words.map(w=>`${w}\ta simple meaning\tThis is an example.`).join('\n'),
    words.map((w,i)=>i%3===0?`${w} | a meaning | An example.`:i%3===1?`${w},,`:`${i+1}. ${w}`).join('\n'), words.join('\r\n')];
  for (const input of formats) {
    const parsed=await page.evaluate(input=>window.__qa.Admin.parseWords(input),input);
    expect(parsed.items.map(x=>x.w)).toEqual(words); expect(parsed.problems).toEqual([]);
  }
});
test('past-session practise honours supplied words', async ({page}) => {
  await boot(page, [{name:'Daniel',lang:'en-GB',localService:true}]);
  await page.evaluate(() => window.__qa.Eng.start({words:[{w:'torch',m:'light',s:''}],listName:'Past class'}));
  expect(await page.evaluate(() => window.__qa.Eng.words.map(x=>x.w))).toEqual(['torch']);
});
test('stale version banner and newer cached session guard', async ({page}) => {
  await boot(page);
  await page.route('**/data/version.json?*',route=>route.fulfill({json:{build:'2.0.1'}}));
  await page.evaluate(() => window.__qa.Published.version());
  await expect(page.locator('#versionReload')).toBeVisible();
  expect(await page.evaluate(() => {
    const q=window.__qa; q.DB.data.cachedPublished.publishedAt='2027-01-01T00:00:00Z';
    q.Published.apply({publishedAt:'2026-01-01T00:00:00Z',words:[{w:'old'}],no:'old'});
    return q.DB.data.cachedPublished.words.length;
  })).toBe(30);
});
test('bounded frame probe and narrow layouts', async ({page},testInfo) => {
  await boot(page); await page.waitForTimeout(5000);
  const count=await page.evaluate(()=>window.__frames);
  await page.waitForTimeout(3000); expect(await page.evaluate(()=>window.__frames)).toBe(count);
  for (const theme of ['light','dark']) {
    await page.evaluate(theme=>{window.__qa.DB.data.settings.theme=theme;window.__qa.UI.applyTheme();},theme);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:testInfo.outputPath(theme+'.png')});
  }
  await page.evaluate(()=>{window.__qa.DB.data.settings.perf='lite';window.__qa.UI.applyPerf();});
  await page.screenshot({path:testInfo.outputPath('lite.png')});
});
test('lecturer keyboard unlock using environment PIN', async ({page}) => {
  test.skip(!process.env.LECTURER_PIN,'LECTURER_PIN was not supplied');
  await boot(page); await page.locator('#btnLock').click();
  await page.keyboard.type(process.env.LECTURER_PIN); await page.keyboard.press('Enter');
  await expect(page.locator('#adminHost')).toBeVisible();
});
for (const voices of [[], [{name:'US voice',lang:'en-US',localService:true}]]) {
  test('MUST: Start is not blocked with '+voices.length+' non-UK voices', async ({page}) => {
    await boot(page,voices);
    await page.evaluate(()=>window.__qa.Eng.start());
    // Deliberately remains red until the complete offline UK voice chain is implemented.
    expect(await page.evaluate(()=>window.__qa.Eng.st)).toBe('ready');
  });
}
