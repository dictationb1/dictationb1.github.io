const { harness } = require('./app-harness.cjs');

function runBenchmark(iterations = 100, existingCount = 1000, incomingCount = 1000) {
  const { q, close } = harness();

  // Create baseline existing inbox messages
  const existingInbox = [];
  for (let i = 0; i < existingCount; i++) {
    existingInbox.push({
      id: 'msg_existing_' + i,
      ts: 1700000000000 + i,
      name: 'Student ' + i,
      text: 'Message content ' + i,
      contact: 'contact' + i + '@example.com',
      read: false,
      mine: false
    });
  }

  // Create incoming payload: 50% duplicate, 50% new
  const incomingInbox = [];
  for (let i = 500; i < 500 + incomingCount; i++) {
    incomingInbox.push({
      id: 'msg_existing_' + i,
      ts: 1700000050000 + i,
      name: 'Student ' + i,
      text: 'Incoming message ' + i,
      contact: 'contact' + i + '@example.com'
    });
  }
  const body = { inbox: incomingInbox };

  // Warmup run
  q.DB.data.inbox = [...existingInbox];
  q.Cloud.mergeInbox(body);

  // Timed benchmark runs
  const startTime = performance.now();
  for (let r = 0; r < iterations; r++) {
    q.DB.data.inbox = [...existingInbox];
    q.Cloud.mergeInbox(body);
  }
  const endTime = performance.now();
  const totalMs = endTime - startTime;
  const avgMs = totalMs / iterations;

  console.log(`[Benchmark] ${iterations} runs (${existingCount} existing, ${incomingCount} incoming):`);
  console.log(`  Total Time: ${totalMs.toFixed(2)} ms`);
  console.log(`  Avg / Run : ${avgMs.toFixed(4)} ms`);

  close();
  return { totalMs, avgMs };
}

if (require.main === module) {
  runBenchmark();
}

module.exports = { runBenchmark };
