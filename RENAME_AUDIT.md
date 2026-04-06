# Rename Audit: Kimi Claude → Open Robin

## Summary
Found ~100 files with "kimi-claude" or "Kimi Claude" references. Categorized below by type and scope.

---

## CATEGORY A: Project-Level References (MUST CHANGE)

### A1: Root Files
| File | Current | Should Become | Type |
|------|---------|---------------|------|
| README.md | `# kimi-claude` | `# Open Robin` | Project title |
| README.md | `Kimi and Claude integration project` | Update to describe Open Robin | Description |
| AGENTS.md | `# AGENTS.md - kimi-claude` | `# AGENTS.md - Open Robin` | Header |
| AGENTS.md | References to `kimi-claude` folder | Reference to `open-robin` | Path examples |

### A2: Package Names
| File | Current | Should Become | Type |
|------|---------|---------------|------|
| kimi-ide-client/package.json | `"name": "kimi-ide-client"` | Rename package | Package name |
| kimi-ide-server/package.json | `"name": "kimi-ide-server"` | Rename package | Package name |

### A3: Folder Names
| Current | Should Become | Type |
|---------|---------------|------|
| `kimi-ide-client/` | `open-robin-client/` | Folder |
| `kimi-ide-server/` | `open-robin-server/` | Folder |
| (potentially others) | | |

### A4: Ticket ID Prefix
| Current | Should Become | Type |
|---------|---------------|------|
| `KIMI-0001`, `KIMI-0002`, etc. | `ROBIN-0001`, `ROBIN-0002`, etc. (or `OR-0001`) | Ticket identifier |
| File names: `ai/views/issues-viewer/KIMI-NNNN.md` | `ai/views/issues-viewer/ROBIN-NNNN.md` or `OR-NNNN.md` | File path |

### A5: Documentation References
| File | Content | Action |
|------|---------|--------|
| Various .md files | Path examples using `kimi-claude` | Update to `open-robin` |
| Various .md files | References to `kimi-ide-client` / `kimi-ide-server` | Update to new folder names |
| Various spec files | Hardcoded paths | Update paths |

---

## CATEGORY B: Harness-Level References (KEEP UNCHANGED)

These refer to underlying harnesses and should NOT change:

### B1: Kimi CLI References
- `kimi-ide-server/lib/harness/clis/kimi/` — Kimi CLI integration
- References to "Kimi harness", "Kimi CLI", "Kimi wire protocol"
- File: `kimi-ide-server/lib/git-credential-kimi.sh` — Kimi credential helper
- References in comments explaining Kimi CLI features

**Action:** Leave all as-is. These are about the underlying tool.

### B2: Claude Code References
- `kimi-ide-server/lib/harness/clis/claude-code/` — Claude Code integration
- References to "Claude Code harness", "Claude API"
- References in comments explaining Claude features

**Action:** Leave all as-is. These are about the underlying tool.

### B3: Future Harnesses
- `kimi-ide-server/lib/harness/clis/gemini/` — Gemini CLI integration
- `kimi-ide-server/lib/harness/clis/codex/` — Codex CLI integration
- `kimi-ide-server/lib/harness/clis/qwen/` — Qwen CLI integration

**Action:** Leave all as-is. These are harness-specific folders.

### B4: Harness Spec Files
- Files in `ai/views/capture-viewer/specs/`:
  - `KIMI-CLI-HARNESS-SPEC.md`
  - `CLAUDE-CODE-HARNESS-SPEC.md`
  - `GEMINI-CLI-HARNESS-SPEC.md`
  - `CODEX-CLI-HARNESS-SPEC.md`

**Action:** Leave all as-is. These document individual harnesses, not the project.

### B5: Test Files
- `test-gemini-harness/` folder and contents

**Action:** Leave all as-is. These test individual harnesses.

---

## CATEGORY C: Path-Based References (NEEDS ASSESSMENT)

### C1: Absolute Paths
Multiple files contain hardcoded paths like:
```
/Users/rccurtrightjr./projects/kimi-claude/
```

**Action:** When cloning to new repo, these paths will change naturally. May need regex find/replace in specs and documentation.

### C2: Workspace Paths
Files in `ai/views/` reference workspace structure:
```
ai/views/wiki-viewer/
ai/views/code-viewer/
ai/views/capture-viewer/
ai/views/issues-viewer/
ai/views/agents-viewer/
ai/views/settings/
```

**Action:** These are workspace names, not project names. Likely don't need to change, but verify if any hardcode project name.

---

## CATEGORY D: Configuration Files (CHECK)

| File | Content | Action |
|------|---------|--------|
| `.cursor/rules/active-codebase.mdc` | May reference project name | Check and update |
| `ai/views/wiki-viewer/index.json` | Project metadata | Update description/title if present |
| `ai/views/capture-viewer/` files | Configuration | Check for project name references |

---

## Implementation Checklist

### Phase 2 (Repository Prep)
- [ ] Clone repo to new location as `open-robin`
- [ ] Set up new remotes (GitHub and GitLab)

### Phase 3 (Rename in New Repo)
- [ ] Update README.md (title + description)
- [ ] Update AGENTS.md (header + path examples)
- [ ] Rename folder: `kimi-ide-client/` → `open-robin-client/`
- [ ] Rename folder: `kimi-ide-server/` → `open-robin-server/`
- [ ] Update package.json files with new package names
- [ ] Rename ticket files: `KIMI-NNNN.md` → `ROBIN-NNNN.md` (or `OR-NNNN.md`)
- [ ] Update all ticket ID references in content files
- [ ] Update hardcoded path references in spec/doc files
- [ ] Verify: No references to old project name remain (except in harness-specific files)
- [ ] Verify: All harness files (Kimi, Claude Code, Gemini, Codex, Qwen) are unchanged
- [ ] Commit: "Rename project: Kimi Claude → Open Robin"

---

**Status:** Audit complete, ready for implementation
**Next:** Confirm ticket ID prefix and folder naming strategy before Phase 2
