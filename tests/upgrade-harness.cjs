'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function scripts(source = html) {
  return {
    main: source.match(/<script>\s*(\/\*[\s\S]*?var APP_VERSION[\s\S]*?)<\/script>/)[1],
    gas: source.match(/<script type="text\/plain" id="gas-source">([\s\S]*?)<\/script>/)[1]
  };
}
function app(source = html) {
  const dom = new JSDOM(source, {url:'https://example.test/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole:new VirtualConsole()});
  const w = dom.window;
  w.matchMedia = () => ({matches:false, addEventListener(){}});
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.scrollTo = () => {};
  let code = scripts(source).main;
  // Do not boot or unlock: test helpers exist only in the in-memory test copy.
  code = code.replace(/try \{\s*if \(document.readyState === "loading"\)[\s\S]*?\/\* expose a small/, '/* expose a small');
  code = code.replace('window.SDP = {', 'window.__test = {Admin:Admin,DB:DB,Lib:Lib,U:U,UI:UI,Cloud:Cloud,Screens:Screens,Eng:Eng,Sha:Sha,defaultData:defaultData};\nwindow.SDP = {');
  vm.runInContext(code, dom.getInternalVMContext());
  const q = w.__test;
  q.DB.data = q.defaultData();
  return {q, w, close:() => dom.window.close()};
}
module.exports = {root, html, scripts, app};
