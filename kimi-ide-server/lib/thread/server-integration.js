/**
 * Server Integration for Thread Management
 * 
 * This module provides the glue between the existing server.js WebSocket handling
 * and the new thread management system.
 * 
 * Usage: Replace the wss.on('connection', ...) handler in server.js with
 * the handler exported from this module.
 */

const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4, v4: generateId } = require('uuid');
const { ThreadWebSocketHandler } = require('./index');

// AI workspaces base path
const AI_WORKSPACES_PATH = path.join(__dirname, '..', '..', '..', 'ai', 'workspaces');

/**
 * Create a wire process for a thread
 * @param {string} threadId - Thread ID (Kimi session ID)
 * @param {string} projectRoot - Project root for --work-dir
 * @returns {import('child_process').ChildProcess}
 */
function spawnThreadWire(threadId, projectRoot) {
  const kimiPath = process.env.KIMI_PATH || 'kimi';
  const args = ['--wire', '--yolo', '--session', threadId];
  
  if (projectRoot) {
    args.push('--work-dir', projectRoot);
  }
  
  console.log(`[Wire] Spawning thread session: ${kimiPath} ${args.join(' ')}`);
  
  const proc = spawn(kimiPath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, TERM: 'xterm-256color' }
  });
  
  proc.on('error', (err) => {
    console.error('[Wire] Failed to spawn:', err.message);
  });
  
  proc.on('exit', (code) => {
    console.log(`[Wire] Process exited with code ${code}`);
  });
  
  proc.stderr.on('data', (data) => {
    console.error('[Wire stderr]:', data.toString().trim());
  });
  
  return proc;
}

/**
 * Send JSON-RPC message to wire process
 */
function sendToWire(wire, method, params, id = null) {
  const message = {
    jsonrpc: '2.0',
    method,
    params
  };
  if (id) {
    message.id = id;
  }
  const json = JSON.stringify(message);
  console.log('[→ Wire]:', json.slice(0, 200));
  wire.stdin.write(json + '\n');
}

/**
 * Create WebSocket connection handler with thread support
 * 
 * @param {object} options
 * @param {object} options.sessions - Map to store session state (ws -> session)
 * @param {Function} options.getDefaultProjectRoot - Function to get project root
 * @param {Function} options.logWire - Function to log wire messages
 * @param {Function} [options.setSessionRoot] - Optional: existing workspace root management
 * @param {Function} [options.getSessionRoot] - Optional: existing workspace root management
 * @returns {Function} WebSocket connection handler
 */
function createWebSocketHandler(options) {
  const { sessions, getDefaultProjectRoot, logWire } = options;
  
  return function handleConnection(ws) {
    console.log('[WS] Client connected (thread-enabled)');
    
    const projectRoot = getDefaultProjectRoot();
    const connectionId = generateId();
    
    // Session state (no wire process yet - created on thread open)
    const session = {
      connectionId,
      wire: null,
      currentTurn: null,
      buffer: '',
      toolArgs: {},
      activeToolId: null,
      hasToolCalls: false
    };
    sessions.set(ws, session);
    
    // Set default workspace (can be changed by client)
    ThreadWebSocketHandler.setWorkspace(ws, 'default', AI_WORKSPACES_PATH);
    
    // Send thread list on connect
    ThreadWebSocketHandler.sendThreadList(ws);
    
    // Handle wire process output
    function setupWireHandlers(wire) {
      wire.stdout.on('data', (data) => {
        session.buffer += data.toString();
        
        let lines = session.buffer.split('\n');
        session.buffer = lines.pop();
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          console.log('[← Wire]:', line.length > 500 ? line.slice(0, 500) + '...' : line);
          logWire('WIRE_IN', line);
          
          try {
            const msg = JSON.parse(line);
            handleWireMessage(msg, ws, session);
          } catch (err) {
            console.error('[Wire] Parse error:', err.message);
            ws.send(JSON.stringify({ type: 'parse_error', line: line.slice(0, 200) }));
          }
        }
      });
      
      wire.on('exit', (code) => {
        console.log(`[Wire] Session ${session.connectionId} exited with code ${code}`);
        session.wire = null;
        ws.send(JSON.stringify({ type: 'wire_disconnected', code }));
      });
    }
    
    // Handle messages from wire process
    function handleWireMessage(msg, ws, session) {
      // Event notifications
      if (msg.method === 'event' && msg.params) {
        const { type: eventType, payload } = msg.params;
        
        switch (eventType) {
          case 'TurnBegin':
            session.currentTurn = {
              id: generateId(),
              text: '',
              status: 'streaming'
            };
            session.hasToolCalls = false;
            ws.send(JSON.stringify({
              type: 'turn_begin',
              turnId: session.currentTurn.id,
              userInput: payload?.user_input || ''
            }));
            break;
            
          case 'ContentPart':
            if (payload?.type === 'text' && session.currentTurn) {
              session.currentTurn.text += payload.text;
              ws.send(JSON.stringify({
                type: 'content',
                text: payload.text,
                turnId: session.currentTurn.id
              }));
            } else if (payload?.type === 'think') {
              ws.send(JSON.stringify({
                type: 'thinking',
                text: payload.think || '',
                turnId: session.currentTurn?.id
              }));
            }
            break;
            
          case 'ToolCall':
            session.hasToolCalls = true;
            session.activeToolId = payload?.id || '';
            session.toolArgs[session.activeToolId] = '';
            ws.send(JSON.stringify({
              type: 'tool_call',
              toolName: payload?.function?.name || 'unknown',
              toolCallId: session.activeToolId,
              turnId: session.currentTurn?.id
            }));
            break;
            
          case 'ToolCallPart':
            if (session.activeToolId && payload?.arguments_part) {
              session.toolArgs[session.activeToolId] += payload.arguments_part;
            }
            break;
            
          case 'ToolResult': {
            const toolCallId = payload?.tool_call_id || '';
            const fullArgs = session.toolArgs[toolCallId] || '';
            let parsedArgs = {};
            try { parsedArgs = JSON.parse(fullArgs); } catch (_) {}
            delete session.toolArgs[toolCallId];
            
            ws.send(JSON.stringify({
              type: 'tool_result',
              toolCallId,
              toolArgs: parsedArgs,
              toolOutput: payload?.return_value?.output || '',
              toolDisplay: payload?.return_value?.display || [],
              isError: payload?.return_value?.is_error || false,
              turnId: session.currentTurn?.id
            }));
            break;
          }
            
          case 'TurnEnd':
            if (session.currentTurn) {
              session.currentTurn.status = 'complete';
              
              // Save assistant message to thread
              ThreadWebSocketHandler.addAssistantMessage(
                ws,
                session.currentTurn.text,
                session.hasToolCalls
              );
              
              ws.send(JSON.stringify({
                type: 'turn_end',
                turnId: session.currentTurn.id,
                fullText: session.currentTurn.text,
                hasToolCalls: session.hasToolCalls
              }));
            }
            break;
            
          case 'StepBegin':
            ws.send(JSON.stringify({ type: 'step_begin', stepNumber: payload?.n }));
            break;
            
          case 'StatusUpdate':
            ws.send(JSON.stringify({
              type: 'status_update',
              contextUsage: payload?.context_usage,
              tokenUsage: payload?.token_usage
            }));
            break;
            
          default:
            ws.send(JSON.stringify({ type: 'event', eventType, payload }));
        }
      }
      
      // Requests from agent
      else if (msg.method === 'request' && msg.params) {
        ws.send(JSON.stringify({
          type: 'request',
          requestType: msg.params.type,
          payload: msg.params.payload,
          requestId: msg.id
        }));
      }
      
      // Responses to our requests
      else if (msg.id !== undefined && msg.result !== undefined) {
        ws.send(JSON.stringify({ type: 'response', id: msg.id, result: msg.result }));
      }
      
      // Errors
      else if (msg.id !== undefined && msg.error !== undefined) {
        ws.send(JSON.stringify({ type: 'error', id: msg.id, error: msg.error }));
      }
      
      else {
        ws.send(JSON.stringify({ type: 'unknown', data: msg }));
      }
    }
    
    // Handle messages from client
    ws.on('message', async (message) => {
      const text = message.toString();
      console.log('[WS →]:', text.slice(0, 200));
      
      try {
        const clientMsg = JSON.parse(text);
        
        // Thread management messages
        switch (clientMsg.type) {
          case 'thread:create':
            await ThreadWebSocketHandler.handleThreadCreate(ws, clientMsg);
            return;
            
          case 'thread:open': {
            const state = ThreadWebSocketHandler.getState(ws);
            const { threadId } = clientMsg;
            
            // Close current wire if any
            if (session.wire) {
              session.wire.kill('SIGTERM');
              session.wire = null;
            }
            
            // Open the thread
            await ThreadWebSocketHandler.handleThreadOpen(ws, clientMsg);
            
            // Spawn wire process with --session
            session.wire = spawnThreadWire(threadId, projectRoot);
            setupWireHandlers(session.wire);
            
            // Register with ThreadManager
            await state.threadManager.openSession(threadId, session.wire, ws);
            return;
          }
            
          case 'thread:rename':
            await ThreadWebSocketHandler.handleThreadRename(ws, clientMsg);
            return;
            
          case 'thread:delete':
            await ThreadWebSocketHandler.handleThreadDelete(ws, clientMsg);
            return;
            
          case 'thread:list':
            await ThreadWebSocketHandler.sendThreadList(ws);
            return;
        }
        
        // Wire protocol messages (require active wire)
        if (!session.wire) {
          ws.send(JSON.stringify({ type: 'error', message: 'No thread open' }));
          return;
        }
        
        switch (clientMsg.type) {
          case 'prompt': {
            // Track message in thread
            await ThreadWebSocketHandler.handleMessageSend(ws, {
              content: clientMsg.user_input
            });
            
            // Send to wire
            const id = generateId();
            sendToWire(session.wire, 'prompt', { user_input: clientMsg.user_input }, id);
            break;
          }
            
          case 'response':
            sendToWire(session.wire, 'response', clientMsg.payload, clientMsg.requestId);
            break;
            
          case 'initialize': {
            const id = generateId();
            sendToWire(session.wire, 'initialize', {
              protocol_version: '1.4',
              client: { name: 'kimi-ide', version: '0.1.0' },
              capabilities: { supports_question: true }
            }, id);
            break;
          }
            
          default:
            // Unknown message type
            console.log('[WS] Unknown message type:', clientMsg.type);
        }
        
      } catch (err) {
        console.error('[WS] Message handling error:', err);
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });
    
    // Handle disconnect
    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      
      // Clean up thread state
      ThreadWebSocketHandler.cleanup(ws);
      
      // Kill wire process
      if (session.wire && !session.wire.killed) {
        session.wire.kill('SIGTERM');
      }
      
      sessions.delete(ws);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      connectionId,
      message: 'Thread-enabled connection established'
    }));
  };
}

module.exports = {
  createWebSocketHandler,
  spawnThreadWire,
  AI_WORKSPACES_PATH
};
