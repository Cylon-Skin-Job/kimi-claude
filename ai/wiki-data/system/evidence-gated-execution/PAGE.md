# Evidence-Gated Execution

> No mutation without attestation. No attestation without verification. No verification without evidence.

---

## What This Is

Evidence-Gated Execution (EGE) is the validation philosophy for the entire system. It defines when and how AI work gets checked — from background agents running autonomously to the user invoking a quick review in chat.

The core principle: **every autonomous mutation must be backed by evidence, verified independently, and recorded as an artifact.** But the system is not a straightjacket — interactive work with a human in the loop is exempt. The user decides when to invoke validation, not the system.

---

## When EGE Applies

### Mandatory: Background Agents

Any agent acting autonomously — wiki updates, code changes via tickets, scheduled maintenance — follows the full EGE loop. No exceptions. The human is not watching, so the system must verify.

The validation is baked into the [Workflow Design Guide](../workflow-design/PAGE.md) as numbered steps:

```
1. GATHER    → collect evidence from real sources
2. ATTEST    → produce the attestation (what to change, why, evidence, confidence)
3. VALIDATE  → independently verify the attestation (sub-agent, fresh context)
4. EXECUTE   → make exactly the changes the validated attestation describes
5. RECORD    → write the outcome back, update logs
```

The gate is between ATTEST and EXECUTE. Nothing executes until VALIDATE passes. See [Workflow Design Guide](../workflow-design/PAGE.md) for implementation details and templates.

### Optional: Interactive Chat

When you're working with an AI assistant in chat, YOU are the validator. You see the diff, you approve or reject. Adding a mandatory 5-step gate to "change this CSS color" is hostile UX.

Instead, the system offers tools you invoke when you want them:

| Tool | What It Does | When To Use |
|------|-------------|-------------|
| `/validate` | Runs local checks: tests, build, lint, style, wiki accuracy. Reports findings. | After significant changes, before committing |
| `/pr` or `/commit` | Generates an [Attestation Card](../attestation-card/PAGE.md) embedded in the PR. A fresh AI instance reviews it. | When shipping work for review |
| Nothing | You saw the diff. You're satisfied. Move on. | Quick edits, minor fixes |

See [Validation](../validation-subagent/PAGE.md) for details on both tools and the review flow.

### The Boundary

**Human in the loop = optional.** The user has `/validate` and attestation cards available but is never forced to use them.

**Agent acting autonomously = mandatory.** Every workflow step produces evidence. The VALIDATE phase is a required workflow step. The [Attestation Card](../attestation-card/PAGE.md) is the artifact.

---

## The Three Phases

### 1. Produce

Gather evidence, reason about the change, write the attestation. The trained attention is on *making the case*.

- Read the target files, git history, wiki pages, STATE.md
- Propose specific changes with cited sources
- Assess confidence per change
- Document risks

The output is an [Attestation Card](../attestation-card/PAGE.md) — a structured document that records the full reasoning chain.

### 2. Validate

Shift roles. The trained attention is now on *breaking the case*.

The validator receives ONLY the attestation — not the gather output, not the reasoning chain. Its sole job is to verify:

- Does each cited source exist and say what the attestation claims?
- Does the proposed change follow from the evidence?
- Is the confidence level justified?
- Are there sources that should have been consulted but weren't?

**Independence is critical.** The research (CoVe, Meta AI) shows that when a model can see its own reasoning during verification, it repeats hallucinations instead of catching them. The validator works from claims and sources alone.

In background workflows, this is a sub-agent call within the orchestrator — not a separate standing agent. In PR review, this is a fresh AI instance that only sees the diff and the card.

### 3. Execute

The validated attestation becomes the specification. Make exactly the changes it describes. Nothing more, nothing less. Record the outcome back onto the attestation.

---

## The Attestation

The discrete artifact produced by this pattern. See [Attestation Card](../attestation-card/PAGE.md) for the full template, variants, and generation flow.

In background workflows, the attestation lives in the run folder (`runs/{timestamp}/attestation.md`). In PRs, it's embedded in the PR description. In `/validate`, it's printed to chat (not persisted).

---

## Why This Works

Evidence-Gated Execution synthesizes converging research from 2023-2026 showing that structured produce-verify-execute loops yield **5-22 percentage point accuracy gains** over direct generation in agentic systems.

Key principles from the research:

- **Structure over free-form reasoning** — Semi-formal traces that act as auditable certificates outperform chain-of-thought
- **Independent verification** — The validation phase must not have access to the production phase's reasoning, preventing confirmation bias
- **External grounding** — LLMs alone are unreliable self-critics; verification must reference external sources (code, git, docs)
- **Verification improves generation** — Training on verification objectives alone improves generation quality; the two skills are mutually reinforcing

---

## Research Foundations

### Chain-of-Verification (CoVe) — Meta AI
*Dhuliawala, Komeili, Xu, Raileanu, Li, Celikyilmaz, Weston*
ACL 2024 Findings

The model drafts a response, generates verification questions, answers them **independently** (cannot see the draft), then produces a final verified response. The independence of the verification pass is the critical insight — it prevents the model from copying its own hallucinations.

**Result:** 50-70% reduction in factual hallucinations.

- Paper: https://arxiv.org/abs/2309.11495
- Published: https://aclanthology.org/2024.findings-acl.212/

### Agentic Code Reasoning — Meta
*Ugare, Chandra*
March 2026

Semi-formal structured reasoning requiring agents to construct explicit premises, trace execution paths, and derive formal conclusions. The trace acts as a **certificate** — the agent cannot skip cases or make unsupported claims.

**Result:** 5-12 percentage point gains over standard agentic baselines.

- Paper: https://arxiv.org/abs/2603.01896

### Reflexion — Shinn, Cassano, Gopinath, Narasimhan, Yao
NeurIPS 2023

Agents verbally reflect on task feedback and store reflections in episodic memory to improve subsequent trials. The loop: act, get feedback, reflect, retry.

**Result:** +21 points on HumanEval (code), +22 points on AlfWorld (decisions).

- Paper: https://arxiv.org/abs/2303.11366

### Co-Sight — ZTE AICloud
2025

Two mechanisms: Conflict-Aware Meta-Verification (targeted falsification) and Trustworthy Reasoning with Structured Facts (source-verified, traceable knowledge organized across agents).

**Result:** 84.4% on GAIA benchmark (state of the art). Structured evidence organization outperforms purely generative reasoning.

- Paper: https://arxiv.org/abs/2510.21557

### TxAgent — Harvard Medical School (Zitnik Lab)
*Gao, Zhu, Kong, Zitnik*
March 2025

Multi-step reasoning agent grounding every step in verifiable, source-tracked evidence from trusted sources before acting.

**Result:** 92.1% accuracy, surpassing GPT-4o by 25.8%.

- Paper: https://arxiv.org/abs/2503.10970
- Project: https://zitniklab.hms.harvard.edu/TxAgent/

### CRITIC — Gou, Shao, Gong et al.
ICLR 2024

LLM generates output, then interacts with external tools to verify, generates critique, iterates. Key finding: **LLMs alone are unreliable self-critics** — external tool interaction is essential.

- Paper: https://arxiv.org/abs/2305.11738

### VerifiAgent — Han et al.
EMNLP 2025

Two-level verification: meta-verification (completeness/consistency) + tool-based adaptive verification. Verifies outputs before finalization.

- Paper: https://arxiv.org/abs/2504.00406

### Learning to Self-Verify
February 2025

Training on verification objectives alone improves generation quality. Verification and generation are mutually reinforcing skills.

- Paper: https://arxiv.org/abs/2602.07594

### EvidenceRL — Ben Tamo, Lu, Marteau, Nnamdi, Wang
2025

Reinforcement learning to train models to ground responses in retrieved evidence before answering. Hallucinations dropped nearly 5x; grounding scores rose from 47.6 to 78.2.

- Paper: https://arxiv.org/abs/2603.19532

### Additional References

- **Self-Refine** (CMU/Allen AI, 2023) — Iterative refinement with self-feedback: https://arxiv.org/abs/2303.17651
- **MAR: Multi-Agent Reflexion** (Dec 2025) — Diverse critic personas over single-agent reflection: https://arxiv.org/abs/2512.20845
- **ProCo: Key Condition Verification** (EMNLP 2024) — Verify-then-correct via masked condition prediction: https://arxiv.org/abs/2405.14092
- **Meta FAIR Collaborative Reasoner** (2025) — Self-collaboration yields up to 29.4% gains over CoT: https://ai.meta.com/blog/meta-fair-updates-agents-robustness-safety-architecture/

---

## Related

- [Validation](../validation-subagent/PAGE.md) — how validation works in practice (background + foreground)
- [Attestation Card](../attestation-card/PAGE.md) — the artifact template, generation flow, review agent
- [Workflow Design Guide](../workflow-design/PAGE.md) — how to build EGE-compliant workflows
- [System Overview](../system-overview/PAGE.md) — how EGE fits into the three-layer architecture
- [Agent Folder Structure](../agent-folder-structure/PAGE.md) — where attestations live in run folders
