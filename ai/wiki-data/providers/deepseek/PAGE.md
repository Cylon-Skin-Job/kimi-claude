# DeepSeek

DeepSeek-V3 and R1 model families. OpenAI-compatible API. Previous DeepSeek-Coder line was folded into the main V3 series.

## API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| Chat Completions | `https://api.deepseek.com/v1/chat/completions` | `Authorization: Bearer` |
| Models List | `https://api.deepseek.com/v1/models` | `Authorization: Bearer` |

## Models

| Model | Context | Notes |
|-------|---------|-------|
| deepseek-v3.2 | 164K | Latest flagship |
| deepseek-v3.2-speciale | 164K | Specialized variant |
| deepseek-r1 | 164K | Reasoning model |
| deepseek-v3.1-terminus | 164K | Previous gen |

No dedicated "coder" model — DeepSeek-Coder was folded into the V3 line. V3.2 handles code well as a general model.

## Pricing

See [platform.deepseek.com/api-docs/pricing](https://platform.deepseek.com/api-docs/pricing)

Known for very competitive pricing. Also available via OpenRouter and inference platforms.
