# Evidence-Gated Execution

> No mutation without attestation. No attestation without verification. No verification without evidence.

---

## What This Is

Evidence-Gated Execution (EGE) is the default execution pattern for all agents in the kimi-claude system. Before any agent modifies state — wiki pages, code, tickets, configuration — it must produce a structured attestation, validate that attestation independently, and then execute only what the validated attestation describes.

The pattern has three phases:

1. **Produce** — Gather evidence, reason about the change, write the attestation. The trained attention is on *making the case*.
2. **Validate** — Shift roles. The trained attention is now on *breaking the case*. Does the evidence support the change? Are sources real? Is anything hallucinated?
3. **Execute** — The validated attestation becomes the specification. Make exactly the changes it describes. Record the outcome back onto the attestation.

The attestation is a persistent artifact — it lives alongside the thing it changed as proof that the change was reasoned about, challenged, and executed deliberately.

---

## The Attestation

The discrete artifact produced by this pattern. Each attestation is a file that captures the full reasoning chain: what was gathered, what was proposed, why it was validated, and what was actually done.

*Schema and format: TBD — to be designed based on our implementation needs.*

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

## Our Implementation

*TBD — this section will be built as we design how EGE applies to kimi-claude's workspace agents, workflow templates, and the wiki knowledge graph.*

---

## Open Questions

- What is the attestation schema?
- How does the validation phase achieve independence from the production phase?
- What external tools/sources does the validator reference?
- How do attestations relate to existing run folder evidence cards?
- How does EGE differ in skill-driven (active) vs workflow-driven (background) contexts?
- Should agent-building agents inject EGE into every workflow by default?
- How do attestations become edges in the knowledge graph?
