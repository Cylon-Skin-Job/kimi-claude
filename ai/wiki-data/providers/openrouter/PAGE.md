# OpenRouter

Meta-provider — unified gateway to 345+ models from 50+ providers. Single API key, single endpoint, OpenAI-compatible.

## API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| Chat Completions | `https://openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer` |
| Models List | `https://openrouter.ai/api/v1/models` | **No auth needed** (public) |

The models list endpoint is public and returns all available models with pricing. This is the primary data source for keeping this wiki collection up to date.

## Special Models

| Model | Context | Notes |
|-------|---------|-------|
| openrouter/auto | 2M | Auto-routes to best model for the request |
| openrouter/free | 200K | Routes to available free models |

## Why OpenRouter

- **Single API key** for any provider
- **OpenAI-compatible** — works with any CLI that supports custom endpoints
- **Free models** available (Qwen3-Coder, GLM-4.5-Air, etc.)
- **Per-model pricing** — pay only for what you use, no subscriptions
- **Model list API** — programmatic access to all available models (used by this wiki for self-updates)

## For Self-Healing Wiki

The `/v1/models` endpoint returns:
```json
{
  "data": [
    {
      "id": "anthropic/claude-opus-4-6",
      "name": "Claude Opus 4.6",
      "context_length": 1000000,
      "pricing": { "prompt": "0.000015", "completion": "0.000075" },
      "top_provider": { "max_completion_tokens": 32000 }
    }
  ]
}
```

A scheduled job can fetch this, diff against current wiki pages, and update model lists and pricing automatically.

## Pricing

See [openrouter.ai/models](https://openrouter.ai/models) — per-model pricing, no platform fee for most models.
