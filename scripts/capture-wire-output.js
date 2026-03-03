#!/usr/bin/env node
/**
 * Capture raw wire output for documentation.
 * Run: node scripts/capture-wire-output.js
 * Output: docs/wire-output-sample.jsonl
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'wire-output-sample.jsonl');
const PROMPT = process.argv[2] || 'What is 2 + 2? Think step by step.';
const TIMEOUT_MS = 30000; // 30 seconds max

const kimiPath = process.env.KIMI_PATH || 'kimi';
const wire = spawn(kimiPath, ['--wire', '--yolo'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

const lines = [];
let sawTurnEnd = false;

function send(msg) {
  const json = JSON.stringify(msg) + '\n';
  wire.stdin.write(json);
}

wire.stdout.on('data', (data) => {
  const text = data.toString();
  const chunkLines = text.split('\n').filter((l) => l.trim());
  for (const line of chunkLines) {
    lines.push(line);
    try {
      const msg = JSON.parse(line);
      if (msg.method === 'event' && msg.params?.type === 'TurnEnd') {
        sawTurnEnd = true;
      }
    } catch (_) {}
  }
});

wire.on('error', (err) => {
  console.error('[capture-wire] Spawn error:', err.message);
  process.exit(1);
});

// Initialize then prompt
send({
  jsonrpc: '2.0',
  method: 'initialize',
  id: 'init-1',
  params: {
    protocol_version: '1.4',
    client: { name: 'capture-script', version: '0.1.0' },
    capabilities: {}
  }
});

setTimeout(() => {
  send({
    jsonrpc: '2.0',
    method: 'prompt',
    id: 'prompt-1',
    params: { user_input: PROMPT }
  });
}, 500);

// Stop after TurnEnd or timeout
const checkInterval = setInterval(() => {
  if (sawTurnEnd) {
    clearInterval(checkInterval);
    wire.kill('SIGTERM');
    finish();
  }
}, 200);

setTimeout(() => {
  clearInterval(checkInterval);
  wire.kill('SIGTERM');
  finish();
}, TIMEOUT_MS);

function finish() {
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`[capture-wire] Wrote ${lines.length} lines to ${OUTPUT_PATH}`);
  process.exit(0);
}
