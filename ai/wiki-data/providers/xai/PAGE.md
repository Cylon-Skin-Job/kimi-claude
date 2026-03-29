# xAI

Grok model family. Notable for the **largest context windows** (up to 2M tokens) and a dedicated code model.

## API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| Chat Completions | `https://api.x.ai/v1/chat/completions` | `Authorization: Bearer` |
| Models List | `https://api.x.ai/v1/models` | `Authorization: Bearer` |

## Models

| Model | Context | Notes |
|-------|---------|-------|
| grok-code-fast-1 | 256K | **Dedicated code model** — $0.20/M in, $1.50/M out |
| grok-4.20-beta | 2M | Largest context available anywhere |
| grok-4.1-fast | 2M | Fast variant |
| grok-4 | 256K | Balanced |
| grok-3 / grok-3-mini | 131K | Previous gen |

## Pricing

See [x.ai/api](https://x.ai/api)

$25/mo free API credit for developers. Grok-Code-Fast-1 at $0.20/M input is very competitive for a dedicated code model.
