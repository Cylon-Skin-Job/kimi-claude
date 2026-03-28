/**
 * WebSocket Handler Tests
 * 
 * Tests the ThreadWebSocketHandler module
 * Run with: node lib/thread/ws-test.js
 */

const path = require('path');
const fs = require('fs').promises;
const { ThreadWebSocketHandler, ThreadManager } = require('./index');

const TEST_DIR = path.join(__dirname, '.test-ws');
const AI_PANELS_PATH = TEST_DIR;

// Mock WebSocket
class MockWebSocket {
  constructor() {
    this.messages = [];
    this.closed = false;
  }
  
  send(data) {
    this.messages.push(JSON.parse(data));
  }
  
  close() {
    this.closed = true;
  }
  
  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }
  
  findMessage(type) {
    return this.messages.find(m => m.type === type);
  }
}

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {}
}

async function testPanelSetup() {
  console.log('\n🏢 Testing panel setup...');

  const ws = new MockWebSocket();

  // Set panel
  ThreadWebSocketHandler.setPanel(ws, 'test-panel', AI_PANELS_PATH);

  const state = ThreadWebSocketHandler.getState(ws);
  if (!state) throw new Error('State should be set');
  if (state.panelId !== 'test-panel') throw new Error('Wrong panel ID');
  if (!state.threadManager) throw new Error('ThreadManager should be created');

  console.log('✅ Panel setup works');
}

async function testThreadCreate() {
  console.log('\n📝 Testing thread:create...');
  
  const ws = new MockWebSocket();
  ThreadWebSocketHandler.setPanel(ws, 'create-test', AI_PANELS_PATH);
  
  // Clear messages from setPanel
  ws.messages = [];
  
  // Create thread
  await ThreadWebSocketHandler.handleThreadCreate(ws, {});
  
  const created = ws.findMessage('thread:created');
  if (!created) throw new Error('Should receive thread:created');
  if (!created.threadId) throw new Error('Should have threadId');
  if (created.thread.name !== 'New Chat') throw new Error('Should have default name');
  
  // Should also get thread:list
  const list = ws.findMessage('thread:list');
  if (!list) throw new Error('Should receive thread:list');
  if (list.threads.length !== 1) throw new Error('Should have 1 thread');
  
  // Should also get thread:opened (auto-open)
  const opened = ws.findMessage('thread:opened');
  if (!opened) throw new Error('Should auto-open new thread');
  
  console.log('✅ Thread create works');
}

async function testThreadRename() {
  console.log('\n✏️ Testing thread:rename...');
  
  const ws = new MockWebSocket();
  ThreadWebSocketHandler.setPanel(ws, 'rename-test', AI_PANELS_PATH);
  ws.messages = [];
  
  // Create thread first
  await ThreadWebSocketHandler.handleThreadCreate(ws, { name: 'Old Name' });
  const created = ws.findMessage('thread:created');
  const threadId = created.threadId;
  
  // Clear messages
  ws.messages = [];
  
  // Rename
  await ThreadWebSocketHandler.handleThreadRename(ws, { threadId, name: 'New Name' });
  
  const renamed = ws.findMessage('thread:renamed');
  if (!renamed) throw new Error('Should receive thread:renamed');
  if (renamed.name !== 'New Name') throw new Error('Name should be updated');
  
  console.log('✅ Thread rename works');
}

async function testThreadDelete() {
  console.log('\n🗑️ Testing thread:delete...');
  
  const ws = new MockWebSocket();
  ThreadWebSocketHandler.setPanel(ws, 'delete-test', AI_PANELS_PATH);
  ws.messages = [];
  
  // Create thread
  await ThreadWebSocketHandler.handleThreadCreate(ws, {});
  const created = ws.findMessage('thread:created');
  const threadId = created.threadId;
  
  // Verify it exists
  let list = await ThreadWebSocketHandler.getCurrentThreadManager(ws).listThreads();
  if (list.length !== 1) throw new Error('Should have 1 thread before delete');
  
  ws.messages = [];
  
  // Delete
  await ThreadWebSocketHandler.handleThreadDelete(ws, { threadId });
  
  const deleted = ws.findMessage('thread:deleted');
  if (!deleted) throw new Error('Should receive thread:deleted');
  if (deleted.threadId !== threadId) throw new Error('Wrong threadId');
  
  // Verify it's gone
  list = await ThreadWebSocketHandler.getCurrentThreadManager(ws).listThreads();
  if (list.length !== 0) throw new Error('Should have 0 threads after delete');
  
  console.log('✅ Thread delete works');
}

async function testMessageSend() {
  console.log('\n💬 Testing message:send...');
  
  const ws = new MockWebSocket();
  ThreadWebSocketHandler.setPanel(ws, 'msg-test', AI_PANELS_PATH);
  ws.messages = [];
  
  // Create and open thread
  await ThreadWebSocketHandler.handleThreadCreate(ws, {});
  const created = ws.findMessage('thread:created');
  const threadId = created.threadId;
  
  ws.messages = [];
  
  // Send message
  await ThreadWebSocketHandler.handleMessageSend(ws, { content: 'Hello world' });
  
  const sent = ws.findMessage('message:sent');
  if (!sent) throw new Error('Should receive message:sent');
  if (sent.content !== 'Hello world') throw new Error('Wrong content');
  
  // Verify it was saved
  const history = await ThreadWebSocketHandler.getCurrentThreadManager(ws).getHistory(threadId);
  if (!history || history.messages.length !== 1) throw new Error('Message should be saved');
  if (history.messages[0].content !== 'Hello world') throw new Error('Wrong saved content');
  
  console.log('✅ Message send works');
}

async function testThreadSwitching() {
  console.log('\n🔄 Testing thread switching...');
  
  const ws = new MockWebSocket();
  ThreadWebSocketHandler.setPanel(ws, 'switch-test', AI_PANELS_PATH);
  ws.messages = [];
  
  // Create two threads
  await ThreadWebSocketHandler.handleThreadCreate(ws, { name: 'Thread A' });
  const threadA = ws.findMessage('thread:created').threadId;
  
  // Add message to A
  await ThreadWebSocketHandler.handleMessageSend(ws, { content: 'Message in A' });
  
  // Create thread B
  ws.messages = [];
  await ThreadWebSocketHandler.handleThreadCreate(ws, { name: 'Thread B' });
  const threadB = ws.findMessage('thread:created').threadId;
  
  // Add message to B
  await ThreadWebSocketHandler.handleMessageSend(ws, { content: 'Message in B' });
  
  // Verify current thread is B
  if (ThreadWebSocketHandler.getCurrentThreadId(ws) !== threadB) {
    throw new Error('Current thread should be B');
  }
  
  // Switch back to A
  ws.messages = [];
  await ThreadWebSocketHandler.handleThreadOpen(ws, { threadId: threadA });
  
  const opened = ws.findMessage('thread:opened');
  if (!opened) throw new Error('Should receive thread:opened');
  if (opened.threadId !== threadA) throw new Error('Should open thread A');
  
  // Verify history is from A
  if (opened.history.length !== 1) throw new Error('Thread A should have 1 message');
  if (opened.history[0].content !== 'Message in A') throw new Error('Wrong history');
  
  console.log('✅ Thread switching works');
}

async function testCleanup() {
  console.log('\n🧹 Testing cleanup...');
  
  const ws = new MockWebSocket();
  ThreadWebSocketHandler.setPanel(ws, 'cleanup-test', AI_PANELS_PATH);
  ws.messages = [];
  
  // Create thread
  await ThreadWebSocketHandler.handleThreadCreate(ws, {});
  
  // Cleanup
  ThreadWebSocketHandler.cleanup(ws);
  
  // State should be cleared
  const state = ThreadWebSocketHandler.getState(ws);
  if (state) throw new Error('State should be cleared');
  
  console.log('✅ Cleanup works');
}

async function runTests() {
  console.log('🧪 WebSocket Handler Tests');
  console.log('==========================');
  
  try {
    await cleanup();
    
    await testPanelSetup();
    await testThreadCreate();
    await testThreadRename();
    await testThreadDelete();
    await testMessageSend();
    await testThreadSwitching();
    await testCleanup();
    
    console.log('\n==========================');
    console.log('✅ All WebSocket tests passed!');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests, MockWebSocket };
