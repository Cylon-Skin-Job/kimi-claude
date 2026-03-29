# Inference Platforms

These platforms host other providers' models (Qwen, DeepSeek, Llama, etc.) with OpenAI-compatible endpoints. They compete on speed and price.

## Platforms

### DeepInfra
| Field | Value |
|-------|-------|
| Endpoint | `https://api.deepinfra.com/v1/openai/chat/completions` |
| Models | `https://api.deepinfra.com/v1/openai/models` |
| Pricing | [deepinfra.com/pricing](https://deepinfra.com/pricing) |
| Strength | Competitive per-token pricing |

### Fireworks AI
| Field | Value |
|-------|-------|
| Endpoint | `https://api.fireworks.ai/inference/v1/chat/completions` |
| Models | `https://api.fireworks.ai/inference/v1/models` |
| Pricing | [fireworks.ai/pricing](https://fireworks.ai/pricing) |
| Strength | Fast inference, optimized serving |

### Together AI
| Field | Value |
|-------|-------|
| Endpoint | `https://api.together.xyz/v1/chat/completions` |
| Models | `https://api.together.xyz/v1/models` |
| Pricing | [together.ai/pricing](https://www.together.ai/pricing) |
| Strength | Free tier available |

### Groq
| Field | Value |
|-------|-------|
| Endpoint | `https://api.groq.com/openai/v1/chat/completions` |
| Models | `https://api.groq.com/openai/v1/models` |
| Pricing | [groq.com/pricing](https://groq.com/pricing) |
| Strength | Fastest inference (custom LPU hardware), free tier |

## All OpenAI-Compatible

Every platform above uses the same API format:
```
POST /v1/chat/completions
Authorization: Bearer {api_key}
Content-Type: application/json

{ "model": "...", "messages": [...] }
```

Any CLI that supports custom endpoints works with all of these.
