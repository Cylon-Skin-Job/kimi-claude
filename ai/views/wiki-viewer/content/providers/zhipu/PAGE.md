# Zhipu AI (GLM)

GLM model family from Zhipu AI. OpenAI-compatible endpoint.

## API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| Chat Completions | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | API key |
| Via OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer` |

## Models

| Model | Context | Notes |
|-------|---------|-------|
| glm-5 | 80K | Latest flagship |
| glm-5-turbo | 203K | Extended context |
| glm-4.7 / glm-4.7-flash | 203K | Previous gen |
| glm-4.5-air | 131K | Budget tier |
| glm-4.5-air:free | 131K | Free on OpenRouter |

## Pricing

See [open.bigmodel.cn/pricing](https://open.bigmodel.cn/pricing)

Free tier available via OpenRouter (glm-4.5-air:free).
