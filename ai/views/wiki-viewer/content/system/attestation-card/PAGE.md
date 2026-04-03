# Attestation Card

> The receipt. Every significant change gets one. The producer fills it. The validator checks it.

---

## What This Is

The attestation card is the physical artifact of [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md). It's a structured document embedded in pull requests that records what changed, why, what evidence supports the change, and how confident the producer is. A separate AI instance reviews the card against the actual diff — fresh eyes, no shared context.

The card template lives here in the system wiki. Hooks read it. Agents fill it. Reviewers validate it.

---

## The Three Tiers

Not every edit needs a card. The system has three tiers of validation:

| Tier | When | What Happens | Card? |
|------|------|-------------|-------|
| **Quick edit** | Small interactive change in chat | User sees the diff, approves it. Done. | No |
| **/validate** | User invokes manually after significant work | Skill runs local checks: tests, build, lint, style, wiki accuracy. Reports findings. | No (report only) |
| **PR / commit** | User invokes `/pr` or `/commit`, or hook auto-triggers | Attestation card generated, embedded in PR. Review agent validates independently. | Yes |

The card is the PR-level artifact. `/validate` is the local check. Quick edits need neither.

---

## Card Template

This is the skeleton that hooks and skills use when generating a card. The producing AI fills every section.

```markdown
## Attestation Card

### Summary
{1-2 sentence description of what was done and why}

### Changes

| File | What Changed | Why | Confidence |
|------|-------------|-----|------------|
| | | | |

### Sources Consulted

| Source | What Was Found |
|--------|---------------|
| | |

### Verification

- [ ] Build passes
- [ ] Tests pass (or N/A if no tests)
- [ ] Linter clean
- [ ] No broken imports/exports
- [ ] Wiki accuracy (if wiki pages changed)
- [ ] Style guide compliance

### Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| | | |

### Confidence Assessment

**Overall:** {High | Medium | Low}

{Why this confidence level. Cite specific evidence. If anything is uncertain, say so.}

### Recommendation

{Proceed | Proceed with caution | Needs human review}

{If not "Proceed", explain what specifically needs attention.}
```

### Filling the Card

The producing AI fills the card after the work is done (retrospective, not prospective). For each change:

- **File**: the actual file path
- **What Changed**: specific description (not "updated file" — what specifically)
- **Why**: cite the trigger — ticket, conversation, bug report, refactor goal
- **Confidence**: High (tested, verified), Medium (looks right, not fully tested), Low (best guess, needs review)

For each source consulted:
- **Source**: file path, commit hash, wiki page, ticket ID
- **What Was Found**: what the source said that informed the change

### What the Producer Must NOT Do

- Fabricate sources (the validator will check)
- Claim tests pass without running them
- Mark confidence as High without evidence
- Skip the Risks section ("no risks" is almost never true — at minimum, "unrelated code could depend on this")

---

## Card Variants

Different types of changes use the same template but emphasize different sections.

### Code Changes

Full card. All sections filled. Tests and build verification required.

### Wiki Updates

Lighter verification section — no build or linter. Instead:

```markdown
### Verification

- [ ] Source material exists and says what the card claims
- [ ] No broken wiki links
- [ ] LOG.md updated
- [ ] index.json edges still accurate
- [ ] No content removed without source confirmation
```

### Config / Infrastructure Changes

Heavier risks section:

```markdown
### Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Service disruption during deploy | Medium | Tested in staging first |
| Environment variable missing | Low | Verified .env.example updated |
| Rollback complexity | Medium | Previous config saved in commit history |
```

### Dependency Updates

Focus on compatibility:

```markdown
### Verification

- [ ] Build passes with new dependency
- [ ] No breaking API changes in changelog
- [ ] Lock file updated
- [ ] No known vulnerabilities (npm audit)
- [ ] Downstream consumers tested
```

[Card variants are guidance, not separate templates. The same template is used; the producer emphasizes what's relevant.]

---

## Generation Flow

### Interactive (User + AI in chat)

```
User + AI: make changes, iterate, ship it
  │
  User: /pr (or /commit)
  │
  ├─ AI reads: recent git diff (staged + unstaged)
  ├─ AI reads: this wiki page (card template)
  ├─ AI reads: conversation context (what was discussed, what was decided)
  ├─ AI fills: every section of the card
  ├─ AI runs: build, tests, lint (the /validate checks)
  ├─ AI fills: verification checkboxes based on actual results
  │
  └─ Output: PR with card in description, or commit with card in message
```

### Auto-Draft via Hook

```
Hook detects: significant file changes (multiple files, or large diff)
  │
  ├─ Creates: draft PR with empty card template
  ├─ Assigns: producing AI to fill it
  ├─ Status: "Draft — attestation pending"
  │
  User or AI: fills the card when ready
  │
  └─ Status: "Ready for review"
```

**Hook trigger threshold** [not yet finalized]:
- More than 3 files changed, OR
- More than 100 lines changed, OR
- Any file in a protected path (e.g., server.js, config files), OR
- Any wiki PAGE.md changed

Below threshold: no auto-draft. User can still invoke `/pr` manually.

### Background Agent Workflow

```
Workflow step 2 (ATTEST): produces the card as part of the workflow
Workflow step 3 (VALIDATE): separate sub-agent reviews the card
Workflow step 4 (EXECUTE): changes are made per the validated card
  │
  After execution:
  ├─ Card is updated with actual results
  ├─ PR is created with card embedded
  ├─ Review agent assigned automatically
  │
  └─ Agent approves or flags for human
```

In background workflows, the card is **prospective** (produced before execution) AND **retrospective** (updated after execution with actual results). This is the full EGE loop.

---

## The Review Agent

A separate AI instance that validates the card. It has:
- The PR diff
- The attestation card
- Read access to the project (to verify sources)

It does NOT have:
- The conversation that produced the changes
- The gather/reasoning output from the producer
- Any context about intent beyond what's in the card

**What it does:**

1. For each source in the card: read it, confirm it says what the card claims
2. For each change: verify the diff matches what the card describes
3. For each verification checkbox: re-run if possible (tests, build, lint)
4. Check: are there changes in the diff NOT described in the card? (undocumented changes)
5. Check: are there card entries NOT reflected in the diff? (phantom changes)
6. Issue verdict: APPROVE, REQUEST CHANGES, or FLAG FOR HUMAN

**What it outputs:**

```markdown
## Review

**Verdict:** {APPROVE | REQUEST CHANGES | FLAG FOR HUMAN}

### Source Verification
| Source | Card Claims | Actual | Match? |
|--------|------------|--------|--------|
| | | | |

### Diff Coverage
- Changes in diff but not in card: {list or "none"}
- Changes in card but not in diff: {list or "none"}

### Verification Re-run
- Build: {pass/fail}
- Tests: {pass/fail/skipped}
- Lint: {pass/fail}

### Concerns
{Any issues found, or "None — card is accurate and complete"}
```

[Review agent not yet implemented]

---

## The /validate Skill

A lighter, local-only check invoked manually. Does NOT produce a card — just runs checks and reports.

```
/validate

Reads: recent git diff
Reads: project wiki for conventions, style guides
Runs: build, tests, lint
Checks: export safety (did we break importers?)
Checks: wiki accuracy (if PAGE.md changed, do sources exist?)
Checks: style/convention alignment
Reports: findings as a checklist

"Code edit validation and audit. Ensures correctness and alignment
with established style guides, connected processes, and user vision.
Use after any significant code changes or wiki updates."
```

The skill reads the project wiki to discover what checks apply. Different project types have different conventions. The skill is generic — the knowledge is in the wiki.

[/validate skill not yet implemented]

---

## Where Cards Live

| Context | Where the Card Goes |
|---------|-------------------|
| PR | Embedded in PR description body |
| Commit (no PR) | Extended commit message |
| Background agent run | `runs/{timestamp}/attestation.md` + PR if code was changed |
| /validate (no PR) | Printed to chat (not persisted) |

Cards in PRs are the primary artifact. The reviewer reads them there. Cards in run folders are the audit trail for background work.

---

## Related

- [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md) — the philosophy behind attestation
- [Workflow Design Guide](../workflow-design/PAGE.md) — how background agents produce cards
- [Validation Subagent](../validation-subagent/PAGE.md) — the review agent design
- [System Overview](../system-overview/PAGE.md) — how cards fit into the three-layer architecture
