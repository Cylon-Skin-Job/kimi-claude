# Workflow Design Guide

> Every workflow is an orchestrator talking to sub-agents. Every mutation passes through a gate.

---

## Who This Is For

You are either:
- A human designing a new workflow for an agent
- An agent-building agent constructing workflows programmatically
- An existing agent checking whether its workflow is compliant

This page tells you how to design workflows that implement [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md). For where workflow files live, see [Agent Folder Structure](../agent-folder-structure/PAGE.md).

---

## The Minimum Viable Workflow

Every workflow needs at least these phases:

```
1. GATHER    — collect evidence from real sources
2. ATTEST    — produce the attestation (what to change, why, evidence, confidence)
3. VALIDATE  — independently verify the attestation
4. EXECUTE   — make exactly the changes the validated attestation describes
5. RECORD    — write the outcome back to the attestation, update logs
```

This is the Evidence-Gated Execution loop applied to workflow steps. The gate is between ATTEST and EXECUTE — nothing executes until VALIDATE passes.

---

## Phase Details

### 1. GATHER

The sub-agent reads everything relevant. It does not propose or decide — it reports.

**Must do:**
- Read the ticket to understand the trigger
- Read the target files that will be changed
- Check git log for recent changes to those files
- Read ai/STATE.md for cross-workspace context
- Read index.json or other graph data to find related resources
- List every source it read (paths, commit hashes)

**Must not do:**
- Propose changes
- Make judgments about what should change
- Skip sources because they "probably haven't changed"

### 2. ATTEST

The sub-agent receives the gather output and produces a structured attestation.

**Attestation format:**

```markdown
# Attestation: {what is being changed}

## Proposed Changes
For each change:
- **Target:** {file path}
- **What:** {before → after}
- **Why:** {cite the specific source — file path, line, commit hash}
- **Confidence:** {High | Medium | Low} — {reasoning}

## Sources Consulted
- {path} — {what was found}
- {commit hash} — {what changed}

## Risks
- {anything that could go wrong}
- {edge cases}

## Recommendation
{Proceed | Proceed with caution | Stop — with explanation}
```

**Key rule:** Every proposed change must cite a specific source. "The code changed" is not sufficient — "line 47 of lib/secrets.js changed the export name from X to Y per commit abc123" is.

[Formal attestation schema not yet finalized — above is the working draft]

### 3. VALIDATE

A sub-agent receives ONLY the attestation — not the gather output, not the original reasoning chain. Its sole job is to break the case.

**Must do:**
- For each cited source: read the actual file/commit and confirm it says what the attestation claims
- For each proposed change: verify the reasoning follows from the evidence
- Check for hallucinated sources (file doesn't exist, commit doesn't contain what's claimed)
- Check for missing evidence (change proposed without adequate sourcing)
- Check confidence levels are justified

**Must not do:**
- Propose additional changes
- Accept the attestation on trust
- Skip source verification because the attestation "looks reasonable"

**Independence is critical.** The validator must not see the GATHER output or the reasoning that produced the attestation. It works from the attestation alone, verifying claims against real sources. This prevents confirmation bias — the research shows models that can see their own draft during verification repeat hallucinations (see CoVe, Meta AI).

**Validation output:**

```markdown
# Validation: {attestation title}

## Result: {PASS | FAIL | PARTIAL}

## Checks
For each proposed change:
- Source verified: {yes/no — what the source actually says}
- Reasoning sound: {yes/no — does the evidence support the change}
- Confidence appropriate: {yes/no}

## Issues Found
- {any hallucinated sources}
- {any unsupported claims}
- {any missing evidence}

## Recommendation
{Proceed | Revise attestation | Stop}
```

**If FAIL:** The orchestrator can retry the ATTEST phase with the validation feedback, up to the retry limit. The failed attestation is preserved as a retry file.

**If PARTIAL:** The orchestrator decides — proceed with the passing changes only, or retry for the full set.

### 4. EXECUTE

The sub-agent receives the validated attestation and makes exactly the changes described. Nothing more, nothing less.

**Must do:**
- Apply each change listed in the attestation
- Update LOG.md for each file changed
- Record what was actually done (the diff, any surprises)

**Must not do:**
- Make changes not in the attestation
- "Improve" things it notices along the way
- Skip changes because they seem minor

### 5. RECORD

The orchestrator finalizes the audit trail.

**Must do:**
- Write the execution outcome back to the attestation artifact
- Update the run's manifest.json
- Update run-index.json with step completion
- Update ai/STATE.md
- Close or update the ticket

---

## Workflow Template

Copy this as a starting point for new workflows:

```yaml
---
bot_name: {bot-name}
description: {what this workflow does}
icon: {material icon}
color: "{hex color}"
model:
  thinking: false
  max_context_size: 131072
limits:
  max_concurrent_runs: 1
  timeout_minutes: 10
  max_retries: 2
  confidence_threshold: 70
scope:
  read: ["*"]
  write: ["{specific paths this workflow can modify}"]
---

# {Workflow Name}

You are an orchestrator. You delegate each step to a sub-agent and evaluate the result before proceeding. You follow Evidence-Gated Execution — no mutation without a validated attestation.

Read the system wiki's Evidence-Gated Execution page (ai/wiki/system/evidence-gated-execution/PAGE.md) if you need to understand the philosophy.

## Steps

### 1. Gather
Spawn a sub-agent to read the ticket and gather all relevant source material.

Instruct it to:
- Read {the target files}
- Check git log for recent changes
- Read ai/STATE.md for cross-workspace context
- Return a summary of every source read

Evaluate: Did the sub-agent find the sources? Is the picture complete?

### 2. Attest
Spawn a sub-agent with the gather output. Instruct it to produce an attestation: proposed changes, cited sources, confidence levels, risks.

Evaluate: Are all changes above the confidence threshold? Are sources cited specifically?

### 3. Validate
Spawn a sub-agent with ONLY the attestation (not the gather output). Instruct it to verify every cited source independently and check that the evidence supports each proposed change.

Evaluate: Did validation pass? If FAIL, retry step 2 with feedback. If PARTIAL, decide whether to proceed with passing changes.

### 4. Execute
Spawn a sub-agent with the validated attestation. Instruct it to apply the approved changes and update LOG.md.

Evaluate: Did changes apply cleanly?

### 5. Record
Close the loop. Update manifest, STATE.md, and ticket.
```

---

## Adapting EGE to Different Domains

The five phases stay the same. What changes is *what counts as evidence*.

| Domain | GATHER reads | ATTEST cites | VALIDATE checks |
|--------|-------------|-------------|-----------------|
| **Wiki updates** | PAGE.md, source code, git log | File paths, line numbers, commits | Re-reads sources, confirms claims |
| **Code changes** | Source files, tests, docs | Functions, line ranges, test results | Re-runs tests, reads actual code |
| **Ticket triage** | Issue description, related tickets, code | Issue links, commit refs, duplicates | Confirms links exist, checks staleness |
| **Deployments** | Config, env vars, health checks | Env state, dependency versions | Re-reads config, verifies endpoints |

---

## Anti-Patterns

**"Trust the gather"** — Skipping validation because the gather step was thorough. The whole point is that thoroughness in gathering doesn't prevent hallucination in proposing. Validate independently.

**"Validate in context"** — Giving the validator access to the gather output or the reasoning chain. This defeats independence. The validator sees the attestation and real sources, nothing else.

**"Execute and check"** — Making changes first, then verifying. This inverts the gate. Evidence before action, not action before evidence.

**"One big step"** — Combining gather + propose + execute into a single sub-agent call. This removes the gate entirely. The sub-agent gathers, hallucinates a proposal, and executes it in one breath.

**"Skip for small changes"** — "It's just a date update, we don't need full EGE." Small changes are where hallucination hides. A "simple" date update that cites a nonexistent commit is still wrong.

---

## When EGE Is Not Required

- Specs and design documents written collaboratively with a human
- Riffing, brainstorming, exploration sessions
- Building and constructing new wiki pages interactively with user guidance
- Any context where a human is actively reviewing each step

The boundary: **human in the loop = optional. Agent acting autonomously = mandatory.**
