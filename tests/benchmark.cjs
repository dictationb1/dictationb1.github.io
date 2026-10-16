'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const sourceMatch = html.match(/<script type="text\/plain" id="gas-source">([\s\S]*?)<\/script>/);
if (!sourceMatch) {
  console.error("Could not find gas-source script block");
  process.exit(1);
}
const source = sourceMatch[1];

function createMockContext(rowCount) {
  const listsRows = [];
  // Build row data with chunks of JSON items for 100 unique lists
  for (let i = 0; i < rowCount; i++) {
    const listId = 'list_' + (i % 100);
    const items = JSON.stringify([{ w: 'word_' + i, s: 'sentence_' + i, m: 'meaning_' + i }]);
    listsRows.push([listId, 'List Name ' + listId, items, 1]);
  }

  const tables = {
    Lists: {
      getLastRow: () => listsRows.length + 1,
      getLastColumn: () => 4,
      getRange: (r, c, n, m) => ({
        getValues: () => listsRows.slice(r - 2, r - 2 + n)
      })
    },
    Config: {
      getLastRow: () => 0,
      getLastColumn: () => 0,
      getRange: () => ({ getValues: () => [] })
    },
    Plan: {
      getLastRow: () => 0,
      getLastColumn: () => 0,
      getRange: () => ({ getValues: () => [] })
    },
    Sessions: {
      getLastRow: () => 0,
      getLastColumn: () => 0,
      getRange: () => ({ getValues: () => [] })
    }
  };

  const context = vm.createContext({
    Date: Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => tables[n] || null }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { base64EncodeWebSafe: () => '', computeDigest: () => [], DigestAlgorithm: { SHA_256: 'SHA_256' } }
  });

  vm.runInContext(source, context);
  return context;
}

function runBenchmark() {
  const rowCount = 2000;
  const iterations = 50;
  const context = createMockContext(rowCount);

  // Warmup
  context.readState();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    // Clear script cache inside context to force recalculation of readState
    context.cachePut('state', null, 0);
    context.readState();
  }
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;

  console.log(`Benchmark (Rows=${rowCount}, Iterations=${iterations}):`);
  console.log(`Average execution time: ${avgMs.toFixed(3)} ms per call`);
  return avgMs;
}

runBenchmark();
