#!/usr/bin/env node
/*
 * Keeps the single-file app small: re-minifies the one inline <script> of
 * index.html with terser (ES5 target) so the published page stays far below
 * the 450,000 byte ceiling. Run after any edit of the inline script:
 *
 *   node scripts/minify-inline.cjs            # rewrite index.html in place
 *   node scripts/minify-inline.cjs --check    # report the byte delta only
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { minify } = require(path.join(__dirname, '..', 'tests', 'node_modules', 'terser'));

const FILE = path.join(__dirname, '..', 'index.html');
const OPEN = '<script>';
/* Names the QA harnesses reach into. Keep them readable so the test rigs can
   grab handles (and inject faults) by name after minification. */
const KEEP = ['LiveWallpaper','isAssetsMedia','normalizeAssetPath','DEFAULT_WALLPAPER_SRC','APP_VERSION','BUILD_DATE',
  'ASSET_MEDIA_RE','Errors','Admin','DB','Speech','UI','Eng','Lib','NoVoice','defaultData','Results','Cloud','Dict',
  'Store','CONFIG','ukMp3','SAMPLE_WORDS','IPA','SAMPLE_LIST_ID','U','Screens','WORD_BANK','publishCompletion',
  'wordRow','T','STRINGS_EN','STRINGS_SI','GUIDE','welcomeGuide','firstRunTour','DataTools','Diag','Comm','Links',
  'Sha','fatalCard','boot','home','bootTraffic'];
const CLOSE = '</script>';

async function main() {
  const checkOnly = process.argv.indexOf('--check') > -1;
  const html = fs.readFileSync(FILE, 'utf8');
  const start = html.indexOf(OPEN);
  if (start < 0) throw new Error('no bare <script> block found');
  const bodyStart = start + OPEN.length;
  const bodyEnd = html.indexOf(CLOSE, bodyStart);
  if (bodyEnd < 0) throw new Error('unterminated <script> block');
  const source = html.slice(bodyStart, bodyEnd);
  const result = await minify(source, {
    ecma: 5,
    compress: { ecma: 5, passes: 2, hoist_funs: false, unsafe: false, reduce_vars: false, reduce_funcs: false },
    mangle: { toplevel: false, reserved: KEEP },
    format: { ecma: 5, ascii_only: false, comments: /SECTION \d+ -/ }
  });
  if (!result || typeof result.code !== 'string') throw new Error('terser produced no code');
  const code = result.code;
  const before = Buffer.byteLength(source, 'utf8');
  const after = Buffer.byteLength(code, 'utf8');
  console.log('inline script ' + before + ' -> ' + after + ' bytes (' + (after - before) + ')');
  if (checkOnly) return;
  fs.writeFileSync(FILE, html.slice(0, bodyStart) + code + html.slice(bodyEnd));
  console.log('index.html now ' + Buffer.byteLength(fs.readFileSync(FILE), 'utf8') + ' bytes');
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
