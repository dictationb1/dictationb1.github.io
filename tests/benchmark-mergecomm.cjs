const { harness } = require('./app-harness.cjs');
const assert = require('node:assert');

function testMergeCommCorrectness() {
  const h = harness();
  const { DB, Cloud, CONFIG } = h.q;

  CONFIG.maxComments = 1000;
  DB.data.comments = [
    { id: 'c1', text: 'First' },
    { id: 'c2', text: 'Second' }
  ];

  const body = {
    comments: [
      { id: 'c2', text: 'Duplicate Second' },
      { id: 'c3', text: 'Third' },
      { id: 'c3', text: 'Duplicate Third in body' },
      { id: 'c4', text: 'Fourth' },
      null,
      'invalid',
      { noId: true }
    ]
  };

  const added = Cloud.mergeComm(body);

  assert.strictEqual(added, 2, 'Should add exactly 2 new unique valid comments (c3 and c4)');
  assert.strictEqual(DB.data.comments.length, 4, 'Total comments should be 4');
  assert.deepStrictEqual(
    DB.data.comments.map(c => c.id),
    ['c1', 'c2', 'c3', 'c4'],
    'Comment IDs should match expected order'
  );

  console.log('[Correctness] mergeComm tests passed successfully.');
  h.close();
}

function runBenchmark() {
  const h = harness();
  const { DB, Cloud, CONFIG } = h.q;

  // Set up comments dataset for benchmarking
  CONFIG.maxComments = 10000;
  const N = 2000;
  const M = 2000;

  const initialComments = [];
  for (let i = 0; i < N; i++) {
    initialComments.push({
      id: 'c_exist_' + i,
      ts: Date.now(),
      name: 'User ' + i,
      status: 'comment',
      text: 'Comment ' + i,
      meta: '',
      pinned: false,
      hidden: false,
      mine: false,
      sent: true
    });
  }

  const body = {
    results: [],
    comments: []
  };

  // Half overlap (duplicates), half new
  for (let i = 0; i < M; i++) {
    const id = i < M / 2 ? 'c_exist_' + (i * 2) : 'c_new_' + i;
    body.comments.push({
      id: id,
      ts: Date.now(),
      name: 'Incoming User ' + i,
      status: 'comment',
      text: 'Incoming Comment ' + i
    });
  }

  // Warmup
  DB.data.comments = initialComments.slice();
  Cloud.mergeComm(body);

  const iterations = 50;
  const times = [];

  for (let it = 0; it < iterations; it++) {
    DB.data.comments = initialComments.slice();
    const start = performance.now();
    Cloud.mergeComm(body);
    const end = performance.now();
    times.push(end - start);
  }

  const totalTime = times.reduce((a, b) => a + b, 0);
  const avgTime = totalTime / iterations;

  console.log(`[Benchmark] mergeComm (${N} existing, ${M} incoming, ${iterations} runs)`);
  console.log(`Average time per call: ${avgTime.toFixed(4)} ms`);
  console.log(`Total time for ${iterations} iterations: ${totalTime.toFixed(2)} ms`);

  h.close();
  return { avgTime, totalTime };
}

testMergeCommCorrectness();
runBenchmark();
