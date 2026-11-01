#!/usr/bin/env node
/* ============================================================================
   scripts/patch-v60.cjs — deterministic, idempotent surgical patches for
   v9.0.0.2 (build 60). index.html is a ~455 KB minified single file: never
   reformat it, only replace exact strings. Re-running is a no-op.
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
const V = '9.0.0.2';

let src = fs.readFileSync(FILE, 'utf8');
const applied = [];

function swap(from, to, label) {
  if (src.indexOf(from) < 0) return false;
  src = src.split(from).join(to);
  applied.push(label || from.slice(0, 42));
  return true;
}

/* 1. app version */
swap('APP_VERSION="9.0.0.1"', 'APP_VERSION="' + V + '"', 'APP_VERSION -> ' + V);
swap('APP_VERSION="8.0.0"', 'APP_VERSION="' + V + '"', 'APP_VERSION 8.0.0 -> ' + V);

/* 2. solid dark shell, no unsolicited wallpaper */
swap('<body class="wallpaper-on tint-clear" data-theme="dark" data-perf="full">',
  '<body class="sdp-nextgen" data-theme="dark" data-perf="full">', 'body: wallpaper-on removed');
swap('<body class="wallpaper-on" data-theme="dark" data-perf="full">',
  '<body class="sdp-nextgen" data-theme="dark" data-perf="full">', 'body: wallpaper-on removed');

/* 3. cache-busted script URLs */
swap('<script src="./data/data-meter.js" defer>', '<script src="./data/data-meter.js?v=' + V + '" defer>', 'data-meter.js ?v');
swap('<script src="./data/learning-tools.js" defer>', '<script src="./data/learning-tools.js?v=' + V + '" defer>', 'learning-tools.js ?v');
swap('\\"./data/studio.js?v=60\\"', '\\"./data/studio.js?v=' + V + '\\"', 'studio.js ?v');
swap('"./data/studio.js?v=60"', '"./data/studio.js?v=' + V + '"', 'studio.js ?v');
swap('<script src="./data/studio.js" defer>', '<script src="./data/studio.js?v=' + V + '" defer>', 'studio.js ?v');
swap('<script src="./data/words.js" defer>', '<script src="./data/words.js?v=' + V + '" defer>', 'words.js ?v');

/* 4. visible version badges */
swap('Smart Dictation Player · v59 · 8.0.0', 'Smart Dictation Player · v' + V + ' · v60', 'about title');
swap('Smart Dictation Player v58 · Created by Hansana', 'Smart Dictation Player v' + V + ' (v60) · Created by Hansana', 'footer credit version');
swap('data-version="9.0.0.1"', 'data-version="' + V + '"', 'data-version');

fs.writeFileSync(FILE, src);
console.log('index.html patched (' + applied.length + '): ' + applied.join(' | '));
console.log('bytes: ' + Buffer.byteLength(src));
