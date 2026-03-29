# Qwen

Alibaba Cloud's model family. Has the **largest dedicated coding model lineup** of any provider. Most accessible via [OpenRouter](../openrouter/PAGE.md) or [inference platforms](../inference-platforms/PAGE.md) like DeepInfra.

## API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| DashScope (Native) | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | API key |
| Via OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer` |
| Via DeepInfra | `https://api.deepinfra.com/v1/openai/chat/completions` | `Authorization: Bearer` |

## Models

### Qwen3-Coder Family
| Model | Context | Price (input/output per M) | Notes |
|-------|---------|---------------------------|-------|
| qwen3-coder | 262K | $0.22 / $1.00 | Flagship, 480B-A35B MoE |
| qwen3-coder:free | 262K | Free | Free tier on OpenRouter |
| qwen3-coder-plus | 1M | $0.65 / $3.25 | Largest context coder |
| qwen3-coder-flash | 1M | $0.20 / $0.98 | Cheap + huge context |
| qwen3-coder-next | 262K | $0.12 / $0.75 | Newer iteration |
| qwen3-coder-30b-a3b | 160K | $0.07 / $0.27 | Tiny and very cheap |

### Previous Gen
| Model | Context | Notes |
|-------|---------|-------|
| qwen-2.5-coder-32b | 32K | Proven, widely hosted |
| qwen-2.5-coder-7b | 32K | Small / local |

Best accessed via OpenRouter (free tier available) or DeepInfra (competitive pricing). The Qwen3-Coder-Flash at 1M context for $0.20/M input is exceptional value.

## Pricing

Via OpenRouter or inference platforms — no single pricing page. See individual model prices above.
