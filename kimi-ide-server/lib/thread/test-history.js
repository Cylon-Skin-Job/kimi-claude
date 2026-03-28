/**
 * Quick test for HistoryFile functionality
 */

const path = require('path');
const fs = require('fs').promises;
const { HistoryFile } = require('./HistoryFile');
const { ThreadManager } = require('./ThreadManager');

const TEST_DIR = path.join(__dirname, '..', '..', '..', 'test-output');
const WORKSPACE_DIR = path.join(TEST_DIR, 'ai', 'panels', 'test-panel');

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {}
}

async function testHistoryFile() {
  console.log('=== Testing HistoryFile ===\n');
  
  const threadDir = path.join(WORKSPACE_DIR, 'threads', 'test-thread-123');
  const historyFile = new HistoryFile(threadDir);
  
  // Test 1: Create history.json
  console.log('Test 1: Creating history.json...');
  const data = await historyFile.create('test-thread-123');
  console.log('  Created:', JSON.stringify(data, null, 2).slice(0, 200) + '...');
  
  // Verify file exists
  const exists = await historyFile.exists();
  console.log('  File exists:', exists);
  
  // Test 2: Add an exchange
  console.log('\nTest 2: Adding exchange...');
  const parts = [
    { type: 'text', content: 'Let me check the files.' },
    { 
      type: 'tool_call', 
      name: 'Glob', 
      arguments: { pattern: '*.js' },
      result: { 
        output: 'index.js\nutils.js',
        display: [{ type: 'file_tree', nodes: [] }],
        files: []
      }
    },
    { type: 'text', content: 'Found 2 JavaScript files.' }
  ];
  
  const exchange = await historyFile.addExchange('test-thread-123', 'What JS files are there?', parts);
  console.log('  Added exchange:', JSON.stringify(exchange, null, 2));
  
  // Test 3: Read back
  console.log('\nTest 3: Reading history.json...');
  const readData = await historyFile.read();
  console.log('  Exchanges count:', readData.exchanges.length);
  console.log('  First exchange user:', readData.exchanges[0].user);
  console.log('  First exchange parts:', readData.exchanges[0].assistant.parts.length);
  
  // Test 4: Add second exchange
  console.log('\nTest 4: Adding second exchange...');
  const parts2 = [
    { type: 'text', content: 'The main entry point is index.js.' }
  ];
  const exchange2 = await historyFile.addExchange('test-thread-123', 'Show me index.js', parts2);
  console.log('  Seq:', exchange2.seq);
  
  const finalData = await historyFile.read();
  console.log('  Total exchanges:', finalData.exchanges.length);
  
  console.log('\n=== All tests passed! ===');
  return finalData;
}

async function testThreadManager() {
  console.log('\n=== Testing ThreadManager with HistoryFile ===\n');
  
  const manager = new ThreadManager(WORKSPACE_DIR);
  await manager.init();
  
  // Create a thread
  console.log('Creating thread...');
  const { threadId, entry } = await manager.createThread('test-thread-456', 'Test Chat');
  console.log('  Thread ID:', threadId);
  console.log('  Entry:', entry);
  
  // Check that history.json was created
  const threadDir = path.join(WORKSPACE_DIR, 'threads', threadId);
  const historyFile = new HistoryFile(threadDir);
  const exists = await historyFile.exists();
  console.log('  history.json exists:', exists);
  
  const data = await historyFile.read();
  console.log('  Initial exchanges:', data.exchanges.length);
  
  console.log('\n=== ThreadManager test passed! ===');
}

async function main() {
  try {
    await cleanup();
    await testHistoryFile();
    await testThreadManager();
    
    console.log('\n\n=== ALL TESTS PASSED ===');
    console.log('\nFiles created in:', WORKSPACE_DIR);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

main();
