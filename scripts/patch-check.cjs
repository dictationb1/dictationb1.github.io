const fs = require('fs');
let src = fs.readFileSync('tests/check.cjs', 'utf8');

function replaceAll(what, with_) {
  let n = 0;
  while (src.indexOf(what) >= 0) {
    src = src.split(what).join(with_);
    n++;
  }
  return n;
}

// Version stamps in metadata check
replaceAll("if (d.ver !== 59 || d.appVersion !== '8.0.0') throw Error(f + ' must be ver 59 / appVersion 8.0.0');",
  "if (d.ver !== 60 || d.appVersion !== '9.0.0.1') throw Error(f + ' must be ver 60 / appVersion 9.0.0.1');");

// index APP_VERSION
replaceAll("if (!/APP_VERSION=\"8\\.0\\.0\"/.test(INDEX)) throw Error('index APP_VERSION must be 8.0.0');",
  "if (!/APP_VERSION=\"9\\.0\\.0.1\"/.test(INDEX)) throw Error('index APP_VERSION must be 9.0.0.1');");

// metadata console log
replaceAll("console.log('metadata: v59 / 8.0.0; media manifest: ' + media.assets.length + ' assets');",
  "console.log('metadata: v60 / 9.0.0.1; media manifest: ' + media.assets.length + ' assets');");

// version.json check
replaceAll("if (versionData.ver !== 59 || versionData.appVersion !== '8.0.0' || versionData.settingsRev !== 59) throw Error('version.json must ship ver 59 / 8.0.0 / settingsRev 59');",
  "if (versionData.ver !== 60 || versionData.appVersion !== '9.0.0.1' || versionData.settingsRev !== 60) throw Error('version.json must ship ver 60 / 9.0.0.1 / settingsRev 60');");

// Version stamps everywhere (second occurrence)
replaceAll("if (d.ver !== 59 || d.appVersion !== '8.0.0') throw Error(f + ' must ship 59 / 8.0.0');",
  "if (d.ver !== 60 || d.appVersion !== '9.0.0.1') throw Error(f + ' must ship 60 / 9.0.0.1');");

// sw.js version
replaceAll("if (!/var VERSION = 'sdp-v59'/.test(sw) || !/var APP_VERSION = '8\\.0\\.0'/.test(sw)) throw Error('sw.js must ship sdp-v59 / 8.0.0');",
  "if (!/var VERSION = 'sdp-v60'/.test(sw) || !/var APP_VERSION = '9\\.0\\.0.1'/.test(sw)) throw Error('sw.js must ship sdp-v60 / 9.0.0.1');");

// data-meter version
replaceAll("if (!/METER_VERSION = '8\\.0\\.0', SCHEMA = 59/.test(meterSrc)) throw Error('data-meter must ship 8.0.0 / 59');",
  "if (!/METER_VERSION = '9\\.0\\.0.1', SCHEMA = 60/.test(meterSrc)) throw Error('data-meter must ship 9.0.0.1 / 60');");

// data.html version
replaceAll("if (!/v59 · APP_VERSION 8\\.0\\.0/.test(DATAHTML)) throw Error('/data must show v59 · APP_VERSION 8.0.0');",
  "if (!/v60 · APP_VERSION 9\\.0\\.0.1/.test(DATAHTML)) throw Error('/data must show v60 · APP_VERSION 9.0.0.1');");
replaceAll("if (!/v59 · APP_VERSION 8\\.0\\.0/.test(read('data/index.html'))) throw Error('/data/index.html must show v59');",
  "if (!/v60 · APP_VERSION 9\\.0\\.0.1/.test(read('data/index.html'))) throw Error('/data/index.html must show v60');");

// Add v60 markers after v59 markers PASS line
const v60Markers = `
/* ------------------------------------------------------------------
 * v60 / 9.0.0.1 release markers
 * ------------------------------------------------------------------ */
if (!/#sdpNextGenCss/.test(learn)) throw Error('learning-tools must inject #sdpNextGenCss');
if (!/microToastLoad/.test(learn) || !/getEntriesByType\("navigation"\)/.test(learn)) throw Error('microToastLoad must include navigation transferSize');
if (!/creditPill/.test(learn) || !/v60-credit-live/.test(learn) || !/v60-credit-dock/.test(learn)) throw Error('creditPill must toggle v60-credit-live / v60-credit-dock');
if (!/guide-si-1\\.mp3/.test(sw)) throw Error('sw.js must precache guide-si-1.mp3');
if (!/eleven_flash_v2_5/.test(studio) || !/eleven_flash_v2_5/.test(read('data/elevenlabs-audio.json'))) throw Error('eleven_flash_v2_5 must be the default model');
if (!/iterations: ?250000/.test(INDEX)) throw Error('index.html must ship PBKDF2 iterations: 250000 (SDP_ENC_V2)');
if (!/encVault/.test(read('data/config.json')) || !/SDP_ENC_V2:/.test(read('data/config.json'))) throw Error('config.json must carry encVault: SDP_ENC_V2:...');
console.log('v60 markers: PASS');
`;
const anchor = "console.log('v59 markers: PASS');";
if (src.indexOf(anchor) >= 0) {
  src = src.split(anchor).join(v60Markers + anchor);
}

// Final console log
replaceAll("console.log('ALL v59 STATIC CHECKS PASSED');",
  "console.log('ALL v60 STATIC CHECKS PASSED');");

fs.writeFileSync('tests/check.cjs', src);
console.log('check.cjs patched');
