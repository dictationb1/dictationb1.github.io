'use strict';
/* ============================================================================
   Live lab: exercises the current real-time class channel end to end, outside the
   unit harness. It starts a real HTTP server for the repository, emulates the
   free ntfy.sh API (POST + /json?poll=1&since=all + /sse) on the same origin,
   then boots TWO independent devices:

     Device A  the lecturer   publishes "Session 4 words" from Admin mode
     Device B  a student      must see those 30 words without a reload

   Run: node tests/live-lab.cjs
   ========================================================================== */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const { JSDOM, VirtualConsole } = require('jsdom');

const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (err) { results.push({ name, ok: false, err: err.message }); console.log('FAIL  ' + name + ' :: ' + err.message); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function waitUntil(fn, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (fn()) return true;
    await wait(25);
  }
  return !!fn();
}

/* ------------------------------------------------ ntfy.sh emulator + host --- */
const topics = Object.create(null);
const sseClients = [];
const requests = [];
function pushSSE(topic, event) {
  const line = 'data: ' + JSON.stringify(event) + '\n\n';
  sseClients.forEach(c => { if (c.topics.indexOf(topic) >= 0) { try { c.res.write(line); } catch (e) {} } });
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  requests.push(req.method + ' ' + url.pathname + (url.search || ''));
  res.setHeader('Access-Control-Allow-Origin', '*');
  const parts = url.pathname.replace(/^\//, '').split('/');
  const topicList = (parts[0] || '').split(',');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'POST' && topicList.length === 1) {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      let id = 0;
      topicList.forEach(t => { (topics[t] = topics[t] || []).push(body); id = topics[t].length; const ev = { id: String(id), event: 'message', time: Date.now(), topic: t, message: body }; pushSSE(t, ev); });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: String(id), event: 'message' }));
    });
    return;
  }
  if (req.method === 'GET' && /\/json$/.test(url.pathname)) {
    const out = [];
    topicList.forEach(t => (topics[t] || []).forEach((message, i) => out.push(JSON.stringify({ id: String(i + 1), event: 'message', time: Date.now(), topic: t, message }))));
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    res.end(out.join('\n') + (out.length ? '\n' : ''));
    return;
  }
  if (req.method === 'GET' && /\/sse$/.test(url.pathname)) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': welcome\n\n');
    const client = { topics: topicList, res };
    sseClients.push(client);
    req.on('close', () => { const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
    return;
  }
  /* the repository itself */
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(root, rel.replace(/^\/+/, ''));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  const type = /\.html$/.test(file) ? 'text/html' : /\.json$/.test(file) ? 'application/json' : 'text/plain';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

/* ----------------------------------------------- minimal EventSource shim --- */
function makeEventSource(w, base) {
  return function EventSource(url) {
    const self = this;
    this.readyState = 0;
    this.onopen = this.onmessage = this.onerror = null;
    const target = base + String(url).replace(/^https?:\/\/ntfy\.sh/, '');
    const req = http.get(target, res => {
      self.readyState = 1;
      let buf = '';
      if (self.onopen) self.onopen({});
      res.setEncoding('utf8');
      res.on('data', chunk => {
        buf += chunk;
        const chunks = buf.split('\n\n');
        buf = chunks.pop();
        chunks.forEach(block => {
          const dataLines = block.split('\n').filter(l => l.indexOf('data:') === 0).map(l => l.slice(5).trim());
          if (dataLines.length && self.onmessage) self.onmessage({ data: dataLines.join('\n') });
        });
      });
    });
    req.on('error', () => { if (self.onerror) self.onerror({}); });
    this.close = function () { self.readyState = 2; try { req.destroy(); } catch (e) {} };
  };
}

/* ------------------------------------------------------------- one device --- */
function device(html, base) {
  const dom = new JSDOM(html, { url: base + '/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window;
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.fetch = (url, opts) => fetch(String(url).replace(/^https?:\/\/ntfy\.sh/, base).replace(/^\.\//, base + '/'), opts);
  w.EventSource = makeEventSource(w, base);
  const rawScript = Array.from(w.document.scripts).find(s => !s.type && s.textContent.includes('var APP_VERSION')).textContent;
  const marker = rawScript.indexOf('window.SDP = {') >= 0 ? 'window.SDP = {' : 'window.SDP={';
  const script = rawScript.replace(marker, 'window.__lab = {Admin:Admin,DB:DB,Cloud:Cloud,UI:UI,Eng:Eng,Speech:Speech,Lib:Lib,CONFIG:CONFIG,defaultData:defaultData}; window.SDP = {');
  vm.runInContext(script, dom.getInternalVMContext());
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return { w, q: w.__lab, close() { w.close(); } };
}

(async function run() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port;
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const lecturer = device(html, base);
  const student = device(html, base);
  try {
    /* --- boot: the student must sync immediately, with no tap ------------ */
    student.q.Cloud.bootSync();
    lecturer.q.Cloud.bootSync();
    const stateTopic = student.q.CONFIG.ntfyState;
    const commTopic = student.q.CONFIG.ntfyComm;
    const session = JSON.parse(fs.readFileSync(path.join(root, 'data/session.json'), 'utf8')).session;
    await waitUntil(() => requests.some(r => r.startsWith('GET /data/session.json')) &&
      requests.some(r => r === 'GET /' + stateTopic + ',' + commTopic + '/sse') && student.q.Cloud.live.ok);
    check('boot sync loads repository version and session data', () =>
      { if (!requests.some(r => r.startsWith('GET /data/version.json')) || !requests.some(r => r.startsWith('GET /data/session.json'))) throw Error('no boot fetch: ' + requests.join(' | ')); });
    check('boot sync opens the live SSE stream on the state and community topics', () =>
      { if (!requests.some(r => r === 'GET /' + stateTopic + ',' + commTopic + '/sse')) throw Error(requests.join(' | ')); });
    check('the student picked up the published B1 session from the repository', () => {
      const d = student.q.DB.data;
      if (String(d.session.no) !== session.no) throw Error('session no ' + d.session.no);
      if (student.q.Lib.current().words.length !== 30) throw Error('words ' + student.q.Lib.current().words.length);
    });
    check('the status chip reports a real, online live sync', () => {
      const label = student.w.document.getElementById('chipNetText').textContent;
      if (!/^Online \u00b7 Live Sync/.test(label)) throw Error(label);
    });

    /* --- the lecturer publishes a new list for Session 4 ---------------- */
    const L = lecturer.q;
    const list = { id: 'list_session4', name: 'Session 4 words', words: [], version: 1, published: false, draft: true };
    L.DB.data.lists.push(list);
    L.DB.data.outbox = [];
    L.Admin.unlocked = true;
    const words = L.Lib.current().words.map(x => ({ w: x.w, s: x.s, m: x.m, audio: x.audio }));
    // Match the lecturer selecting this list, pinning it, and setting its title.
    L.Admin.editListId = list.id;
    L.DB.data.plan.pinned = list.id;
    L.DB.data.session.title = list.name;
    L.Admin.saveAll(list, words, ['2026-10-21'], null);
    L.Admin.unlocked = false;
    await waitUntil(() => (topics[stateTopic] || []).length && String(student.q.DB.data.session.no) === '4');
    check('one publish posts the whole session to the ntfy state topic', () =>
      { if (!(topics[stateTopic] || []).length) throw Error('nothing posted: ' + requests.join(' | ')); });
    check('the lecturer Home header is internally consistent (SESSION 4 + the same title)', () => {
      const kicker = lecturer.w.document.getElementById('homeKicker').textContent;
      const title = lecturer.w.document.getElementById('homeTitle').textContent;
      if (!/^SESSION 4\b/i.test(kicker)) throw Error('kicker: ' + kicker);
      if (!/Session 4 words/.test(title)) throw Error('title: ' + title);
      if (kicker.indexOf('21/10/2026') < 0) throw Error('kicker has no real session date: ' + kicker);
    });
    check('the published session is 30 real words with British audio urls', () => {
      const sent = topics[stateTopic] || [];
      if (!sent.length) throw Error('no state payload');
      const posted = JSON.parse(sent[sent.length - 1]);
      if (posted.kind !== 'state') throw Error('wrong payload kind: ' + posted.kind);
      if (posted.session.no !== '4') throw Error('no ' + posted.session.no);
      if (posted.lists[0].words.length !== 30) throw Error('words ' + posted.lists[0].words.length);
      /* v42: every word now carries the one unified en-GB neural voice URL
         ("<text> ." -> %20.), the retired Oxford --_gb_1.mp3 clips are gone */
      if (!posted.lists[0].words.every(x => x.m && x.s && /^https:\/\/dict\.youdao\.com\/dictvoice\?type=1&audio=.*%20\.$/.test(x.audio))) throw Error('a word has no B1 meaning/sentence/UK audio');
    });

    /* --- the student phone updates itself, live -------------------------- */
    check('the student phone received Session 4 over the live stream without a reload', () => {
      const S = student.q, d = S.DB.data;
      if (String(d.session.no) !== '4') throw Error('student session no ' + d.session.no);
      if (S.Lib.current().words.length !== 30) throw Error('student words ' + S.Lib.current().words.length);
      const kicker = student.w.document.getElementById('homeKicker').textContent;
      if (!/^SESSION 4\b/i.test(kicker)) throw Error('student kicker: ' + kicker);
    });
    check('the student outbox is empty (nothing stuck as "1 waiting")', () =>
      { if (student.q.DB.data.outbox.length) throw Error('outbox ' + student.q.DB.data.outbox.length); });

    /* --- a student finishes and the lecturer sees it live ---------------- */
    student.q.DB.data.results = [];
    student.q.Cloud.postCompletion({ id: 'lab-res-1', ts: Date.now(), sessionNo: '4', wordCount: 30, score: 27, percent: 90, deviceType: 'Android', ukVoice: false, mode: 'paper' });
    await waitUntil(() => (topics[commTopic] || []).length && lecturer.q.DB.data.results.some(r => r.id === 'lab-res-1'));
    check('a finished session is broadcast to the community topic', () =>
      { if (!(topics[commTopic] || []).length) throw Error('no comm post'); });
    check('the second device merges the live completion into real class results', () => {
      const C = lecturer.q;
      if (!C.DB.data.results.some(r => r.id === 'lab-res-1')) throw Error('result not merged');
    });
    check('Class stats then shows the real student completion, not the lecturer history', () => {
      const C = lecturer.q;
      C.Admin.unlocked = true;
      C.DB.data.history = [{ id: 'own', ts: Date.now(), score: 1, wordCount: 30, percent: 3, deviceType: 'Mac', ukVoice: true }];
      const host = lecturer.w.document.createElement('div');
      C.Admin.tabStats(host);
      if (!/1 student completion/.test(host.textContent)) throw Error(host.textContent.slice(0, 160));
      if (!/90%/.test(host.textContent)) throw Error('average missing');
      if (!/never counted as class results/.test(host.textContent)) throw Error('history not separated');
      C.Admin.unlocked = false;
    });

    /* --- offline behaviour is honest, never a fake Online badge ---------- */
    check('an offline device says so instead of showing a fake Online badge', () => {
      const S = student.q;
      Object.defineProperty(student.w.navigator, 'onLine', { configurable: true, get: () => false });
      S.UI.renderNet();
      const label = student.w.document.getElementById('chipNetText').textContent;
      if (label !== 'Offline \u00b7 Saved on device') throw Error(label);
      Object.defineProperty(student.w.navigator, 'onLine', { configurable: true, get: () => true });
      S.UI.renderNet();
    });
  } finally {
    lecturer.close(); student.close();
    sseClients.forEach(c => { try { c.res.end(); } catch (e) {} });
    server.close();
  }
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' live lab checks passed');
  process.exit(failed.length ? 1 : 0);
})();
