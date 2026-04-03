# Anthropic

Claude model family. Native API uses its own format (not OpenAI-compatible), but accessible via [OpenRouter](../openrouter/PAGE.md) for OpenAI-compatible access.

## API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| Messages API | `https://api.anthropic.com/v1/messages` | `x-api-key` header |
| Models List | `https://api.anthropic.com/v1/models` | `x-api-key` header |
| Via OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer` |

**Note:** Native API is NOT OpenAI-compatible. Uses `x-api-key` header and different request/response format. For OpenAI-compatible access, use OpenRouter.

## Coding CLI

**Claude Code** — Official CLI (`claude` command)
- Max $100/mo: 5x Pro usage
- Max $200/mo: 20x Pro usage, 5-hour rolling token window
- Direct API access, no proxy needed

## Models

| Model | Context | Notes |
|-------|---------|-------|
| claude-opus-4-6 | 1M | Flagship, powers Claude Code |
| claude-sonnet-4-6 | 1M | Fast + capable |
| claude-sonnet-4-5 | 1M | Previous gen |
| claude-opus-4-5 | 200K | Previous flagship |
| claude-haiku-4-5 | 200K | Fast/cheap tier |

## Pricing

See [anthropic.com/pricing](https://www.anthropic.com/pricing)

API pricing is per-token. Max plans are subscription-based with rolling usage windows.
