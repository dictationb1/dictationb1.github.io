#!/usr/bin/env node
/* Rebuild the ES5 single-file app and keep both transparency routes identical. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { minify } = require(path.join(__dirname, '..', 'tests', 'node_modules', 'terser'));
const ROOT = path.resolve(__dirname, '..');
const KEEP = ['LiveWallpaper','isAssetsMedia','normalizeAssetPath','HOODED_WALLPAPER_SRC','BUNNY_WALLPAPER_SRC','WANDERING_SRC','DEFAULT_WALLPAPER_SRC','APP_VERSION','BUILD_DATE','ASSET_MEDIA_RE','Errors','Admin','DB','Speech','UI','Eng','Lib','NoVoice','defaultData','Results','Cloud','Dict','Store','CONFIG','ukMp3','SAMPLE_WORDS','IPA','SAMPLE_LIST_ID','U','Screens','WORD_BANK','publishCompletion','wordRow','T','STRINGS_EN','STRINGS_SI','GUIDE','welcomeGuide','firstRunTour','DataTools','Diag','Comm','Links','Sha','fatalCard','boot','home','bootTraffic','SDPCore','EncryptedVault','SDPDataMeter','SDP_DATA_METER','EV55','EV54','CFG','dataSheetLiveHost'];
(async function () {
  const file = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('<script>') + '<script>'.length;
  const end = html.indexOf('</script>', start);
  if (start < 8 || end < 0) throw Error('inline app script missing');
  let source = process.env.SDP_APP_SOURCE ? fs.readFileSync(process.env.SDP_APP_SOURCE, 'utf8') : html.slice(start, end);
  const runtime = fs.readFileSync(path.join(__dirname, 'v57-runtime.js'), 'utf8');
  const uiFile = path.join(__dirname, 'v57-ui.js');
  const ui = fs.existsSync(uiFile) ? fs.readFileSync(uiFile, 'utf8') : '';
  const marker = '/* SDP_V57_RUNTIME_START */';
  const close = '/* SDP_V57_RUNTIME_END */';
  const insertion = marker + '\n' + runtime + '\n' + ui + '\n' + close + '\n';
  const at = source.indexOf(marker);
  if (at >= 0) source = source.slice(0, at) + insertion + source.slice(source.indexOf(close, at) + close.length);
  else {
    const anchor = source.indexOf('window.SDP={') >= 0 ? source.indexOf('window.SDP={') : source.indexOf('window.SDP = {');
    if (anchor < 0) throw Error('SDP export anchor missing');
    source = source.slice(0, anchor) + insertion + source.slice(anchor);
  }
  const result = await minify(source, { ecma: 5, compress: { ecma: 5, passes: 2, hoist_funs: false, unsafe: false, reduce_vars: false, reduce_funcs: false }, mangle: { toplevel: false, reserved: KEEP }, format: { ecma: 5, ascii_only: false, comments: /SECTION \d+ -|SDP_V57_RUNTIME/ } });
  html = html.slice(0, start) + result.code + html.slice(end);
  if (Buffer.byteLength(html) > 600000) throw Error('index.html exceeds 600000 bytes');
  fs.writeFileSync(file, html);
  fs.copyFileSync(path.join(ROOT, 'data.html'), path.join(ROOT, 'data/index.html'));
  console.log('index.html:', Buffer.byteLength(html), 'bytes; data routes identical');
})().catch(function (e) { console.error(e); process.exit(1); });
