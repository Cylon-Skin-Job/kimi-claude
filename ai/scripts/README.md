# Scripts

Shared scripts that TRIGGERS.md can reference via the `script` field.

Scripts are pure functions — they take event context, return data. No side effects, no ticket creation. The YAML trigger controls what happens with the result.

## Usage in TRIGGERS.md

```yaml
---
name: example-trigger
type: file-change
events: [delete]
match: "kimi-ide-server/lib/**/*.js"
script: ai/scripts/check-sources.js
function: getAffectedTopics
condition: "result.topics.length > 0"
prompt: PROMPT_01.md
message: |
  {{result.summary}}
---
```

## Contract

Every script exports functions that follow this signature:

```js
/**
 * @param {Object} ctx - Event context
 * @param {string} ctx.filePath - Relative path of the changed file
 * @param {string} ctx.event - create | modify | delete | rename
 * @param {string} ctx.basename - Filename only
 * @param {string} ctx.parentDir - Parent directory
 * @param {Object} ctx.parentStats - { files, folders }
 * @param {Object} ctx.fileStats - { lines, words, tokens, size }
 * @param {string} ctx.projectRoot - Absolute path to project root
 * @returns {Object} result - Available as `result` in condition and message templates
 */
module.exports.functionName = function(ctx) {
  // Pure computation — no side effects
  return { ... };
};
```
