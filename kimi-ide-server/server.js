const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Wire log for debugging
const WIRE_LOG_FILE = path.join(__dirname, 'wire-debug.log');
function logWire(direction, data) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${direction}: ${data}\n`;
  fs.appendFileSync(WIRE_LOG_FILE, entry);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the new React client dist folder
// The client is built to kimi-ide-client/dist
const clientDistPath = path.join(__dirname, '..', 'kimi-ide-client', 'dist');
app.use(express.static(clientDistPath));

// Fallback to index.html for SPA routing
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Store active wire sessions
const sessions = new Map();

// Generate unique ID for JSON-RPC
function generateId() {
  return uuidv4();
}

// Spawn a Kimi wire process
function spawnWireSession() {
  const kimiPath = process.env.KIMI_PATH || 'kimi';
  const args = ['--wire', '--yolo'];
  
  console.log(`[Wire] Spawning: ${kimiPath} ${args.join(' ')}`);
  
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

// Send JSON-RPC message to wire process
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

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  
  // Spawn wire process for this client
  const wire = spawnWireSession();
  const sessionId = generateId();
  
  // Session state
  const session = {
    wire,
    sessionId,
    currentTurn: null, // { id, text, status }
    buffer: '',
    toolArgs: {},       // accumulate ToolCallPart args per tool_call_id
    activeToolId: null   // track which tool_call_id is currently streaming args
  };
  sessions.set(ws, session);
  
  // Forward wire stdout to WebSocket
  wire.stdout.on('data', (data) => {
    session.buffer += data.toString();
    
    // Process complete lines
    let lines = session.buffer.split('\n');
    session.buffer = lines.pop(); // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Log full line for debugging (don't truncate - breaks JSON parsing!)
      console.log('[← Wire]:', line.length > 500 ? line.slice(0, 500) + '...' : line);
      logWire('WIRE_IN', line);
      
      try {
        const msg = JSON.parse(line);
        
        // Handle event notifications (no response needed)
        if (msg.method === 'event' && msg.params) {
          const eventType = msg.params.type;
          const payload = msg.params.payload;
          
          // Track turn state
          if (eventType === 'TurnBegin') {
            session.currentTurn = {
              id: generateId(),
              text: '',
              status: 'streaming'
            };
            ws.send(JSON.stringify({
              type: 'turn_begin',
              turnId: session.currentTurn.id,
              userInput: payload?.user_input || ''
            }));
          }
          else if (eventType === 'ContentPart' && payload?.type === 'text') {
            // Accumulate streaming text
            if (session.currentTurn) {
              session.currentTurn.text += payload.text;
            }
            const wsMsg = JSON.stringify({
              type: 'content',
              text: payload.text,
              turnId: session.currentTurn?.id
            });
            logWire('WS_OUT', wsMsg);
            ws.send(wsMsg);
          }
          else if (eventType === 'ContentPart' && payload?.type === 'think') {
            // Forward thinking content - note: field is 'think' not 'text'
            const thinkingText = payload.think || '';
            console.log('[Think] Received thinking:', thinkingText.slice(0, 100));
            ws.send(JSON.stringify({
              type: 'thinking',
              text: thinkingText,
              turnId: session.currentTurn?.id
            }));
          }
          else if (eventType === 'ContentPart') {
            console.log('[ContentPart] Unknown type:', payload?.type, 'payload:', JSON.stringify(payload).slice(0, 200));
          }
          else if (eventType === 'ToolCall') {
            const toolName = payload?.function?.name || 'unknown';
            const toolCallId = payload?.id || '';
            session.activeToolId = toolCallId;
            session.toolArgs[toolCallId] = '';
            ws.send(JSON.stringify({
              type: 'tool_call',
              toolName,
              toolCallId,
              turnId: session.currentTurn?.id
            }));
          }
          else if (eventType === 'ToolCallPart') {
            if (session.activeToolId && payload?.arguments_part) {
              session.toolArgs[session.activeToolId] += payload.arguments_part;
            }
          }
          else if (eventType === 'ToolResult') {
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
          }
          else if (eventType === 'TurnEnd') {
            if (session.currentTurn) {
              session.currentTurn.status = 'complete';
              ws.send(JSON.stringify({
                type: 'turn_end',
                turnId: session.currentTurn.id,
                fullText: session.currentTurn.text
              }));
            }
          }
          else if (eventType === 'StepBegin') {
            ws.send(JSON.stringify({
              type: 'step_begin',
              stepNumber: payload?.n
            }));
          }
          else if (eventType === 'StatusUpdate') {
            ws.send(JSON.stringify({
              type: 'status_update',
              contextUsage: payload?.context_usage,
              tokenUsage: payload?.token_usage
            }));
          }
          else {
            // Other events - forward raw for debugging
            ws.send(JSON.stringify({
              type: 'event',
              eventType,
              payload
            }));
          }
        }
        
        // Handle requests from agent (need response)
        else if (msg.method === 'request' && msg.params) {
          ws.send(JSON.stringify({
            type: 'request',
            requestType: msg.params.type,
            payload: msg.params.payload,
            requestId: msg.id
          }));
        }
        
        // Handle responses to our requests
        else if (msg.id !== undefined && msg.result !== undefined) {
          ws.send(JSON.stringify({
            type: 'response',
            id: msg.id,
            result: msg.result
          }));
        }
        
        // Handle errors
        else if (msg.id !== undefined && msg.error !== undefined) {
          ws.send(JSON.stringify({
            type: 'error',
            id: msg.id,
            error: msg.error
          }));
        }
        
        else {
          // Unknown message format
          ws.send(JSON.stringify({
            type: 'unknown',
            data: msg
          }));
        }
      } catch (err) {
        console.error('[Wire] Parse error:', err.message);
        ws.send(JSON.stringify({
          type: 'parse_error',
          line: line.slice(0, 200)
        }));
      }
    }
  });
  
  // Handle messages from client
  ws.on('message', (message) => {
    const text = message.toString();
    console.log('[WS →]:', text.slice(0, 200));
    
    try {
      const clientMsg = JSON.parse(text);
      
      if (clientMsg.type === 'prompt') {
        // Send prompt to wire
        const id = generateId();
        sendToWire(wire, 'prompt', { user_input: clientMsg.user_input }, id);
      }
      else if (clientMsg.type === 'response') {
        // Client responding to agent request
        sendToWire(wire, 'response', clientMsg.payload, clientMsg.requestId);
      }
      else if (clientMsg.type === 'initialize') {
        // Initialize handshake
        const id = generateId();
        sendToWire(wire, 'initialize', {
          protocol_version: '1.4',
          client: { name: 'kimi-ide', version: '0.1.0' },
          capabilities: { supports_question: true }
        }, id);
      }
    } catch (err) {
      // Not JSON - treat as raw text prompt
      const id = generateId();
      sendToWire(wire, 'prompt', { user_input: text }, id);
    }
  });
  
  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    const session = sessions.get(ws);
    if (session && session.wire) {
      session.wire.kill();
    }
    sessions.delete(ws);
  });
  
  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId
  }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] Kimi path: ${process.env.KIMI_PATH || 'kimi'}`);
});
