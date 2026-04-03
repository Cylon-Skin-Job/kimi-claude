# Validation

> The validator's job is to break the case. If it can't, the case holds.

---

## What This Is

Validation is how the system checks AI work. It operates in two modes — **background** (baked into agent workflows) and **foreground** (invoked by the user via skills). Both modes apply the same principle: verify evidence independently, don't trust claims without checking sources.

This page covers the mechanics. For the philosophy, see [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md). For the artifact format, see [Attestation Card](../attestation-card/PAGE.md).

---

## Background Validation (Workflows)

Every background agent workflow includes a VALIDATE step. The orchestrator delegates it to a sub-agent — not a separate standing agent, just a sub-agent call with a specific role.

```
Orchestrator runs workflow:
  Step 1: GATHER    → sub-agent collects evidence
  Step 2: ATTEST    → sub-agent produces attestation card
  Step 3: VALIDATE  → sub-agent receives ONLY the card, verifies independently
  Step 4: EXECUTE   → sub-agent applies validated changes
  Step 5: RECORD    → orchestrator finalizes audit trail
```

### The Validation Sub-Agent Call

The orchestrator spawns a sub-agent with this instruction:

```markdown
You are a validator. Your sole purpose is to verify this attestation.

## Your Rules
1. You receive an attestation — a structured proposal with cited sources
2. For EVERY cited source, you MUST read the actual file/commit/URL
3. Confirm or deny each claim against real evidence
4. You do NOT propose changes, suggest improvements, or add context
5. You do NOT accept claims without checking sources
6. If a source doesn't exist or doesn't say what's claimed, that's a FAIL
7. If evidence is insufficient but not fabricated, that's PARTIAL
8. Only if every claim checks out is it a PASS

## What You Output
Structured verdict with source-by-source verification.
```

### What the Sub-Agent Receives

- The attestation card (the output of step 2)
- Read access to the project (files, git, wiki)

### What It Does NOT Receive

- The GATHER output from step 1
- The reasoning chain that produced the attestation
- Any context about intent beyond what's written in the card

This isolation is by design. The research (CoVe, Meta AI) shows that models that can see their own reasoning during verification repeat hallucinations instead of catching them.

### Verdict Format

```markdown
## Result: {PASS | FAIL | PARTIAL}

### Source Verification
| Source | Card Claims | Actual | Match? |
|--------|------------|--------|--------|
| {path} | {what card says} | {what file actually says} | Yes/No |

### Change Verification
| Change | Supported? | Notes |
|--------|-----------|-------|
| {description} | Yes/No | {why} |

### Missing Evidence
- {sources that should have been checked but weren't}

### Verdict
{Explanation. If FAIL or PARTIAL, what specifically failed.}
```

### On FAIL

The orchestrator retries the ATTEST phase with the validation feedback, up to the retry limit defined in the WORKFLOW.md. The failed attestation is preserved as a retry file in the run folder. See [Workflow Design Guide](../workflow-design/PAGE.md).

### On PASS

The orchestrator proceeds to EXECUTE. The validated attestation becomes the specification for exactly what changes to make.

---

## Foreground Validation (/validate Skill)

A skill the user invokes manually in chat. It does NOT produce an attestation card — it runs checks and reports findings. Think of it as a local mini-CI.

```
/validate

"Code edit validation and audit. Ensures correctness and alignment
with established style guides, connected processes, and user vision.
Use after any significant code changes or wiki updates."
```

### What It Does

1. **Read recent diffs** — what actually changed (git diff, staged changes)
2. **Run tests** — if the project has tests, run them
3. **Run build** — does it compile?
4. **Run linter** — style violations?
5. **Check exports** — did we break any importers? (see export-safety)
6. **Check wiki accuracy** — if PAGE.md files changed, do cited sources still exist?
7. **Check style/conventions** — reads the project wiki for established patterns
8. **Report** — checklist of findings, pass/fail per check

### How It Discovers What to Check

The skill reads the project wiki to find project-specific conventions. Different project types have different checks:

| Project Type | What /validate Checks |
|-------------|----------------------|
| Coding | Tests, build, lint, exports, style guide |
| Research Vault | JSON schema validity, citation integrity, enrichment completeness |
| Office Suite | Template rendering, format compliance |
| Studio | Asset integrity, pipeline output, render checks |

The skill is generic — the knowledge is in the wiki. No hardcoded checks.

### When to Use It

- After a significant refactor (multiple files changed)
- Before committing to a shared branch
- After an AI assistant made changes you want to double-check
- When you just want peace of mind

### When NOT to Use It

- Quick CSS fix you can see is correct
- Documentation-only changes
- Exploratory work you're about to throw away

[/validate skill not yet implemented]

---

## PR Validation (Attestation Cards)

When shipping work via `/pr` or `/commit`, the producing AI generates an [Attestation Card](../attestation-card/PAGE.md) embedded in the PR description. A **fresh AI instance** reviews it — different context, no shared history.

```
You + AI: make changes in chat
  ↓
/pr
  ↓
Same AI produces attestation card (retrospective — documenting what was done)
  ↓
Card embeds in PR description
  ↓
Fresh AI instance reviews: diff + card only
  Does NOT see: the conversation that led to the changes
  Its job: does the evidence support the diff?
  ↓
Reviewer: APPROVE / REQUEST CHANGES / FLAG FOR HUMAN
```

The producer and the reviewer are **never the same context**. This is the CoVe independence principle applied to the PR workflow.

See [Attestation Card](../attestation-card/PAGE.md) for the full template, card variants, and the review agent's output format.

---

## Failure Modes

**Rubber-stamping** — The validator says PASS without actually reading sources. Detectable by checking whether the output references specific content from the sources, not just "confirmed."

**Over-rejection** — Failing attestations for pedantic reasons. The threshold: does the evidence support the change? Not: does the wording match exactly.

**Scope creep** — The validator starts proposing its own changes. It should verify only what's in front of it.

**Context leakage** — The validator has access to the GATHER output or the conversation history. Must be prevented at the harness level — don't include it in the sub-agent prompt or the PR review context.

---

## Lessons and Calibration

When the validator catches a real problem — a hallucinated source, an unsupported claim — that's a lesson. The orchestrator appends it to the agent's LESSONS.md so future runs are informed.

When the validator over-rejects and the human overrides, that's also a lesson. Over time, LESSONS.md becomes the feedback loop for improving validation accuracy. When enough lessons accumulate (~500 tokens), a review ticket is created for the human to promote the best ones into the WORKFLOW.md. See [Agent Folder Structure](../agent-folder-structure/PAGE.md).

---

## How the Pieces Connect

```
                    ┌──────────────────────────┐
                    │  Evidence-Gated Execution │ ← the philosophy
                    │  (when and why to validate)│
                    └─────────┬────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────┐  ┌──────────────┐  ┌────────────────┐
    │  Background  │  │  /validate   │  │  PR Attestation│
    │  Workflows   │  │  Skill       │  │  Card          │
    │              │  │              │  │                │
    │  Mandatory   │  │  Opt-in      │  │  On /pr or     │
    │  for agents  │  │  for humans  │  │  /commit       │
    └──────┬──────┘  └──────┬──────┘  └───────┬────────┘
           │                │                  │
           ▼                ▼                  ▼
    ┌─────────────┐  ┌──────────────┐  ┌────────────────┐
    │  Workflow    │  │  Local checks│  │  Fresh AI       │
    │  Design     │  │  (tests,     │  │  reviews card   │
    │  Guide      │  │  build, lint)│  │  + diff         │
    │              │  │              │  │                │
    │  Steps 1-5  │  │  Reports     │  │  APPROVE or    │
    │  in every   │  │  findings    │  │  REQUEST        │
    │  workflow   │  │              │  │  CHANGES       │
    └─────────────┘  └──────────────┘  └────────────────┘
           │                                   │
           ▼                                   ▼
    ┌─────────────┐                   ┌────────────────┐
    │  Attestation │                   │  Attestation   │
    │  Card        │ ← same format →  │  Card          │
    │  (in run     │                   │  (in PR body)  │
    │  folder)     │                   │                │
    └─────────────┘                   └────────────────┘
```

---

## Related

- [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md) — the philosophy (when and why)
- [Attestation Card](../attestation-card/PAGE.md) — the artifact (template, variants, generation flow)
- [Workflow Design Guide](../workflow-design/PAGE.md) — how to build workflows with validation baked in
- [Agent Folder Structure](../agent-folder-structure/PAGE.md) — where run folders and LESSONS.md live
- [System Overview](../system-overview/PAGE.md) — the three-layer architecture
- [Setup](../setup/PAGE.md) — how projects get the default validation infrastructure
