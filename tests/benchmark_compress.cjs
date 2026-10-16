const { performance } = require('perf_hooks');

function testBaseline(array) {
  var binary = "";
  for (var i = 0; i < array.length; i++) binary += String.fromCharCode(array[i]);
  return binary;
}

function testChunked(array) {
  var binary = "", CHUNK = 8192;
  for (var i = 0; i < array.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, array.subarray(i, i + CHUNK));
  }
  return binary;
}

function runBenchmark() {
  const sizes = [1000, 10000, 50000, 100000];
  const iterations = 200;

  console.log("=== Compression Binary Conversion Benchmark ===");

  sizes.forEach(size => {
    const array = new Uint8Array(size);
    for (let i = 0; i < size; i++) array[i] = i % 256;

    // Verify output match
    const baseRes = testBaseline(array);
    const chunkRes = testChunked(array);
    if (baseRes !== chunkRes) {
      throw new Error(`Mismatch at size ${size}`);
    }

    // Warmup
    for (let i = 0; i < 10; i++) {
      testBaseline(array);
      testChunked(array);
    }

    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      testBaseline(array);
    }
    const baselineTime = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      testChunked(array);
    }
    const chunkedTime = performance.now() - t1;

    console.log(`\nArray Size: ${size} bytes (${iterations} iterations)`);
    console.log(`  Baseline (loop):         ${baselineTime.toFixed(2)} ms`);
    console.log(`  Optimized (chunked apply): ${chunkedTime.toFixed(2)} ms`);
    console.log(`  Speedup:                 ${(baselineTime / chunkedTime).toFixed(2)}x`);
  });
}

runBenchmark();
