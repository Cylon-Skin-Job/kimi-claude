# Rich Storage Format Specification

## Goal

Store chat history in structured JSON for:
1. **Future UI reconstruction** (render threads exactly as they appeared)
2. **AI analysis** (extract patterns, code changes, workflow insights)

---

## File Structure

```
ai/workspaces/{workspace}/threads/{threadId}/
├── CHAT.md              # Human-readable (legacy, maintained)
├── history.json         # Structured JSON (source of truth)
└── INDEX.json           # Thread metadata
```

For background jobs (non-chat workspaces):

```
ai/workspaces/{workspace}/jobs/{jobId}/
├── OUTPUT.md            # Human-readable result
├── history.json         # Structured JSON
└── INDEX.json           # Job metadata
```

---

## history.json Format

### Top Level

```typescript
{
  version: "1.0.0",           // Schema version
  threadId: string,           // Unique ID
  createdAt: number,          // Unix timestamp (ms)
  updatedAt: number,          // Last modification
  exchanges: Exchange[]       // Ordered array of user/assistant pairs
}
```

### Exchange

One complete turn (user request + assistant response):

```typescript
interface Exchange {
  seq: number;                // Monotonic sequence (1, 2, 3...)
  ts: number;                 // Timestamp when exchange completed
  user: string;               // User message content
  assistant: {
    parts: Part[];            // Ordered array of response segments
  };
  metadata?: MetadataItem[];  // Optional: enrichment data (future)
}
```

### Part Types

Assistant responses are split into ordered parts:

```typescript
type Part = TextPart | ToolCallPart;

interface TextPart {
  type: "text";
  content: string;            // Text content (markdown supported)
}

interface ToolCallPart {
  type: "tool_call";
  name: string;               // Tool name (e.g., "ReadFile", "StrReplaceFile")
  arguments: object;          // Tool arguments (structured)
  result: {
    output?: string;          // Text output from tool
    display?: DisplayItem[];  // Structured display data
    error?: string;           // Error message if failed
    files?: string[];         // Paths to written/modified files
  };
  duration_ms?: number;       // Execution time (optional)
}
```

### DisplayItem

Rich output for tool results:

```typescript
type DisplayItem = 
  | { type: "text"; content: string }
  | { type: "json"; data: object }
  | { type: "image"; path: string }
  | { type: "diff"; before: string; after: string; path: string }
  | { type: "file_tree"; root: string; nodes: FileNode[] };

interface FileNode {
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
}
```

---

## Example

```json
{
  "version": "1.0.0",
  "threadId": "3212ed0c-fe69-4bff-afbf-110014398422",
  "createdAt": 1712345678901,
  "updatedAt": 1712345682345,
  "exchanges": [
    {
      "seq": 1,
      "ts": 1712345679200,
      "user": "What files are in this project?",
      "assistant": {
        "parts": [
          {
            "type": "text",
            "content": "I'll check the project structure for you."
          },
          {
            "type": "tool_call",
            "name": "Glob",
            "arguments": {
              "pattern": "**/*"
            },
            "result": {
              "output": "src/index.js\nsrc/utils.js\nREADME.md\npackage.json",
              "display": [
                {
                  "type": "file_tree",
                  "root": ".",
                  "nodes": [
                    { "name": "src", "type": "directory", "children": [
                      { "name": "index.js", "type": "file" },
                      { "name": "utils.js", "type": "file" }
                    ]},
                    { "name": "README.md", "type": "file" },
                    { "name": "package.json", "type": "file" }
                  ]
                }
              ]
            },
            "duration_ms": 45
          },
          {
            "type": "text",
            "content": "The project has 4 files:\n- src/index.js\n- src/utils.js\n- README.md\n- package.json"
          }
        ]
      }
    },
    {
      "seq": 2,
      "ts": 1712345682345,
      "user": "Update the README with a usage example",
      "assistant": {
        "parts": [
          {
            "type": "text",
            "content": "I'll add a usage example to the README."
          },
          {
            "type": "tool_call",
            "name": "ReadFile",
            "arguments": {
              "path": "README.md"
            },
            "result": {
              "output": "# My Project\n\nA sample project.",
              "files": ["README.md"]
            },
            "duration_ms": 12
          },
          {
            "type": "tool_call",
            "name": "StrReplaceFile",
            "arguments": {
              "path": "README.md",
              "edit": {
                "old": "# My Project\n\nA sample project.",
                "new": "# My Project\n\nA sample project.\n\n## Usage\n\n```js\nconst { greet } = require('./src/utils');\nconsole.log(greet('World'));\n```"
              }
            },
            "result": {
              "output": "File updated successfully",
              "display": [
                {
                  "type": "diff",
                  "path": "README.md",
                  "before": "# My Project\n\nA sample project.",
                  "after": "# My Project\n\nA sample project.\n\n## Usage\n\n```js\nconst { greet } = require('./src/utils');\nconsole.log(greet('World'));\n```"
                }
              ],
              "files": ["README.md"]
            },
            "duration_ms": 23
          },
          {
            "type": "text",
            "content": "Done! I've added a usage example to the README."
          }
        ]
      },
      "metadata": []
    }
  ]
}
```

---

## Key Properties

### Ordered by Sequence
- `seq` field guarantees order (1, 2, 3...)
- `ts` field for timing analysis
- Parts within `assistant.parts` are in display order

### Tool Calls are Nested
- Tool arguments and results stored together
- No IDs needed (unlike wire protocol)
- Easy to see what changed: `arguments.edit` shows before/after

### Extensible
- `metadata` array can be added to any exchange later
- Display types can be extended without breaking changes
- Version field enables migrations

### AI-Friendly
- Structured JSON for easy parsing
- File paths in `result.files` for change tracking
- Diff objects show exact code changes
- Tool names show workflow patterns

---

## Relationship to CHAT.md

`CHAT.md` is human-readable, derived from `history.json`:

```
# Thread Title

User
What files are in this project?

Assistant
I'll check the project structure for you.

**TOOL CALL: Glob**
Pattern: **/*
Result: 4 files found

The project has 4 files:
- src/index.js
- src/utils.js
- README.md
- package.json

User
Update the README with a usage example

...
```

`history.json` is the source of truth. `CHAT.md` is generated from it.

---

## Implementation Phases

### Phase 1: Dual Write (Now)
- Continue writing `CHAT.md` (current behavior)
- Add `history.json` writer
- Both files written on each message

### Phase 2: Feature Flag (Future)
- Add `useRichStorage` config option
- When enabled, load from `history.json`
- When disabled, load from `CHAT.md` (fallback)

### Phase 3: Cutover (Future)
- Default to `history.json`
- `CHAT.md` becomes export-only
- Remove CHAT.md writer (keep generator for export)

---

## Open Questions (Not Blocking)

1. **Large outputs**: Store inline or reference external file?
2. **Binary data**: Store images/base64 inline or separate?
3. **Retention**: Archive old exchanges to keep file manageable?
4. **Compression**: Gzip for large histories?

---

## Success Criteria

- [ ] `history.json` is valid JSON
- [ ] Each exchange has sequential `seq` number
- [ ] Tool calls include full arguments and results
- [ ] File paths extracted into `result.files` array
- [ ] CHAT.md can be regenerated from history.json
- [ ] AI can extract: all files touched, all code changes, workflow patterns
