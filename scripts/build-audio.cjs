#!/usr/bin/env node
'use strict';
/* Build the v46 same-origin studio pack (Session 8 + archived Session 7). Requires Python and edge-tts:
 *   python -m pip install edge-tts
 *   node scripts/build-audio.cjs --force
 *   node scripts/build-audio.cjs --verify
 * English is en-GB-SoniaNeural; the Sinhala guide is si-LK-ThiliniNeural.
 * Missing or failed clips are never replaced with silence or another voice.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const AUDIO = path.join(ROOT, 'audio');
const MANIFEST = path.join(__dirname, 'audio-manifest.json');
const EN = 'en-GB-SoniaNeural';
const SI = 'si-LK-ThiliniNeural';
const GUIDE_EN = "Welcome to the Smart Dictation Player User Guide. Step one: choose Listen and write on paper, or Type in app. Step two: click Start dictation, then click I'm ready. Every word is spoken twice in our British studio voice, followed by five seconds to write. During dictation, you can click Repeat, Slower, Repeat sentence, or Spell it at any time. Click Start practising below to begin!";
const GUIDE_SI = 'ස්මාර්ට් ඩික්ටේෂන් ප්ලේයර් උපදෙස් මාලාවට සාදරයෙන් පිළිගනිමු. පළමු පියවර: කඩදාසියක ලිවීමට හෝ ඇප් එක තුළ ටයිප් කිරීමට ක්‍රමයක් තෝරන්න. දෙවන පියවර: ස්ටාර්ට් ඩික්ටේෂන් බොත්තම ඔබා, අයි ඈම් රෙඩි බොත්තම ඔබන්න. සෑම වචනයක්ම දෙවරක් කියවන අතර ලිවීමට තත්පර පහක් ලැබේ. ඔබට ඕනෑම විටක වචනය නැවත ඇසීමට, සෙමින් ඇසීමට, වාක්‍යය ඇසීමට හෝ අකුරු වෙන වෙනම ඇසීමට හැකිය. දැන්ම ආරම්භ කිරීමට ස්ටාර්ට් ප්‍රැක්ටිසින් බොත්තම ඔබන්න.';
const EXTRA = [
  {w:'bicycle', s:'She rides her bicycle to work every morning.'},
  {w:'motorbike', s:'He rode his motorbike along the coast.'},
  {w:'bus stop', s:'We waited at the bus stop for the next bus.'},
  {w:'train station', s:'Meet me at the train station before noon.'}
];
function cleanWord(word) { return String(word == null ? '' : word).split('/')[0].trim(); }
function slugWord(word) { return cleanWord(word).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function sessionEntries() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/session.json'), 'utf8'));
  return (data.lists || []).flatMap(list => list.words || []);
}
function allEntries() {
  const seen = new Set();
  return sessionEntries().concat(EXTRA).filter(entry => {
    const slug = slugWord(entry.w || entry.word);
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}
function allWords() { return allEntries().map(entry => cleanWord(entry.w || entry.word)); }
function spelling(word) {
  return cleanWord(word).split(/\s+/).map(part => part.toUpperCase().split('').join('. ') + '.').join(' Space. ') + ' ' + cleanWord(word) + '.';
}
function buildManifest() {
  const clips = [];
  const add = (file, text, kind, voice = EN) => clips.push({file, text, kind, voice});
  add('welcome-paper.mp3', "Welcome. Prepare your pen and paper. Each word is read twice. Click I'm ready to begin.", 'system');
  add('welcome-type.mp3', "Welcome. Each word is read twice. Type your answer and press Enter. Click I'm ready to begin.", 'system');
  add('guide-en.mp3', GUIDE_EN, 'guide');
  add('guide-si.mp3', GUIDE_SI, 'guide', SI);
  add('sound-check.mp3', 'Sound check. Number 1, afraid.', 'system');
  add('count-3.mp3', 'Three.', 'count');
  add('count-2.mp3', 'Two.', 'count');
  add('count-1.mp3', 'One.', 'count');
  add('countdown-321.mp3', 'Three, two, one.', 'count');
  add('paused.mp3', 'Session paused.', 'system');
  add('finish-paper.mp3', 'Dictation complete. Well done. Review all thirty words below.', 'system');
  add('finish-type.mp3', 'Dictation complete. Well done.', 'system');
  for (let n = 1; n <= 30; n++) {
    add('num-' + n + '.mp3', n === 30 ? 'Final word, number 30.' : 'Number ' + n + '.', 'number');
    add('resume-' + n + '.mp3', 'Welcome back. Continuing dictation number ' + n + '.', 'resume');
  }
  for (const entry of allEntries()) {
    const word = cleanWord(entry.w || entry.word);
    const slug = slugWord(word);
    const sentence = entry.ex || entry.s || entry.sentence;
    if (!sentence) throw new Error('Missing example sentence for ' + word);
    add('word-' + slug + '.mp3', word, 'word');
    add('sent-' + slug + '.mp3', sentence, 'sentence');
    add('spell-' + slug + '.mp3', spelling(word), 'spelling');
  }
  return {ver:46, engine:'Microsoft Edge neural TTS', englishVoice:EN, sinhalaVoice:SI,
    note:'Rendered with en-GB-SoniaNeural. scripts/render-offline.py is the offline espeak-ng fallback used when the neural endpoint is unreachable; re-run with --force to re-render the identical text in the neural voice.',
    clips, words:allWords()};
}
function writeManifest(manifest) { fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n'); }
function verify(manifest) {
  const errors = [];
  for (const clip of manifest.clips) {
    const file = path.join(AUDIO, clip.file);
    if (!fs.existsSync(file)) errors.push(clip.file + ': missing');
    else if (fs.statSync(file).size <= 1000) errors.push(clip.file + ': too small');
  }
  if (errors.length) {
    console.error('Audio pack incomplete (' + errors.length + '):\n' + errors.slice(0, 30).join('\n'));
    return false;
  }
  console.log('Audio pack verified: ' + manifest.clips.length + ' clips, all > 1000 bytes.');
  return true;
}
function main(argv) {
  const manifest = buildManifest();
  if (argv.includes('--verify')) return verify(manifest) ? 0 : 1;
  writeManifest(manifest);
  if (argv.includes('--manifest-only')) return 0;
  fs.mkdirSync(AUDIO, {recursive:true});
  const args = [path.join(__dirname, 'render-edge.py'), MANIFEST, AUDIO];
  if (argv.includes('--force')) args.push('--force');
  cp.execFileSync(process.env.PYTHON || 'python3', args, {stdio:'inherit', env:process.env});
  return verify(manifest) ? 0 : 1;
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = {buildManifest, slugWord, cleanWord, allWords, verify, AUDIO, GUIDE_EN, GUIDE_SI};
