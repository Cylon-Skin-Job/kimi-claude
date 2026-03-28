/**
 * Basic validation tests for thread management module
 * Run with: node lib/thread/test.js
 */

const path = require('path');
const fs = require('fs').promises;
const { ThreadIndex, ChatFile, ThreadManager, TOOL_CALL_MARKER } = require('./index');

const TEST_DIR = path.join(__dirname, '.test-temp');

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {}
}

async function testThreadIndex() {
  console.log('\n📁 Testing ThreadIndex...');
  
  const index = new ThreadIndex(TEST_DIR);
  await index.init();
  
  // Test create
  const entry = await index.create('test-thread-1', 'Test Thread');
  if (entry.name !== 'Test Thread') throw new Error('Create should set name');
  if (entry.status !== 'suspended') throw new Error('Create should set status');
  
  // Test get
  const got = await index.get('test-thread-1');
  if (got?.name !== 'Test Thread') throw new Error('Get should return entry');
  
  // Test list (MRU order)
  await index.create('test-thread-2', 'Second Thread');
  const list = await index.list();
  if (list.length !== 2) throw new Error('List should have 2 threads');
  if (list[0].threadId !== 'test-thread-2') throw new Error('First should be most recent');
  
  // Test activate (moves to front)
  await index.activate('test-thread-1');
  const list2 = await index.list();
  if (list2[0].threadId !== 'test-thread-1') throw new Error('Activate should move to front');
  if (list2[0].entry.status !== 'active') throw new Error('Activate should set status');
  
  // Test rename
  await index.rename('test-thread-1', 'Renamed Thread');
  const renamed = await index.get('test-thread-1');
  if (renamed?.name !== 'Renamed Thread') throw new Error('Rename should update name');
  
  // Test delete
  const deleted = await index.delete('test-thread-2');
  if (deleted !== true) throw new Error('Delete should return true');
  const list3 = await index.list();
  if (list3.length !== 1) throw new Error('Delete should remove thread');
  
  console.log('✅ ThreadIndex tests passed');
}

async function testChatFile() {
  console.log('\n📝 Testing ChatFile...');
  
  const threadDir = path.join(TEST_DIR, 'chat-test');
  const chatFile = new ChatFile(threadDir);
  
  // Test write and read
  const messages = [
    { role: 'user', content: 'Hello', hasToolCalls: false },
    { role: 'assistant', content: 'Hi there!', hasToolCalls: false },
    { role: 'user', content: 'Check server', hasToolCalls: false },
    { role: 'assistant', content: 'I\'ll check.', hasToolCalls: true },
    { role: 'assistant', content: 'Server is running.', hasToolCalls: false }
  ];
  
  await chatFile.write('Test Chat', messages);
  
  const parsed = await chatFile.read();
  if (parsed?.title !== 'Test Chat') throw new Error('Parse should extract title');
  if (parsed?.messages.length !== 5) throw new Error('Parse should find 5 messages');
  if (parsed?.messages[3].hasToolCalls !== true) throw new Error('Should detect tool calls');
  
  // Test append
  await chatFile.appendMessage('Test Chat', { 
    role: 'user', 
    content: 'Thanks!', 
    hasToolCalls: false 
  });
  
  const parsed2 = await chatFile.read();
  if (parsed2?.messages.length !== 6) throw new Error('Append should add message');
  
  console.log('✅ ChatFile tests passed');
}

async function testChatFileFormat() {
  console.log('\n🎨 Testing CHAT.md format...');
  
  const threadDir = path.join(TEST_DIR, 'format-test');
  const chatFile = new ChatFile(threadDir);
  
  // Write messages
  await chatFile.write('Server Status', [
    { role: 'user', content: 'Check my server', hasToolCalls: false },
    { role: 'assistant', content: 'I\'ll check it.', hasToolCalls: true },
    { role: 'assistant', content: 'Server is running on port 3001.', hasToolCalls: false }
  ]);
  
  // Read raw content
  const raw = await fs.readFile(path.join(threadDir, 'CHAT.md'), 'utf-8');
  console.log('Raw CHAT.md content:');
  console.log('---');
  console.log(raw);
  console.log('---');
  
  // Verify format
  if (!raw.startsWith('# Server Status')) throw new Error('Should have title header');
  if (!raw.includes('User\n\nCheck my server')) throw new Error('Should have user message');
  if (!raw.includes(TOOL_CALL_MARKER)) throw new Error('Should have tool call marker');
  if (raw.includes('2026-')) throw new Error('Should NOT have timestamps');
  
  console.log('✅ CHAT.md format tests passed');
}

async function testThreadManager() {
  console.log('\n⚙️  Testing ThreadManager...');
  
  const panelPath = path.join(TEST_DIR, 'panel');
  const manager = new ThreadManager(panelPath, {
    maxActiveSessions: 2,
    idleTimeoutMinutes: 1
  });
  
  await manager.init();
  
  // Test create
  const { threadId, entry } = await manager.createThread('thread-1');
  if (entry.name !== 'New Chat') throw new Error('Create should use default name');
  
  // Test add message
  await manager.addMessage(threadId, { role: 'user', content: 'Hello' });
  const updated = await manager.index.get(threadId);
  if (updated?.messageCount !== 1) throw new Error('Message count should increment');
  
  // Test get history
  const history = await manager.getHistory(threadId);
  if (history?.messages.length !== 1) throw new Error('History should have 1 message');
  
  // Test rename
  await manager.renameThread(threadId, 'My Thread');
  const renamed = await manager.index.get(threadId);
  if (renamed?.name !== 'My Thread') throw new Error('Rename should update');
  
  // Test list
  await manager.createThread('thread-2', 'Second');
  const list = await manager.listThreads();
  if (list.length !== 2) throw new Error('Should have 2 threads');
  
  // Test FIFO eviction (max 2 sessions)
  await manager.openSession('thread-1', { killed: false, kill: () => {} });
  await manager.openSession('thread-2', { killed: false, kill: () => {} });
  
  // Create third - should evict first
  await manager.createThread('thread-3', 'Third');
  await manager.openSession('thread-3', { killed: false, kill: () => {} });
  
  if (manager.isActive('thread-1')) throw new Error('Oldest should be evicted');
  if (!manager.isActive('thread-3')) throw new Error('Newest should be active');
  
  // Test close
  await manager.closeSession('thread-2');
  if (manager.isActive('thread-2')) throw new Error('Close should remove session');
  
  console.log('✅ ThreadManager tests passed');
}

async function runTests() {
  console.log('🧪 Thread Management Tests');
  console.log('==========================');
  
  try {
    await cleanup();
    
    await testThreadIndex();
    await testChatFile();
    await testChatFileFormat();
    await testThreadManager();
    
    console.log('\n==========================');
    console.log('✅ All tests passed!');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Run if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
