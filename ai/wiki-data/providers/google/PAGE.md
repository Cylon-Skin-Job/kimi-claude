# Google

Gemini model family. Has an OpenAI compatibility layer.

## API Endpoints

| Endpoint | URL | Auth |
|----------|-----|------|
| Native API | `https://generativelanguage.googleapis.com/v1beta/` | API key param |
| OpenAI-Compatible | `https://generativelanguage.googleapis.com/v1beta/openai/` | `Authorization: Bearer` |
| Models List | `https://generativelanguage.googleapis.com/v1beta/models` | API key param |

## Coding CLI

**Gemini CLI** — Official, open-source
- Free with a Google account
- Rate-limited (15 RPM Flash, 2 RPM Pro on free tier)
- Multiple Google accounts = multiple free allocations

## Models

| Model | Context | Notes |
|-------|---------|-------|
| gemini-3.1-pro-preview | 1M | Latest |
| gemini-2.5-pro | 1M | Stable |
| gemini-2.5-flash | 1M | Fast/cheap |
| gemini-2.5-flash-lite | 1M | Ultra-cheap |

## Pricing

See [ai.google.dev/pricing](https://ai.google.dev/pricing)

Free tier: 15 RPM Flash, 2 RPM Pro. Multiple Google accounts can multiply this.
