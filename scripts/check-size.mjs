import { readFileSync } from 'node:fs';
import { gzipSizeSync } from 'gzip-size';

const LIMIT_KB = 15;
const path = 'dist/widget.iife.js';
const raw = readFileSync(path);
const gz = gzipSizeSync(raw);
const kb = gz / 1024;
console.log(`core gzip size: ${kb.toFixed(2)} KB (limit ${LIMIT_KB} KB)`);
if (kb > LIMIT_KB) {
  console.error(`FAIL: core exceeds ${LIMIT_KB} KB gzip budget`);
  process.exit(1);
}
console.log('PASS: within size budget');
