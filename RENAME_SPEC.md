# Project Rename Specification: Kimi Claude → Open Robin

## Objective
Rename the project from "Kimi Claude" to "Open Robin" to resolve naming conflicts with underlying harnesses (Kimi harness, Claude Code harness).

## Problem Statement
The project's name conflicts with the names of the harnesses it uses, causing ambiguity for AI systems trying to distinguish between:
- **Project-level work** (Open Robin-specific architecture, documentation, features)
- **Harness-level work** (Kimi CLI features, Claude Code features)

This ambiguity blocks adding additional harnesses and creates confusion in agent reasoning.

## Scope

### In Scope: References to Remove/Update
- Project name in documentation (README, docs, comments)
- Project identifiers in configuration files
- Folder names or path references that embed "kimi-claude" or "kimi-claude-ide"
- GitLab project names and references
- Package names if any
- Application titles and descriptions

### Out of Scope: Keep Unchanged
- References to the **Kimi harness** (CLI tool, its features, its documentation)
- References to the **Claude Code harness** (Claude API integration, Claude-specific features)
- References to other harnesses that may be added (Gemini, etc.)

## Implementation Strategy

### Phase 1: Specification & Audit (Current)
1. Define this spec (done)
2. Audit codebase for all "Kimi" / "Kimi Claude" references
3. Categorize each reference: project-level vs. harness-level
4. Document findings in RENAME_AUDIT.md

### Phase 2: Repository Preparation
1. Clone current repo to new location: `open-robin` (GitHub and GitLab)
2. Preserve git history
3. Update remotes to new repo URLs

### Phase 3: Rename in New Repo
1. Update project-level references (as identified in audit)
2. Preserve harness-level references unchanged
3. Verify no references to old project name remain
4. Commit as "Rename project: Kimi Claude → Open Robin"

### Phase 4: Wiki Updates
Separate detailed plan in wiki

## Files Affected (Estimated)
- README.md
- package.json (client and server)
- File paths and folder names
- Configuration files
- Documentation / comments
- GitLab project settings

## Success Criteria
- Project name is "Open Robin" in all user-facing contexts
- Harness names (Kimi, Claude Code) are clearly distinguishable
- Git history preserved
- No broken links or references to old project name
- Wiki reflects new naming clearly

---

**Status:** Ready for Phase 1 audit
**Next:** Search codebase for Kimi/Kimi Claude references
