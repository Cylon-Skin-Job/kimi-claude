# Mistral

Codestral and Devstral code-focused model families. Has a dedicated code endpoint separate from the main API.

## API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| Main API | `https://api.mistral.ai/v1/chat/completions` | `Authorization: Bearer` |
| **Codestral (Code)** | `https://codestral.mistral.ai/v1/` | Separate API key |
| Models List | `https://api.mistral.ai/v1/models` | `Authorization: Bearer` |

**Note:** Codestral has its own endpoint and API key, separate from the main Mistral API. Free tier available for individual developers.

## Models

### Code-Specific
| Model | Context | Price (input/output per M) |
|-------|---------|---------------------------|
| codestral-2508 | 256K | $0.30 / $0.90 |
| devstral-2512 | 262K | $0.40 / $2.00 |
| devstral-medium | 131K | $0.40 / $2.00 |
| devstral-small | 131K | $0.10 / $0.30 |

Devstral Small is one of the cheapest code-capable models available.

## Pricing

See [mistral.ai/technology](https://mistral.ai/technology)

Codestral free tier: separate API key from codestral.mistral.ai, rate-limited.
