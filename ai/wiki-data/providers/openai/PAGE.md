# OpenAI

GPT and Codex model families. OpenAI-compatible endpoint (the original standard).

## API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| Chat Completions | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer` |
| Models List | `https://api.openai.com/v1/models` | `Authorization: Bearer` |

## Coding CLI

**Codex CLI** — Open-source terminal agent
- Uses API keys directly
- Works with GPT-5.x-Codex, o3, o4-mini, GPT-4.1

**ChatGPT Pro** ($200/mo) — Unlimited access including Codex cloud agent

## Models

### Codex Family (Code-Specific)
| Model | Context | Price (input/output per M) |
|-------|---------|---------------------------|
| gpt-5.3-codex | 400K | ~$1.25 / $10 |
| gpt-5.2-codex | 400K | ~$1.25 / $10 |
| gpt-5.1-codex | 400K | ~$1.25 / $10 |
| gpt-5.1-codex-mini | 400K | ~$0.25 / $2 |
| gpt-5-codex | 400K | ~$1.25 / $10 |

### Flagship
| Model | Context | Notes |
|-------|---------|-------|
| gpt-5.4 / gpt-5.4-pro | 1.05M | Largest context |
| gpt-4.1 / gpt-4.1-mini | 1M | Balanced |
| o4-mini | 200K | Reasoning |
| o3 / o3-pro | 200K | Reasoning |
| gpt-oss-120b | 131K | Open-source from OpenAI |

## Pricing

See [openai.com/api/pricing](https://openai.com/api/pricing)
