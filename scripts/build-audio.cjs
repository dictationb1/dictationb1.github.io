#!/usr/bin/env node
'use strict';
/* ============================================================================
   build-audio.cjs — v43 bundled single-voice audio pack builder
   ----------------------------------------------------------------------------
   Renders EVERY spoken clip of the app into ./audio/*.mp3 with ONE single
   neural voice, so the player never mixes two voices and never falls back to
   the robotic device `speechSynthesis` voice.

   Engines (pick one, the file set is identical either way):

     npm run build:audio                       # edge-tts en-GB-SoniaNeural
     SDP_TTS_ENGINE=edge node scripts/build-audio.cjs
     SDP_TTS_ENGINE=offline node scripts/build-audio.cjs   # sherpa-onnx
                                                           # Supertonic 3, CPU

   The offline engine needs SDP_SUPERTONIC_DIR (see scripts/tts_offline.py).
   The pack currently committed to the repository was produced by the offline
   engine; `--engine edge` regenerates the exact same file names with
   Microsoft's en-GB-SoniaNeural British studio voice when the build machine
   has internet access.

     node scripts/build-audio.cjs --manifest-only   # only rewrite the manifest
     node scripts/build-audio.cjs --verify          # verify the committed pack
   ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const AUDIO = path.join(ROOT, 'audio');
const MANIFEST = path.join(__dirname, 'audio-manifest.json');
const VER = 43;

/* ---------------------------------------------------------------- helpers --- */
function slugWord(word) {
  return String(word == null ? '' : word)
    .split('/')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sessionWords() {
  const words = [];
  try {
    const session = readJson(path.join(ROOT, 'data', 'session.json'));
    for (const list of session.lists || []) {
      for (const entry of list.words || []) {
        const w = entry && (entry.w || entry.word);
        if (w) words.push(String(w));
      }
    }
  } catch (err) {
    /* data/session.json is optional for the manifest */
  }
  return words;
}

function htmlWords() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const found = [];
  const re = /\{w:"([^"]{2,40})",m:/g;
  let m;
  while ((m = re.exec(html))) found.push(m[1]);
  return found;
}

/* Words that are not in the shipped session but are still spoken by the app
   (the sound check says "bicycle") or are common practice words. */
const EXTRA_WORDS = ['bicycle', 'motorbike', 'bus stop', 'train station', 'tyre', 'windscreen', 'journey', 'luggage'];

function allWords() {
  const set = Object.create(null);
  const out = [];
  const push = (w) => {
    const key = slugWord(w);
    if (!key || set[key]) return;
    set[key] = 1;
    out.push(String(w).split('/')[0]);
  };
  sessionWords().forEach(push);
  htmlWords().forEach(push);
  EXTRA_WORDS.forEach(push);
  return out;
}

/* --------------------------------------------------------------- manifest --- */
function buildManifest() {
  const words = allWords();
  const clips = [];
  const add = (file, text, kind, speed) => clips.push({ file, text, kind, speed: speed || 0.98 });

  /* System & lifecycle */
  add('welcome-paper.mp3', "Welcome. Prepare your pen and paper. Each word is read twice. Press Yes, I'm ready to begin.", 'system');
  add('welcome-type.mp3', "Welcome. Each word is read twice. Type your answer and press Enter. Press Yes, I'm ready to begin.", 'system');
  add('sound-check.mp3', 'Sound check. Number 1, bicycle.', 'system');
  add('count-3.mp3', 'Three.', 'count');
  add('count-2.mp3', 'Two.', 'count');
  add('count-1.mp3', 'One.', 'count');
  add('countdown-321.mp3', 'Three, two, one.', 'count');
  add('paused.mp3', 'Session paused.', 'system');
  add('finish-paper.mp3', 'Dictation complete. Well done. Review all thirty words below.', 'system');
  add('finish-type.mp3', 'Dictation complete. Well done.', 'system');

  /* Numbered passes 1..30 and resumes 1..30 */
  for (let n = 1; n <= 30; n += 1) {
    add('num-' + n + '.mp3', n === 30 ? 'Final word, number 30.' : 'Number ' + n + '.', 'number', 0.96);
    add('resume-' + n + '.mp3', 'Welcome back. Continuing dictation number ' + n + '.', 'resume', 0.96);
  }

  /* Vocabulary — one clip per word, same voice */
  words.forEach((w) => add('word-' + slugWord(w) + '.mp3', w, 'word', 0.94));

  /* Pass 1 combos ("Number N, word.") are byte-concatenated from num-N + word
     after rendering, so they are listed separately below (kind: 'pass1'). */
  const session = sessionWords();
  const pass1 = [];
  for (let i = 0; i < session.length && i < 30; i += 1) {
    pass1.push({
      file: 'pass1-' + (i + 1) + '-' + slugWord(session[i]) + '.mp3',
      from: ['num-' + (i + 1) + '.mp3', 'word-' + slugWord(session[i]) + '.mp3'],
      index: i + 1,
      word: session[i],
    });
  }

  return {
    ver: VER,
    engine: 'single neural voice',
    speaker: process.env.SDP_TTS_SPEAKER || 'F1',
    generatedAt: new Date().toISOString(),
    clips,
    pass1,
    words,
  };
}

function writeManifest(manifest) {
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log('manifest: ' + manifest.clips.length + ' clips + ' + manifest.pass1.length + ' pass1 combos -> ' + path.relative(ROOT, MANIFEST));
}

/* ---------------------------------------------------------------- engines --- */
function hasEdgeTts() {
  try {
    cp.execFileSync('python3', ['-c', 'import edge_tts'], { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function renderEdge(manifest) {
  const voice = process.env.SDP_TTS_VOICE || 'en-GB-SoniaNeural';
  const dir = AUDIO;
  fs.mkdirSync(dir, { recursive: true });
  const script = [
    'import asyncio, json, sys, edge_tts',
    'manifest = json.load(open(sys.argv[1], "r", encoding="utf-8"))',
    'voice = sys.argv[2]',
    'out = sys.argv[3]',
    'async def main():',
    '    for clip in manifest["clips"]:',
    '        dest = out + "/" + clip["file"]',
    '        c = edge_tts.Communicate(clip["text"], voice, rate="+0%", pitch="+0Hz")',
    '        await c.save(dest)',
    '        print("  " + clip["file"])',
    'asyncio.run(main())',
  ].join('\n');
  const tmp = path.join(require('node:os').tmpdir(), 'sdp-edge-tts.py');
  fs.writeFileSync(tmp, script);
  cp.execFileSync('python3', [tmp, MANIFEST, voice, dir], { stdio: 'inherit' });
}

function renderOffline(manifest) {
  fs.mkdirSync(AUDIO, { recursive: true });
  cp.execFileSync('python3', [path.join(__dirname, 'tts_offline.py'), '--manifest', MANIFEST, '--out', AUDIO], {
    stdio: 'inherit',
    env: process.env,
  });
}

/* --------------------------------------------------------- pass1 assembly --- */
function concatPass1(manifest) {
  let built = 0;
  for (const combo of manifest.pass1) {
    const target = path.join(AUDIO, combo.file);
    if (fs.existsSync(target) && fs.statSync(target).size > 1000) continue;
    const parts = combo.from.map((f) => path.join(AUDIO, f));
    if (!parts.every((p) => fs.existsSync(p) && fs.statSync(p).size > 1000)) continue;
    fs.writeFileSync(target, Buffer.concat(parts.map((p) => fs.readFileSync(p))));
    built += 1;
  }
  console.log('pass1: ' + built + ' combined clips written');
}

/* --------------------------------------------------------------- verify ---- */
function verify(manifest) {
  const problems = [];
  const files = manifest.clips.map((c) => c.file).concat(manifest.pass1.map((p) => p.file));
  for (const file of files) {
    const full = path.join(AUDIO, file);
    if (!fs.existsSync(full)) problems.push(file + ': missing');
    else if (fs.statSync(full).size <= 1000) problems.push(file + ': only ' + fs.statSync(full).size + ' bytes');
  }
  if (problems.length) {
    console.error('audio pack INCOMPLETE (' + problems.length + ' problems):');
    problems.slice(0, 20).forEach((p) => console.error('  ' + p));
    process.exitCode = 1;
    return false;
  }
  const total = files.reduce((n, f) => n + fs.statSync(path.join(AUDIO, f)).size, 0);
  console.log('audio pack OK: ' + files.length + ' mp3 files, ' + (total / 1024 / 1024).toFixed(2) + ' MB, all > 1000 bytes');
  return true;
}

/* ----------------------------------------------------------------- main ---- */
function main(argv) {
  const manifest = buildManifest();
  writeManifest(manifest);

  if (argv.indexOf('--verify') >= 0) return verify(manifest) ? 0 : 1;
  if (argv.indexOf('--manifest-only') >= 0) return 0;

  if (argv.indexOf('--concat-only') < 0) {
    const engine = process.env.SDP_TTS_ENGINE || (hasEdgeTts() ? 'edge' : 'offline');
    console.log('engine: ' + engine + (engine === 'edge' ? ' (en-GB-SoniaNeural)' : ' (sherpa-onnx Supertonic 3, speaker ' + (process.env.SDP_TTS_SPEAKER || 'F1') + ')'));
    if (engine === 'edge') renderEdge(manifest);
    else renderOffline(manifest);
  }

  concatPass1(manifest);
  return verify(manifest) ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { buildManifest, slugWord, allWords, verify, AUDIO };
