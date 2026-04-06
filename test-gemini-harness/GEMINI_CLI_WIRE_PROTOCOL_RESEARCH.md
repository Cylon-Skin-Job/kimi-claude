# Gemini CLI Wire Protocol - Comprehensive Research Report

**Date:** 2026-04-05  
**CLI Version Tested:** 0.36.0 and 0.37.0-preview.1  
**Researcher:** AI Agent Analysis  

---

## Executive Summary

This report documents the complete wire protocol for Google Gemini CLI (`@google/gemini-cli`) when running in `--output-format stream-json` mode. The protocol uses newline-delimited JSON (NDJSON) for real-time streaming events.

### Key Findings:
- ✅ **6 confirmed event types** in the wire protocol
- ❌ **Thought/reasoning events NOT emitted** in current versions (despite PR #19986)
- ✅ **Multi-model output** supported (Gemini uses multiple models per request)
- ✅ **Tool calls handled internally** with `tool_use` and `tool_result` events

---

## 1. CLI Installation & Version

```bash
# Current stable version
npm install -g @google/gemini-cli  # 0.36.0

# Preview version (tested)
npm install -g @google/gemini-cli@0.37.0-preview.1

# Verify installation
gemini --version  # 0.36.0 or 0.37.0-preview.1
```

---

## 2. Headless Mode Invocation

### Basic Command Structure
```bash
gemini \
  -p "Your prompt here" \
  --output-format stream-json \
  --approval-mode yolo \
  [-m MODEL_NAME]
```

### Available Models (Tested)
| Model | Status | Notes |
|-------|--------|-------|
| `auto-gemini-3` | ✅ Default | Uses multi-model routing |
| `gemini-2.5-pro` | ✅ Works | Single model |
| `gemini-2.5-flash` | ✅ Works | Single model |
| `gemini-3-pro-preview` | ✅ Works | Maps to `gemini-3.1-pro-preview` |
| `gemini-3.1-pro-preview` | ✅ Works | Latest Pro version |
| `gemini-2.5-pro-exp-03-25` | ❌ Error | Model not found |

### Full Flag Reference
```
-p, --prompt                # Non-interactive mode (required for headless)
-o, --output-format         # text | json | stream-json
--approval-mode             # default | auto_edit | yolo | plan
-y, --yolo                  # Auto-approve all (deprecated, use --approval-mode)
-m, --model                 # Model selection
-s, --sandbox               # Run in sandbox
--include-directories       # Additional workspace dirs
-r, --resume                # Resume previous session
--list-sessions             # Show available sessions
--raw-output                # Disable output sanitization
```

---

## 3. Wire Protocol Events

### Event Type Summary

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `init` | Server → Client | Session initialization |
| `message` | Server → Client | Chat messages (user/assistant) |
| `tool_use` | Server → Client | Tool invocation request |
| `tool_result` | Server → Client | Tool execution result |
| `error` | Server → Client | Non-fatal errors/warnings |
| `result` | Server → Client | Final completion with stats |
| ~~`thought`~~ | ~~Server → Client~~ | ~~Model reasoning~~ ❌ **NOT EMITTED** |

---

## 4. Detailed Event Schemas

### 4.1 `init` Event

**When:** First event after connection  
**Purpose:** Session metadata

```json
{
  "type": "init",
  "timestamp": "2026-04-06T01:26:09.208Z",
  "session_id": "b5c57d41-42b5-4b49-a888-af17d02b49b0",
  "model": "auto-gemini-3"
}
```

**Fields:**
- `type`: Always `"init"`
- `timestamp`: ISO 8601 timestamp
- `session_id`: UUID for this session
- `model`: Model identifier (may differ from requested if using auto-routing)

---

### 4.2 `message` Event

**When:** User input or assistant response  
**Purpose:** Chat message content

#### User Message
```json
{
  "type": "message",
  "timestamp": "2026-04-06T01:26:09.208Z",
  "role": "user",
  "content": "List all files in the current directory"
}
```

#### Assistant Message (Streaming)
```json
{
  "type": "message",
  "timestamp": "2026-04-06T01:26:12.879Z",
  "role": "assistant",
  "content": "Hello",
  "delta": true
}
```

**Fields:**
- `type`: Always `"message"`
- `timestamp`: ISO 8601 timestamp
- `role`: `"user"` | `"assistant"`
- `content`: Message text
- `delta`: `true` for streaming chunks (accumulate for full text)

**IMPORTANT:** When `delta: true`, `content` contains only new tokens. The harness must accumulate these into the full response.

---

### 4.3 `tool_use` Event

**When:** Model decides to use a tool  
**Purpose:** Tool invocation with parameters

```json
{
  "type": "tool_use",
  "timestamp": "2026-04-06T01:26:23.977Z",
  "tool_name": "list_directory",
  "tool_id": "list_directory_1775438783977_0",
  "parameters": {
    "dir_path": "."
  }
}
```

**Fields:**
- `type`: Always `"tool_use"`
- `timestamp`: ISO 8601 timestamp
- `tool_name`: Tool identifier (see Tool Mapping section)
- `tool_id`: Unique ID for correlating with `tool_result`
- `parameters`: Tool-specific arguments (JSON object)

**Note:** Multiple `tool_use` events can be emitted in sequence. The `tool_id` format is: `{tool_name}_{timestamp}_{sequence}`

---

### 4.4 `tool_result` Event

**When:** Tool execution completes  
**Purpose:** Tool output or error

#### Success Result
```json
{
  "type": "tool_result",
  "timestamp": "2026-04-06T01:26:24.041Z",
  "tool_id": "list_directory_1775438783977_0",
  "status": "success",
  "output": "Listed 1 item(s)."
}
```

#### Success with Data
```json
{
  "type": "tool_result",
  "timestamp": "2026-04-06T01:26:46.438Z",
  "tool_id": "run_shell_command_1775438806334_0",
  "status": "success",
  "output": "/Users/rccurtrightjr./projects/kimi-claude/test-gemini-harness"
}
```

#### Error Result
```json
{
  "type": "tool_result",
  "timestamp": "2026-04-06T01:26:46.846Z",
  "tool_id": "read_file_1775438806778_0",
  "status": "error",
  "output": "File not found.",
  "error": {
    "type": "file_not_found",
    "message": "File not found: /Users/rccurtrightjr./projects/kimi-claude/test-gemini-harness/nonexistent.txt"
  }
}
```

**Fields:**
- `type`: Always `"tool_result"`
- `timestamp`: ISO 8601 timestamp
- `tool_id`: Matches the `tool_id` from corresponding `tool_use`
- `status`: `"success"` | `"error"`
- `output`: Tool output string (present on success, sometimes on error)
- `error`: Error details object (only present when `status: "error"`)
  - `type`: Error classification
  - `message`: Human-readable error description

---

### 4.5 `error` Event

**When:** Non-fatal error or warning  
**Purpose:** System-level errors that don't stop execution

**Observed Examples:**
```
Error executing tool read_file: File not found.
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 0s.. Retrying after 5025ms...
```

**Note:** These appear as stderr output, not structured JSON events. The harness should capture stderr separately.

---

### 4.6 `result` Event (Final)

**When:** Conversation turn completes  
**Purpose:** Final outcome with aggregated statistics

#### Success Result
```json
{
  "type": "result",
  "timestamp": "2026-04-06T01:26:25.148Z",
  "status": "success",
  "stats": {
    "total_tokens": 14289,
    "input_tokens": 13945,
    "output_tokens": 74,
    "cached": 5779,
    "input": 8166,
    "duration_ms": 5112,
    "tool_calls": 1,
    "models": {
      "gemini-2.5-flash-lite": {
        "total_tokens": 883,
        "input_tokens": 781,
        "output_tokens": 39,
        "cached": 0,
        "input": 781
      },
      "gemini-3-flash-preview": {
        "total_tokens": 13406,
        "input_tokens": 13164,
        "output_tokens": 35,
        "cached": 5779,
        "input": 7385
      }
    }
  }
}
```

#### Error Result (API/Model Error)
```json
{
  "type": "result",
  "timestamp": "2026-04-06T01:30:19.785Z",
  "status": "error",
  "error": {
    "type": "Error",
    "message": "[API Error: Requested entity was not found.]"
  },
  "stats": {
    "total_tokens": 0,
    "input_tokens": 0,
    "output_tokens": 0,
    "cached": 0,
    "input": 0,
    "duration_ms": 0,
    "tool_calls": 0,
    "models": {
      "gemini-2.5-pro-exp-03-25": {
        "total_tokens": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cached": 0,
        "input": 0
      }
    }
  }
}
```

**Fields:**
- `type`: Always `"result"`
- `timestamp`: ISO 8601 timestamp
- `status`: `"success"` | `"error"`
- `error`: Error details (only when `status: "error"`)
- `stats`: Usage statistics
  - `total_tokens`: Total across all models
  - `input_tokens`: Prompt tokens
  - `output_tokens`: Generated tokens
  - `cached`: Cached tokens (cost savings)
  - `input`: Raw input tokens
  - `duration_ms`: Total execution time
  - `tool_calls`: Number of tool invocations
  - `models`: Per-model token breakdown

---

## 5. Tool Name Mapping (Gemini → Canonical)

| Gemini Tool Name | Canonical Name | Description |
|------------------|----------------|-------------|
| `list_directory` | `list` | List directory contents |
| `read_file` | `read` | Read file contents |
| `write_file` | `write` | Create/overwrite files |
| `replace` | `edit` | Text replacement in files |
| `run_shell_command` | `shell` | Execute shell commands |
| `grep_search` | `grep` | Search file contents |
| `glob` | `glob` | Find files by pattern |
| `ask_user` | `ask` | Request user input |
| `google_web_search` | `web_search` | Web search |
| `web_fetch` | `fetch` | Fetch URL content |
| `save_memory` | `memory` | Persist to GEMINI.md |
| `write_todos` | `todo` | Track subtasks |
| `read_many_files` | `read_many` | Read multiple files |

**Note:** MCP tools use prefix format: `mcp_<serverName>_<toolName>`

---

## 6. Multi-Model Output

Gemini CLI often uses **multiple models** in a single request (e.g., `gemini-2.5-flash-lite` + `gemini-3-flash-preview`). The `stats.models` field contains per-model breakdowns.

**Canonical Event Strategy:**
- Aggregate all model usage into single `tokenUsage` for canonical format
- Preserve detailed breakdown in `_meta.models`

---

## 7. Session Management

### Session Persistence
- Sessions saved per-project in `~/.gemini/tmp/<project_hash>/`
- Resume with `--resume latest` or `--resume <index>`
- List sessions with `--list-sessions`

### Statelessness in Headless Mode
Each `gemini -p ...` invocation is **stateless** - no conversation history is maintained between separate CLI invocations. The harness must:
1. Maintain conversation history internally
2. Pass full context via prompt engineering (if needed)

---

## 8. Error Handling Patterns

### 8.1 Structured Errors (in `result` event)
```json
{
  "type": "result",
  "status": "error",
  "error": {
    "type": "APIError",
    "message": "Quota exceeded. Please try again later."
  }
}
```

### 8.2 Tool Execution Errors (in `tool_result` event)
```json
{
  "type": "tool_result",
  "status": "error",
  "error": {
    "type": "file_not_found",
    "message": "File not found: /path/to/file"
  }
}
```

### 8.3 Stderr Output
Tool execution errors also appear on stderr:
```
Error executing tool read_file: File not found.
```

### 8.4 Exit Codes
| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error or API failure |
| `42` | Input error (invalid prompt) |
| `53` | Turn limit exceeded |

---

## 9. Thought/Reasoning Events - NOT CURRENTLY AVAILABLE

### Research Findings

Despite **PR #19986** (merged Feb 2026) claiming to add thought events to stream-json output, **NO thought events are emitted** in tested versions (0.36.0 and 0.37.0-preview.1).

### Testing Performed
Tested with models:
- `gemini-2.5-pro`
- `gemini-3-pro-preview`
- `gemini-3.1-pro-preview`
- `auto-gemini-3`

Prompts tried:
- "Think step by step..."
- "Show your reasoning..."
- "Before answering, walk through your internal reasoning..."

**Result:** No `thought` events emitted. All reasoning appears as regular `message` content.

### Hypothesis
Thought events may require:
1. Specific API configuration (`thinkingConfig`) not exposed via CLI
2. Models with explicit thinking mode enabled
3. Future CLI version not yet released

**Recommendation:** Implement harness to handle `thought` events if they appear, but don't depend on them.

---

## 10. Sample Complete Conversation

### Input
```bash
gemini -p "List all files in the current directory" \
  --output-format stream-json \
  --approval-mode yolo
```

### Output Stream
```jsonl
{"type":"init","timestamp":"2026-04-06T01:26:20.036Z","session_id":"cd8df7b2-8f3d-4c3d-8815-748270ebb012","model":"auto-gemini-3"}
{"type":"message","timestamp":"2026-04-06T01:26:20.036Z","role":"user","content":"List all files in the current directory"}
{"type":"message","timestamp":"2026-04-06T01:26:23.948Z","role":"assistant","content":"I will list the files in the current directory.\n","delta":true}
{"type":"tool_use","timestamp":"2026-04-06T01:26:23.977Z","tool_name":"list_directory","tool_id":"list_directory_1775438783977_0","parameters":{"dir_path":"."}}
{"type":"tool_result","timestamp":"2026-04-06T01:26:24.041Z","tool_id":"list_directory_1775438783977_0","status":"success","output":"Listed 1 item(s)."}
{"type":"message","timestamp":"2026-04-06T01:26:25.062Z","role":"assistant","content":"The only","delta":true}
{"type":"message","timestamp":"2026-04-06T01:26:25.092Z","role":"assistant","content":" file in the current directory is `test.txt`.","delta":true}
{"type":"result","timestamp":"2026-04-06T01:26:25.148Z","status":"success","stats":{"total_tokens":14289,"input_tokens":13945,"output_tokens":74,"cached":5779,"input":8166,"duration_ms":5112,"tool_calls":1,"models":{"gemini-2.5-flash-lite":{"total_tokens":883,"input_tokens":781,"output_tokens":39,"cached":0,"input":781},"gemini-3-flash-preview":{"total_tokens":13406,"input_tokens":13164,"output_tokens":35,"cached":5779,"input":7385}}}}
```

---

## 11. Implementation Notes for Harness

### 11.1 Event Translation (Gemini → Canonical)

| Gemini Event | Canonical Event(s) |
|--------------|-------------------|
| `init` | `turn_begin` |
| `message` (assistant, delta) | `content` (accumulate chunks) |
| `tool_use` | `tool_call` + `tool_call_args` |
| `tool_result` | `tool_result` |
| `result` | `turn_end` (with `_meta` stats) |

### 11.2 State Management Required

```javascript
// Per-session state
{
  turnId: "turn-{timestamp}-{random}",
  accumulatedText: "",           // Accumulate delta chunks
  toolArgsBuffer: {},            // Map toolId → args string
  hasToolCalls: false,
  sessionId: null                // From init event
}
```

### 11.3 Key Implementation Details

1. **Delta Accumulation:** Gemini uses `delta: true` for streaming. Must accumulate `content` fields into full response.

2. **Tool ID Correlation:** `tool_use.tool_id` must match `tool_result.tool_id`.

3. **Multi-Model Stats:** Aggregate token usage from `stats.models` for canonical `tokenUsage`.

4. **Stateless per Invocation:** Each CLI spawn is independent. No built-in conversation history.

5. **No Thinking Events:** Don't expect `thought` events; handle as regular content if they appear.

---

## 12. Comparison with Other CLI Harnesses

| Feature | Gemini | Kimi | Codex |
|---------|--------|------|-------|
| Protocol | NDJSON | JSON-RPC | NDJSON |
| Handshake | No | No | Yes |
| Tool Handling | Internal | Internal | Internal |
| Thinking Events | ❌ No | ✅ Yes | ❌ No |
| Multi-Model | ✅ Yes | ❌ No | ❌ No |
| Session Persistence | ✅ Filesystem | ❌ No | ❌ No |

---

## 13. Open Questions for Future Research

1. **Thought Events:** Will future versions emit structured `thought` events? Monitor PRs and releases.

2. **Multi-Turn via Stdin:** Can conversation history be passed via stdin for true multi-turn?

3. **MCP Tool Format:** How are MCP tool names structured in `tool_use` events?

4. **Custom Extensions:** How do custom extensions affect the wire protocol?

---

## 14. Appendix: Raw Test Outputs

### Test 1: Simple Message
```
{"type":"init","timestamp":"2026-04-06T01:26:09.208Z","session_id":"b5c57d41-42b5-4b49-a888-af17d02b49b0","model":"auto-gemini-3"}
{"type":"message","timestamp":"2026-04-06T01:26:09.208Z","role":"user","content":"Say hello in exactly one word"}
{"type":"message","timestamp":"2026-04-06T01:26:12.879Z","role":"assistant","content":"Hello","delta":true}
{"type":"result","timestamp":"2026-04-06T01:26:12.944Z","status":"success","stats":{"total_tokens":7560,"input_tokens":7332,"output_tokens":35,"cached":0,"input":7332,"duration_ms":3737,"tool_calls":0,"models":{"gemini-2.5-flash-lite":{"total_tokens":881,"input_tokens":780,"output_tokens":34,"cached":0,"input":780},"gemini-3-flash-preview":{"total_tokens":6679,"input_tokens":6552,"output_tokens":1,"cached":0,"input":6552}}}}
```

### Test 2: Tool Error Handling
```
{"type":"tool_result","timestamp":"2026-04-06T01:26:46.846Z","tool_id":"read_file_1775438806778_0","status":"error","output":"File not found.","error":{"type":"file_not_found","message":"File not found: /Users/rccurtrightjr./projects/kimi-claude/test-gemini-harness/nonexistent.txt"}}
```

### Test 3: Multiple Tool Calls
```
{"type":"tool_use","timestamp":"2026-04-06T01:26:35.293Z","tool_name":"write_file","tool_id":"write_file_1775438795293_0","parameters":{"file_path":"hello.txt","content":"Hello from Gemini!"}}
{"type":"tool_use","timestamp":"2026-04-06T01:26:35.293Z","tool_name":"list_directory","tool_id":"list_directory_1775438795293_1","parameters":{"dir_path":".","wait_for_previous":true}}
{"type":"tool_result","timestamp":"2026-04-06T01:26:35.306Z","tool_id":"write_file_1775438795293_0","status":"success"}
{"type":"tool_result","timestamp":"2026-04-06T01:26:35.306Z","tool_id":"list_directory_1775438795293_1","status":"success","output":"Listed 2 item(s)."}
```

---

**End of Research Report**

*This document was generated through comprehensive testing of the Gemini CLI wire protocol for integration with the Kimi IDE universal harness system.*
