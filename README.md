# openclaw-searxng

A [SearXNG](https://github.com/searxng/searxng) local search plugin for [OpenClaw](https://github.com/openclaw/openclaw).

Exposes one agent tool:

| Tool | Description |
|------|-------------|
| `searxng_search` | Local web search with structured JSON results, pagination, time filtering, and engine selection |

## Installation

```bash
openclaw plugins install openclaw-searxng
```

Or install from source:

```bash
git clone https://github.com/arifandhim/openclaw-searxng.git ~/.openclaw/extensions/openclaw-searxng
cd ~/.openclaw/extensions/openclaw-searxng
npm install --omit=dev
```

Then restart the gateway.

## Prerequisites

- SearXNG running locally (default: http://localhost:8888)
- JSON API enabled in SearXNG settings

### Setup SearXNG

```bash
# Using Docker
docker run -d --name searxng -p 8888:8080 \
  -e "BASE_URL=http://localhost:8888/" \
  searxng/searxng
```

## Configuration

Either set the environment variable:

```bash
export SEARXNG_URL=http://localhost:8888
```

Or configure it in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-searxng": {
        "enabled": true,
        "config": {
          "baseUrl": "http://localhost:8888",
          "defaultSafeSearch": 0,
          "defaultLanguage": "auto",
          "defaultEngines": "google,brave",
          "timeoutSeconds": 30,
          "cacheTtlMinutes": 15,
          "rateLimit": {
            "maxRequests": 60,
            "windowMs": 60000
          }
        }
      }
    }
  }
}
```

### Config Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `baseUrl` | string | `http://localhost:8888` | SearXNG instance URL |
| `defaultSafeSearch` | 0 \| 1 \| 2 | 0 | Safe search: 0=off, 1=moderate, 2=strict |
| `defaultLanguage` | string | `"auto"` | Language code (e.g., `"en-US"`, `"id-ID"`) |
| `defaultEngines` | string | — | Default engines (comma-separated) |
| `timeoutSeconds` | number | 30 | Request timeout |
| `cacheTtlMinutes` | number | 15 | Cache TTL (0 to disable) |
| `rateLimit.maxRequests` | number | 60 | Max requests per window |
| `rateLimit.windowMs` | number | 60000 | Rate limit window in ms |

## Usage

### Basic Search

```python
searxng_search("openclaw")
```

### With Pagination

```python
searxng_search("machine learning", page=2)
```

### Time Filter

```python
searxng_search("AI news", time_range="week")
```

### Specific Engines

```python
searxng_search("python tutorial", engines="google,brave")
```

### Full Options

```python
searxng_search(
    query="openclaw",
    page=2,
    time_range="month",
    safe_search=0,
    language="en-US",
    engines="google,brave,duckduckgo"
)
```

## Response Format

```json
{
  "query": "openclaw",
  "provider": "searxng",
  "page": 1,
  "numberOfResults": 0,
  "resultCount": 20,
  "tookMs": 1842,
  "baseUrl": "http://localhost:8888",
  "results": [
    {
      "title": "OpenClaw — Personal AI Assistant",
      "url": "https://openclaw.ai/",
      "snippet": "The AI that actually does things...",
      "engine": "brave",
      "engines": ["google", "brave"],
      "score": 4.0,
      "category": "general",
      "siteName": "openclaw.ai"
    }
  ],
  "suggestions": ["openclaw hub", "openclaw ai"],
  "infoboxes": [...],
  "unresponsiveEngines": [["duckduckgo", "timeout"]]
}
```

## Comparison: web_search vs searxng_search

| Feature | web_search | searxng_search |
|---------|-----------|----------------|
| Source | External API (Brave/Tavily) | Your local SearXNG |
| Privacy | Data sent externally | Local only |
| Output | Formatted text/summary | Raw JSON |
| Results | ~5-10 formatted | ~20 with full metadata |
| Metadata | Limited | Score, engine, position, etc. |
| Pagination | Limited | Full support |
| Time filtering | Varies | day/week/month/year |
| Engine selection | No | Yes |
| Use case | Quick answers | Programmatic processing |

## When to Use

**Use `searxng_search` when:**
- You need to process search results programmatically
- You want full metadata (scores, engines, positions)
- You need pagination through many results
- You want to filter by specific search engines
- You need time-based filtering
- You want local, private search (no external API calls)
- You're building a pipeline that consumes search data

**Use `web_search` when:**
- You want a quick summary/answer
- You need external search (not local)
- You want pre-formatted results for display
- Your local SearXNG is not running

## Features

- **Local & Private** — No data sent to external APIs
- **Structured JSON** — Full metadata for programmatic processing
- **Pagination** — Browse through multiple result pages
- **Time Filtering** — day/week/month/year
- **Engine Selection** — Choose specific search engines
- **Rich Metadata** — Scores, positions, engines, thumbnails
- **In-memory cache** — Deduplicates identical queries within TTL
- **Graceful degradation** — Goes idle if SearXNG is unreachable

## Requirements

- OpenClaw 2025+
- SearXNG instance running locally (or accessible)
- JSON API enabled in SearXNG settings

## Links

- npm: [openclaw-searxng](https://www.npmjs.com/package/openclaw-searxng)
- GitHub: [arifandhim/openclaw-searxng](https://github.com/arifandhim/openclaw-searxng)
- SearXNG: [github.com/searxng/searxng](https://github.com/searxng/searxng)
- OpenClaw plugin docs: [docs.openclaw.ai/tools/plugin](https://docs.openclaw.ai/tools/plugin)

## Author

[arifandhim](https://github.com/arifandhim)

## License

MIT
