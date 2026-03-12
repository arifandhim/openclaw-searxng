---
name: searxng
description: Search the web using a local SearXNG instance and retrieve results as JSON. Use when the user needs to perform web searches programmatically, get structured search results, or integrate search functionality into scripts. Supports pagination, time filtering, and multiple output formats (JSON, RSS, CSV).
---

# SearXNG Local Search

Search the web using your locally running SearXNG instance and get structured JSON results.

## Prerequisites

- SearXNG must be running locally (default: http://localhost:8888)
- JSON API must be enabled in SearXNG settings
- Python 3.6+ installed

## Quick Start

### Using the Python Script

```bash
# Basic search
python scripts/searxng_search.py "openclaw"

# With pagination
python scripts/searxng_search.py "openclaw" --page 2

# Filter by time
python scripts/searxng_search.py "openclaw" --time-range month

# Save to file
python scripts/searxng_search.py "openclaw" --output results.json

# Pretty-print JSON
python scripts/searxng_search.py "openclaw" --pretty
```

### Using as a Python Module

```python
import json
from scripts.searxng_search import search_searxng

# Basic search
result = search_searxng("openclaw")
print(json.dumps(result, indent=2))

# With options
result = search_searxng(
    query="openclaw",
    page=2,
    time_range="month",
    engines="google,brave"
)

# Access results
for item in result['results'][:5]:
    print(f"{item['title']}: {item['url']}")
```

## Search Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `q` | Search query (required) | `openclaw` |
| `format` | Output format: `json`, `rss`, `csv`, `html` | `json` |
| `pageno` | Page number for pagination | `1`, `2`, `3` |
| `time_range` | Time filter: `day`, `week`, `month`, `year` | `month` |
| `safesearch` | Safe search: `0` (off), `1` (moderate), `2` (strict) | `0` |
| `language` | Language code | `en-US`, `id-ID` |
| `engines` | Specific engines (comma-separated) | `google,brave,duckduckgo` |

## Response Structure

```json
{
  "query": "search term",
  "number_of_results": 0,
  "results": [
    {
      "title": "Result Title",
      "url": "https://example.com",
      "content": "Snippet/description",
      "engine": "brave",
      "score": 4.0,
      "category": "general"
    }
  ],
  "infoboxes": [...],
  "suggestions": [...],
  "unresponsive_engines": [...]
}
```

### Key Result Fields

- `title` — Result title
- `url` — Result URL
- `content` — Description/snippet
- `engine` — Which search engine provided the result
- `score` — Relevance score (higher = more relevant)
- `thumbnail` — Image URL (if available)
- `publishedDate` — Publication date (if available)

## Advanced Usage

### Parse Specific Fields

```python
import json
from scripts.searxng_search import search_searxng

result = search_searxng("openclaw")

# Get top 5 titles and URLs
for item in result['results'][:5]:
    print(f"{item['title']}: {item['url']}")
```

### Filter by Engine

```python
wiki_results = [r for r in result['results'] if r['engine'] == 'wikipedia']
```

### Get Suggestions

```python
print(result['suggestions'])
```

### Multi-Page Search

```python
all_results = []
for page in range(1, 4):
    result = search_searxng("machine learning", page=page)
    all_results.extend(result['results'])
```

## Troubleshooting

**403 Forbidden Error**
- Ensure `X-Forwarded-For` header is included (script handles this)
- Check that JSON format is enabled in SearXNG settings

**No Results**
- Try different search terms
- Check that search engines are responding (see `unresponsive_engines`)

**Timeout**
- Some engines may timeout; results from responsive engines are still returned

## Reference

For complete API documentation, see [references/api-reference.md](references/api-reference.md)
