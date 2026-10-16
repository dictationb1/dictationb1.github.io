const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,html}=require('./app-harness.cjs');
const fs = require('fs');

const expected = ['athlete', 'athletics', 'badminton', 'champion', 'climbing', 'competitor', 'cycling', 'cyclist', 'diving', 'extreme sports', 'fitness', 'goalkeeper', 'gymnastics', 'ice hockey', 'instructor', 'league', 'motor-racing', 'practice', 'practise', 'reserve', 'sailing', 'skiing', 'snowboarding', 'sports centre', 'squash', 'surf', 'surfboarding', 'swimming', 'table tennis', 'throw'];

const a=harness();

test('v2.0.0 is cleanly integrated', () => {
  assert(html.includes('APP_VERSION = "2.0.0"'));
  assert(html.includes('schema: 4,'));
  assert(html.includes('key: "sdp.v4_tue20",'));
  assert(html.includes('ntfyState: "sdp_dictationb1_state_v4",'));
  assert(html.includes('writeFixed: 5'));
  assert(html.includes('cancelAnimationFrame'));
  assert(html.includes('sdpAudio'));
});

test('Frontend U.clip sanitizes control chars, trims, and truncates length', () => {
  const U = a.q.U;
  assert.equal(U.clip(null, 10), '');
  assert.equal(U.clip(undefined, 10), '');
  assert.equal(U.clip(12345, 3), '123');
  assert.equal(U.clip(true, 10), 'true');
  assert.equal(U.clip('  hello   world  ', 20), 'hello   world');
  assert.equal(U.clip('a\u0000b\u0007c\u001fd\u007fe', 10), 'abcde');
  assert.equal(U.clip('Hello World', 5), 'Hello');
  assert.equal(U.clip('Hello World', 20), 'Hello World');
  assert.equal(U.clip('Hello World', 11), 'Hello World');
});

test('v2.0.0 repository data files match the app', () => {
  const read = f => JSON.parse(fs.readFileSync(require('node:path').resolve(__dirname, '../data/' + f), 'utf8'));
  const version = read('version.json'), cfg = read('config.json'), session = read('session.json');
  assert.equal(version.version, '2.0.0');
  assert.equal(version.ver, 4);
  assert.equal(cfg.ver, 4);
  assert.equal(session.ver, 4);
  assert.equal(session.session.title, 'Tuesday 20th dictation session');
  assert.equal(session.lists[0].words.length, 30);
  assert.deepEqual(session.lists[0].words.map(w => w.w), expected);
  assert(session.lists[0].words.every(w => w.m && w.s));
});

test.after(()=>a.close());
module.exports={sample: expected.join(',')};
