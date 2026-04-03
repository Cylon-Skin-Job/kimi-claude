# Provider Overview

Quick reference for AI coding providers, endpoints, and model recommendations.

> This collection is designed to be machine-maintained. Each provider page follows a standard schema so that the profile system and external pipelines can read and update them programmatically.

## Models by Use Case

### Code Generation (Primary Builder)
| Model | Provider | Context | Endpoint | Notes |
|-------|----------|---------|----------|-------|
| Claude Opus 4.6 | [Anthropic](../anthropic/PAGE.md) | 1M | `api.anthropic.com` | Max plan rolling window |
| GPT-5.4 Pro | [OpenAI](../openai/PAGE.md) | 1.05M | `api.openai.com` | Largest OpenAI context |
| GPT-5.x-Codex | [OpenAI](../openai/PAGE.md) | 400K | `api.openai.com` | Dedicated code models |
| Gemini 2.5 Pro | [Google](../google/PAGE.md) | 1M | `generativelanguage.googleapis.com` | Free tier via CLI |
| Grok 4.20 | [xAI](../xai/PAGE.md) | 2M | `api.x.ai` | Largest context available |

### Code Generation (Budget / Free)
| Model | Provider | Context | Endpoint | Notes |
|-------|----------|---------|----------|-------|
| Qwen3-Coder | [Qwen](../qwen/PAGE.md) | 262K | OpenRouter | Free tier available |
| Qwen3-Coder-Flash | [Qwen](../qwen/PAGE.md) | 1M | OpenRouter | $0.20/M input |
| Devstral Small | [Mistral](../mistral/PAGE.md) | 131K | `api.mistral.ai` | $0.10/M input |
| Gemini 2.5 Flash | [Google](../google/PAGE.md) | 1M | `generativelanguage.googleapis.com` | Free tier |
| GLM-4.5-Air | [Zhipu](../zhipu/PAGE.md) | 131K | OpenRouter | Free tier |

### Spec Writing / Review (Fast Reads)
| Model | Provider | Context | Notes |
|-------|----------|---------|-------|
| Qwen3-Coder-Plus | [Qwen](../qwen/PAGE.md) | 1M | Best coder lineup |
| Claude Sonnet 4.6 | [Anthropic](../anthropic/PAGE.md) | 1M | Fast + capable |
| Grok-Code-Fast-1 | [xAI](../xai/PAGE.md) | 256K | Dedicated code model |
| Devstral Medium | [Mistral](../mistral/PAGE.md) | 131K | Code-focused |

### Reasoning / Complex Tasks
| Model | Provider | Context | Notes |
|-------|----------|---------|-------|
| o3 / o4-mini | [OpenAI](../openai/PAGE.md) | 200K | Reasoning models |
| DeepSeek-R1 | [DeepSeek](../deepseek/PAGE.md) | 164K | Open-weight reasoning |
| Kimi-K2-Thinking | [Moonshot](../moonshot/PAGE.md) | 131K | Reasoning variant |

## Coding CLIs

| CLI | Provider | Plan | Rolling Window |
|-----|----------|------|---------------|
| **Claude Code** | Anthropic | Max $100-200/mo | 5-hour rolling |
| **Codex CLI** | OpenAI | Pro $200/mo | Per-request |
| **Gemini CLI** | Google | Free | Rate-limited |
| **Kimi CLI** | Moonshot | TBD | TBD |

## Inference Platforms

These host other providers' models with OpenAI-compatible endpoints:

| Platform | Endpoint | Notes |
|----------|----------|-------|
| [OpenRouter](../openrouter/PAGE.md) | `openrouter.ai/api/v1` | 345+ models, single key |
| [DeepInfra](../inference-platforms/PAGE.md) | `api.deepinfra.com/v1/openai` | Competitive pricing |
| [Fireworks](../inference-platforms/PAGE.md) | `api.fireworks.ai/inference/v1` | Fast inference |
| [Together](../inference-platforms/PAGE.md) | `api.together.xyz/v1` | Free tier |
| [Groq](../inference-platforms/PAGE.md) | `api.groq.com/openai/v1` | Fastest inference (LPU) |

## Schema

Every provider page follows this standard frontmatter in its index.json:

```json
{
  "provider": {
    "name": "Provider Name",
    "api_base": "https://api.example.com/v1",
    "models_endpoint": "https://api.example.com/v1/models",
    "openai_compatible": true,
    "pricing_url": "https://...",
    "coding_plan": { "name": "...", "price": "...", "window": "..." },
    "coding_models": ["model-id-1", "model-id-2"],
    "compatible_clis": ["claude-code", "cursor", "cline"]
  }
}
```
