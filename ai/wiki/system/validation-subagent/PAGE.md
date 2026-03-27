# Validation Subagent

> The validator's job is to break the case. If it can't, the case holds.

---

## What This Is

A portable validation agent that enforces [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md) across CLI harnesses. It receives an attestation, independently verifies the evidence, and returns PASS, FAIL, or PARTIAL. It is the gate between "here's what I plan to do" and "go ahead and do it."

The validation subagent is designed to be the same logic regardless of which CLI runs it — Kimi CLI, Claude Code, OpenCode, or any harness that supports sub-agents or hooks.

---

## How It Works

### Input

The validator receives exactly two things:

1. **The attestation** — the structured proposal produced by the ATTEST phase
2. **Access to the project** — read-only access to files, git, and external sources

It does NOT receive:
- The GATHER output
- The reasoning chain that produced the attestation
- Any context about why this attestation was created

This isolation is by design. The research (CoVe, Meta AI) shows that when a model can see its own reasoning during verification, it repeats hallucinations instead of catching them. The validator works from claims and sources alone.

### Process

```
For each proposed change in the attestation:
  1. Read the cited source (file path, commit, URL)
  2. Confirm the source says what the attestation claims
  3. Confirm the proposed change follows from the evidence
  4. Check the confidence level is justified

Then:
  5. Check for sources that should have been consulted but weren't
  6. Check for logical gaps in the reasoning
  7. Issue final verdict: PASS, FAIL, or PARTIAL
```

### Output

```markdown
# Validation: {attestation title}

## Result: {PASS | FAIL | PARTIAL}

## Source Verification
For each cited source:
- {source path/ref}: {CONFIRMED — matches claim | MISMATCH — actual content differs | NOT FOUND — source doesn't exist}

## Change Verification
For each proposed change:
- {change description}: {SUPPORTED — evidence sufficient | UNSUPPORTED — evidence doesn't justify | HALLUCINATED — source fabricated}

## Missing Evidence
- {sources that should have been checked but weren't}

## Verdict
{Explanation of the result. If FAIL or PARTIAL, what specifically failed.}
```

---

## Deployment Modes

The validation subagent operates in different modes depending on the context:

### Mode 1: Workflow Step (Background Agents)

In a background agent workflow, the validator is step 3 of the EGE loop. The orchestrator spawns it as a sub-agent with the attestation.

```
Orchestrator → spawns → Validation Subagent
  Input: attestation only
  Output: PASS/FAIL/PARTIAL
  On FAIL: orchestrator retries ATTEST phase
  On PASS: orchestrator proceeds to EXECUTE
```

This is the standard mode described in [Workflow Design Guide](../workflow-design/PAGE.md).

### Mode 2: Tool Call Hook (Interactive Agents)

[Not yet implemented]

In interactive CLI sessions (Claude Code, Kimi CLI), the validator hooks into tool calls that mutate files. When the agent issues a `write_file` or `edit_file` call:

1. The hook intercepts the call
2. The agent's recent reasoning is extracted as an implicit attestation
3. The validation subagent checks: does the diff match what was discussed? Are the changes justified by the conversation context?
4. PASS → tool call proceeds. FAIL → tool call rejected with explanation.

**Implementation considerations:**
- The hook needs access to the conversation context to extract the implicit attestation
- The validator needs to be fast — this is in the critical path of the user's workflow
- May need a lighter validation mode for interactive use (check diff coherence, not full source verification)
- Each CLI has different hook mechanisms:
  - **Claude Code:** hooks in `settings.json` can run scripts on tool calls
  - **Kimi CLI:** [hook mechanism TBD]
  - **OpenCode:** [hook mechanism TBD]

### Mode 3: Post-Commit Review (CI/CD)

[Not yet implemented]

After code is committed, a CI step runs the validator against the diff:

1. Extract the commit message and changed files
2. Construct an attestation from the commit metadata
3. Validate: do the changes match what the commit message describes?
4. Flag discrepancies for human review

This is the lightest mode — it doesn't block, just reports.

---

## Cross-CLI Portability

The validator's core logic is the same everywhere:

```
Input:  attestation (structured markdown)
        + project access (read-only)
Output: verdict (PASS/FAIL/PARTIAL with evidence)
```

What differs per CLI:
- **How the validator is invoked** (sub-agent spawn, hook, CI step)
- **How the attestation is provided** (explicit file, extracted from context, constructed from diff)
- **What happens on FAIL** (retry, reject tool call, flag for review)

If we can standardize the attestation format and the verdict format, the validator becomes a drop-in component. The surrounding harness handles invocation and consequence.

[Standardized attestation schema not yet finalized]

---

## Designing the Validator Prompt

The validator needs a focused system prompt. Draft:

```markdown
You are a validation agent. Your sole purpose is to verify attestations.

## Your Rules
1. You receive an attestation — a structured proposal with cited sources
2. For EVERY cited source, you MUST read the actual file/commit/URL
3. Confirm or deny each claim against real evidence
4. You do NOT propose changes, suggest improvements, or add context
5. You do NOT accept claims without checking sources
6. If a source doesn't exist or doesn't say what's claimed, that's a FAIL
7. If evidence is insufficient but not fabricated, that's PARTIAL
8. Only if every claim checks out is it a PASS

## What You Check
- Does each cited file exist?
- Does the file contain what the attestation claims?
- Does the proposed change follow logically from the evidence?
- Is the confidence level appropriate given the evidence?
- Are there obvious sources that should have been consulted but weren't?

## What You Output
Structured verdict with source-by-source verification.
Never explain what the attestation is about — just verify it.
```

[This prompt is a working draft — will be refined through testing]

---

## Failure Modes to Watch For

**Rubber-stamping** — The validator says PASS without actually reading sources. Detectable by checking whether the validator's output references specific content from the sources, not just "confirmed."

**Over-rejection** — The validator fails attestations for pedantic reasons ("the commit message says 'update' but the code says 'modify'"). The threshold should be: does the evidence support the change, not does the wording match exactly.

**Scope creep** — The validator starts proposing its own changes or flagging things outside the attestation. It should verify only what's in front of it.

**Context leakage** — The validator somehow has access to the GATHER output or original reasoning. This must be prevented at the harness level — don't include it in the prompt.

---

## Relationship to LESSONS.md

When the validator catches a real problem — a hallucinated source, an unsupported claim — that's a lesson. The orchestrator should append it to the agent's LESSONS.md so future runs are informed.

When the validator over-rejects and the human overrides, that's also a lesson — the validation prompt may need refinement.

Over time, LESSONS.md becomes the training data for improving the validator's calibration.
