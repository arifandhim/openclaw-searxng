# SearXNG JSON API Reference

## Base URL

```
http://localhost:8888
```

## Endpoints

### Search

```
GET /search
```

Returns search results in the requested format.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `format` | string | No | Output format: `json`, `rss`, `csv`, `html` (default: html) |
| `pageno` | integer | No | Page number, starting from 1 (default: 1) |
| `time_range` | string | No | Time filter: `day`, `week`, `month`, `year` |
| `safesearch` | integer | No | Safe search: `0` (off), `1` (moderate), `2` (strict) |
| `language` | string | No | Language code, e.g., `en-US`, `id-ID`, `auto` |
| `engines` | string | No | Comma-separated list of engines to use |
| `categories` | string | No | Search categories: `general`, `images`, `news`, etc. |

#### Request Headers

| Header | Value | Required |
|--------|-------|----------|
| `Accept` | `application/json` | Recommended |
| `User-Agent` | Any valid UA string | Recommended |
| `X-Forwarded-For` | IP address (e.g., `127.0.0.1`) | **Required for JSON** |

#### Response Format

```json
{
  "query": "search term",
  "number_of_results": 0,
  "results": [...],
  "answers": [],
  "corrections": [],
  "infoboxes": [...],
  "suggestions": [...],
  "unresponsive_engines": []
}
```

### Result Object

```json
{
  "title": "Page Title",
  "url": "https://example.com/page",
  "content": "Snippet or description",
  "publishedDate": "2026-02-05 00:00:00",
  "thumbnail": "https://example.com/image.jpg",
  "engine": "brave",
  "engines": ["google", "brave"],
  "positions": [1, 2],
  "score": 4.0,
  "category": "general",
  "template": "default.html",
  "parsed_url": ["https", "example.com", "/page", "", "", ""],
  "img_src": "",
  "priority": ""
}
```

#### Result Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title |
| `url` | string | Result URL |
| `content` | string | Description/snippet |
| `publishedDate` | string/null | Publication date (ISO format) |
| `thumbnail` | string/null | Thumbnail image URL |
| `engine` | string | Primary engine that returned this result |
| `engines` | array | All engines that returned this result |
| `positions` | array | Position in each engine's results |
| `score` | number | Relevance score (higher = more relevant) |
| `category` | string | Result category |

### Infobox Object

Knowledge panel information (e.g., from Wikipedia).

```json
{
  "infobox": "Title",
  "id": "https://en.wikipedia.org/wiki/Topic",
  "content": "Description...",
  "img_src": "https://example.com/image.jpg",
  "urls": [
    {"title": "Wikipedia", "url": "https://en.wikipedia.org/wiki/Topic"},
    {"title": "Official", "url": "https://official.site", "official": true}
  ],
  "attributes": [
    {"label": "Developer", "value": "Name", "entity": "P178"}
  ],
  "engine": "wikidata"
}
```

## Python Examples

### Basic Search

```python
import urllib.request
import urllib.parse
import json

url = "http://localhost:8888/search?q=openclaw&format=json"
headers = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0",
    "X-Forwarded-For": "127.0.0.1"
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))
    print(data)
```

### Using the Skill Module

```python
from scripts.searxng_search import search_searxng

result = search_searxng("openclaw")
print(result)
```

### With Pagination

```python
from scripts.searxng_search import search_searxng

# Page 2
result = search_searxng("openclaw", page=2)
```

### Time Filter

```python
from scripts.searxng_search import search_searxng

# Results from past month
result = search_searxng("openclaw", time_range="month")
```

### Specific Engines

```python
from scripts.searxng_search import search_searxng

# Use only Google and Brave
result = search_searxng("openclaw", engines="google,brave")
```

### Using requests Library

```python
import requests

url = "http://localhost:8888/search"
params = {
    "q": "openclaw",
    "format": "json",
    "pageno": 1
}
headers = {
    "X-Forwarded-For": "127.0.0.1"
}

response = requests.get(url, params=params, headers=headers)
data = response.json()
```

## Error Handling

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 403 | Forbidden — missing X-Forwarded-For header or JSON not enabled |
| 429 | Rate limited |
| 500 | Server error |

### Python Error Handling

```python
from scripts.searxng_search import search_searxng

try:
    result = search_searxng("openclaw")
except Exception as e:
    print(f"Search failed: {e}")
```

## Available Engines

Common engines available in SearXNG:

- `google` — Google Search
- `brave` — Brave Search
- `duckduckgo` — DuckDuckGo
- `bing` — Bing
- `wikipedia` — Wikipedia
- `wikidata` — Wikidata
- `startpage` — Startpage
- `qwant` — Qwant

Check your SearXNG preferences for the full list of configured engines.

## Rate Limiting

SearXNG may implement rate limiting to prevent abuse. If you receive a 429 status code, wait before retrying.

## Pagination Limits

- Each page typically returns ~10-20 results
- Not all engines support deep pagination
- Some engines may return fewer results on later pages
