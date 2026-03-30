# Triggers

---
name: source-file-change
type: file-change
events: [modify, create, delete]
match: "kimi-ide-server/lib/**/*.js"
exclude: ["ai/views/**"]
prompt: PROMPT.md
message: |
  Server source changed: {{filePath}} ({{event}})
---

---
name: client-source-change
type: file-change
events: [modify, create, delete]
match: "kimi-ide-client/src/**/*.ts"
exclude: ["kimi-ide-client/src/**/*.test.ts"]
prompt: PROMPT.md
message: |
  Client source changed: {{filePath}} ({{event}})
---

---
name: weekly-test-scan
type: cron
schedule: "0 6 * * 1"
prompt: PROMPT.md
message: |
  Weekly test coverage scan. Check for untested code paths.
---
