#!/usr/bin/env node
/*
 * Injects scripts/v52-elevenlabs.js into the single inline <script> of
 * index.html (immediately before `window.SDP = {`), then keeps the page a
 * single file. Safe to run more than once: an existing injection is replaced.
 *
 *   node scripts/inject-v52.cjs           # inject / refresh
 *   node scripts/inject-v52.cjs --check   # report only
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
const SNIPPET = path.join(__dirname, 'v52-elevenlabs.js');
const START = '/*__V52_INJECT_START__*/';
const END = '/*__V52_INJECT_END__*/';
const ANCHOR = 'window.SDP={version:APP_VERSION';

function main() {
  const check = process.argv.indexOf('--check') > -1;
  let html = fs.readFileSync(FILE, 'utf8');
  const body = fs.readFileSync(SNIPPET, 'utf8').trim();
  const payload = START + '\n' + body + '\n' + END;
  if (html.indexOf(START) > -1) {
    const from = html.indexOf(START);
    const to = html.indexOf(END) + END.length;
    html = html.slice(0, from) + payload + html.slice(to);
  } else {
    const at = html.indexOf(ANCHOR);
    if (at < 0) throw new Error('anchor ' + ANCHOR + ' not found');
    html = html.slice(0, at) + payload + html.slice(at);
  }
  console.log('index.html ' + Buffer.byteLength(html, 'utf8') + ' bytes');
  if (check) return;
  fs.writeFileSync(FILE, html);
}

main();
