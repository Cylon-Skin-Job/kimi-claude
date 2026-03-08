const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const fsPromises = require('fs').promises;

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

// --- File Explorer Handlers ---

// Only 'code' workspace is filesystem-backed
const WORKSPACE_PATHS = {
  code: '.',
  wiki: null,
  rocket: null,
  issues: null,
  scheduler: null,
  skills: null,
  claw: null,
};

// Map Node.js error codes to protocol error codes
function mapFileErrorCode(err) {
  if (err.code === 'ENOENT') return 'ENOENT';
  if (err.code === 'EACCES' || err.code === 'EPERM') return 'EACCES';
  if (err.code === 'ENOTDIR') return 'ENOTDIR';
  if (err.code === 'EISDIR') return 'EISDIR';
  return 'UNKNOWN';
}

// Parse file extension: lowercase, no extension for dotfiles like .gitignore
function parseExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return undefined; // no extension or dotfile
  return filename.slice(lastDot + 1).toLowerCase();
}

async function handleFileTreeRequest(ws, msg) {
  const workspace = msg.workspace || 'code';
  const requestPath = msg.path || '';

  // Validate workspace is filesystem-backed
  if (WORKSPACE_PATHS[workspace] === null || WORKSPACE_PATHS[workspace] === undefined) {
    ws.send(JSON.stringify({
      type: 'file_tree_response',
      workspace,
      path: requestPath,
      success: false,
      error: `Workspace "${workspace}" is not filesystem-backed`,
      code: 'ENOTWORKSPACE',
    }));
    return;
  }

  const basePath = path.resolve(WORKSPACE_PATHS[workspace]);
  const targetPath = requestPath ? path.join(basePath, requestPath) : basePath;

  // Path traversal guard
  if (!path.resolve(targetPath).startsWith(basePath)) {
    ws.send(JSON.stringify({
      type: 'file_tree_response',
      workspace,
      path: requestPath,
      success: false,
      error: 'Invalid path',
      code: 'ENOENT',
    }));
    return;
  }

  try {
    const entries = await fsPromises.readdir(targetPath, { withFileTypes: true });

    // Large folder guard
    if (entries.length > 1000) {
      ws.send(JSON.stringify({
        type: 'file_tree_response',
        workspace,
        path: requestPath,
        success: false,
        error: `Folder has ${entries.length} items (max 1000). Use terminal to explore.`,
        code: 'ETOOLARGE',
      }));
      return;
    }

    // Build nodes: folders first, then files, both alphabetical
    const folders = [];
    const files = [];

    for (const entry of entries) {
      // Skip hidden files/folders starting with .
      if (entry.name.startsWith('.')) continue;
      // Skip node_modules
      if (entry.name === 'node_modules') continue;

      const entryPath = requestPath ? `${requestPath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        // Check if folder has children
        let hasChildren = false;
        try {
          const children = await fsPromises.readdir(path.join(targetPath, entry.name));
          hasChildren = children.length > 0;
        } catch (_) {
          // Permission denied or other error - show as empty
        }
        folders.push({
          name: entry.name,
          path: entryPath,
          type: 'folder',
          hasChildren,
        });
      } else if (entry.isFile()) {
        files.push({
          name: entry.name,
          path: entryPath,
          type: 'file',
          extension: parseExtension(entry.name),
        });
      }
    }

    // Sort: folders first (alphabetical), then files (alphabetical)
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    ws.send(JSON.stringify({
      type: 'file_tree_response',
      workspace,
      path: requestPath,
      success: true,
      nodes: [...folders, ...files],
    }));
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'file_tree_response',
      workspace,
      path: requestPath,
      success: false,
      error: err.message,
      code: mapFileErrorCode(err),
    }));
  }
}

async function handleFileContentRequest(ws, msg) {
  const workspace = msg.workspace || 'code';
  const requestPath = msg.path || '';

  // Validate workspace
  if (WORKSPACE_PATHS[workspace] === null || WORKSPACE_PATHS[workspace] === undefined) {
    ws.send(JSON.stringify({
      type: 'file_content_response',
      workspace,
      path: requestPath,
      success: false,
      error: `Workspace "${workspace}" is not filesystem-backed`,
      code: 'ENOTWORKSPACE',
    }));
    return;
  }

  const basePath = path.resolve(WORKSPACE_PATHS[workspace]);
  const targetPath = path.join(basePath, requestPath);

  // Path traversal guard
  if (!path.resolve(targetPath).startsWith(basePath)) {
    ws.send(JSON.stringify({
      type: 'file_content_response',
      workspace,
      path: requestPath,
      success: false,
      error: 'Invalid path',
      code: 'ENOENT',
    }));
    return;
  }

  try {
    const stat = await fsPromises.stat(targetPath);

    if (stat.isDirectory()) {
      ws.send(JSON.stringify({
        type: 'file_content_response',
        workspace,
        path: requestPath,
        success: false,
        error: 'Expected file, got directory',
        code: 'EISDIR',
      }));
      return;
    }

    const content = await fsPromises.readFile(targetPath, 'utf-8');

    ws.send(JSON.stringify({
      type: 'file_content_response',
      workspace,
      path: requestPath,
      success: true,
      content,
      size: stat.size,
      lastModified: stat.mtimeMs,
    }));
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'file_content_response',
      workspace,
      path: requestPath,
      success: false,
      error: err.message,
      code: mapFileErrorCode(err),
    }));
  }
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
      else if (clientMsg.type === 'file_tree_request') {
        handleFileTreeRequest(ws, clientMsg);
      }
      else if (clientMsg.type === 'file_content_request') {
        handleFileContentRequest(ws, clientMsg);
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
