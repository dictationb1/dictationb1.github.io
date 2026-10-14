'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const vm = require('vm');
const assert = require('assert');
const {JSDOM, VirtualConsole} = require('jsdom');
const acorn = require('acorn');
const FakeTimers = require('@sinonjs/fake-timers');
const root = path.resolve(__dirname, '..');
const current = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push({test: name, status: 'PASS'}); }
  catch (err) { results.push({test: name, status: 'FAIL', detail: err.stack}); }
}
function harness(html = current, opts = {}) {
  const errors = [], requests = [], spoken = [];
  const dom = new JSDOM(html, {url: 'https://example.test/' + (opts.hash || ''), runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole()});
  const w = dom.window;
  const clock = FakeTimers.withGlobal(w).install({now: Date.UTC(2026, 9, 13, 12), toFake: ['Date','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame']});
  w.scrollTo = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.matchMedia = () => ({matches: false, addEventListener() {}});
  w.XMLHttpRequest = class {
    open(method, url) { requests.push({method, url}); }
    setRequestHeader() {}
    send() { w.setTimeout(() => {this.status = 0; this.readyState = 4; if(this.onreadystatechange) this.onreadystatechange();}, 10); }
  };
  w.fetch = () => { requests.push({method: 'fetch'}); return Promise.reject(Error('offline')); };
  if(opts.raw !== undefined) w.localStorage.setItem('sdp.v1', opts.raw);
  if(opts.backup) w.localStorage.setItem('sdp.v1.bak', opts.backup);
  if(opts.cloud) w.localStorage.setItem('sdp.cloudurl', 'https://script.google.com/macros/s/unreachable/exec');
  if(opts.blocked) Object.defineProperty(w, 'localStorage', {get() {throw Error('Storage blocked');}});
  if(opts.offline) Object.defineProperty(w.navigator, 'onLine', {value: false});
  if(opts.navThrows) ['onLine','hardwareConcurrency','deviceMemory','wakeLock','userAgent','maxTouchPoints'].forEach(k => Object.defineProperty(w.navigator, k, {get() {throw Error('Restricted getter');}}));
  if(opts.speechThrows) Object.defineProperty(w, 'speechSynthesis', {get() {throw Error('Speech blocked');}});
  if(opts.voice) {
    w.SpeechSynthesisUtterance = function(text) {this.text = text;};
    w.speechSynthesis = {getVoices() {return [{lang:opts.voice, name:opts.voice==='en-GB'?'Daniel':'US voice',localService:true}];}, cancel() {}, speak(u) {spoken.push({text:u.text, lang:u.lang, voice:u.voice && u.voice.lang}); w.setTimeout(() => {if(u.onend) u.onend();}, 1);}, addEventListener() {}};
  }
  w.addEventListener('error', ev => errors.push(ev.message));
  let script = Array.from(w.document.scripts).find(n => !n.type && n.textContent.includes('var APP_VERSION')).textContent;
  script = script.replace('window.SDP = {', 'window.__qa = {U: U, UI: UI, DB: DB, Store: Store, Errors: typeof Errors === "undefined" ? null : Errors, DataTools: DataTools, Screens: Screens, Eng: Eng, Speech: Speech, Cloud: Cloud, Admin: Admin, Diag: Diag, Results: Results, Lib: Lib, Comm: Comm, Dict: Dict, Links: typeof Links === "undefined" ? null : Links, Sha: Sha, fatalCard: fatalCard};\nwindow.SDP = {');
  if(opts.bootFailure) script = script.replace('  Store.test();\n  DB.load();', '  throw new Error("Injected boot failure");\n  Store.test();\n  DB.load();');
  if(opts.renderFailure) script = script.replace('  home: function () {', '  home: function () { throw new Error("Injected render failure");');
  vm.runInContext(script, dom.getInternalVMContext());
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  clock.tick(100);
  if(w.__qa.DB.data) w.__qa.DB.data.tourSeen = true;
  return {w, q:w.__qa, clock, errors, requests, spoken, crash:() => w.document.querySelector('#fatal').dataset.shown==='1', close() {clock.uninstall(); dom.window.close();}};
}
function withApp(opts, fn, html) {const a=harness(html,opts);try{fn(a);}finally{a.close();}}
function clickText(a, text) {const b=Array.from(a.w.document.querySelectorAll('button')).find(n => n.textContent.trim()===text); assert(b, 'button: '+text); b.click(); return b;}

module.exports={harness,withApp,clickText};
