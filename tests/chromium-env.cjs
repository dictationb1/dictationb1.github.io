'use strict';
/* Playwright launches the @sparticuz/chromium binary, which needs the AL2023
   shared libraries (libnspr4 / libnss3 / libnssutil3) that ship inside the same
   package as base/al2023.tar.br. They are decompressed once into the OS temp
   directory and put on LD_LIBRARY_PATH, so `node tests/browser.cjs` works on a
   bare CI image without root and without a system package manager. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const cp = require('node:child_process');

function ensureChromiumLibs() {
  const archive = path.join(__dirname, 'node_modules', '@sparticuz', 'chromium', 'bin', 'al2023.tar.br');
  const dir = path.join(os.tmpdir(), 'sdp-chromium-libs');
  const lib = path.join(dir, 'lib');
  try {
    if (!fs.existsSync(path.join(lib, 'libnss3.so'))) {
      if (!fs.existsSync(archive)) return false;
      fs.mkdirSync(dir, { recursive: true });
      const tar = path.join(os.tmpdir(), 'sdp-al2023.tar');
      fs.writeFileSync(tar, zlib.brotliDecompressSync(fs.readFileSync(archive)));
      cp.execFileSync('tar', ['xf', tar, '-C', dir], { stdio: 'ignore' });
      fs.unlinkSync(tar);
    }
  } catch (err) {
    return false;
  }
  const current = String(process.env.LD_LIBRARY_PATH || '');
  if (current.split(':').indexOf(lib) < 0) {
    process.env.LD_LIBRARY_PATH = current ? lib + ':' + current : lib;
  }
  return true;
}

module.exports = { ensureChromiumLibs };
