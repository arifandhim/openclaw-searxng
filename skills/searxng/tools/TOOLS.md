# SearXNG Tool for OpenClaw

## Overview

This tool provides OpenClaw with access to your local SearXNG search instance, returning structured JSON results instead of formatted text.

## Installation

1. Ensure SearXNG is running locally (default: http://localhost:8888)
2. Copy `tools/searxng_tool.py` to your OpenClaw tools directory
3. Register the tool in your OpenClaw configuration

## Tool Definition

```json
{
  "name": "searxng_search",
  "description": "Search the web using local SearXNG instance and return structured JSON results. Use when you need programmatic access to search results with full metadata including URLs, scores, engines, and suggestions. Returns raw JSON that you can parse and process.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query string"
      },
      "page": {
        "type": "integer",
        "description": "Page number for pagination",
        "default": 1
      },
      "time_range": {
        "type": "string",
        "enum": ["day", "week", "month", "year"],
        "description": "Filter results by time period"
      },
      "safe_search": {
        "type": "integer",
        "enum": [0, 1, 2],
        "description": "Safe search level: 0=off, 1=moderate, 2=strict",
        "default": 0
      },
      "language": {
        "type": "string",
        "description": "Language code (e.g., 'en-US', 'id-ID', 'auto')",
        "default": "auto"
      },
      "engines": {
        "type": "string",
        "description": "Comma-separated list of search engines to use"
      },
      "base_url": {
        "type": "string",
        "description": "SearXNG instance URL",
        "default": "http://localhost:8888"
      }
    },
    "required": ["query"]
  }
}
```

## Comparison: web_search vs searxng_search

| Feature | web_search | searxng_search |
|---------|-----------|----------------|
| Source | External API (Brave/Tavily) | Your local SearXNG |
| Output | Formatted text/summary | Raw JSON |
| Results | ~5-10 formatted results | ~20 raw results with metadata |
| Metadata | Limited | Full (score, engine, position) |
| Pagination | Limited | Full pagination support |
| Time filtering | Varies | day/week/month/year |
| Engine selection | No | Yes (google, brave, etc.) |
| Use case | Quick answers | Programmatic processing |

## When to Use

**Use `searxng_search` when:**
- You need to process search results programmatically
- You want full metadata (scores, engines, positions)
- You need pagination through many results
- You want to filter by specific search engines
- You need time-based filtering
- You're building a pipeline that consumes search data

**Use `web_search` when:**
- You want a quick summary/answer
- You need external search (not local)
- You want pre-formatted results for display

## Response Format

```json
{
  "query": "openclaw",
  "number_of_results": 0,
  "results": [
    {
      "title": "OpenClaw — Personal AI Assistant",
      "url": "https://openclaw.ai/",
      "content": "The AI that actually does things...",
      "engine": "brave",
      "engines": ["google", "brave"],
      "positions": [1, 1],
      "score": 4.0,
      "category": "general",
      "publishedDate": null,
      "thumbnail": null
    }
  ],
  "infoboxes": [
    {
      "infobox": "OpenClaw",
      "content": "OpenClaw is a free and open-source...",
      "urls": [...],
      "attributes": [...]
    }
  ],
  "suggestions": ["OpenClaw hub", "openclaw ai", ...],
  "unresponsive_engines": [["duckduckgo", "timeout"]]
}
```

## Example Usage

### Basic Search

```python
# Tool call
{
  "query": "openclaw"
}

# Returns JSON with ~20 results
```

### With Pagination

```python
# Tool call
{
  "query": "machine learning",
  "page": 2
}
```

### Time Filter

```python
# Tool call
{
  "query": "AI news",
  "time_range": "week"
}
```

### Specific Engines

```python
# Tool call
{
  "query": "python tutorial",
  "engines": "google,brave"
}
```

## Processing Results

After getting JSON results, you can:

```python
import json

# Parse the JSON response
results = json.loads(response)

# Extract top 5 URLs
urls = [r['url'] for r in results['results'][:5]]

# Filter by score
high_quality = [r for r in results['results'] if r['score'] > 1.0]

# Get suggestions
related = results['suggestions']

# Check which engines responded
working_engines = set(r['engine'] for r in results['results'])
```

## Prerequisites

- SearXNG running locally on port 8888 (or configure `base_url`)
- JSON API enabled in SearXNG settings
- Python 3.6+

## Troubleshooting

**Error: "Connection failed"**
- Check if SearXNG is running: `docker ps | grep searxng`
- Verify the base_url is correct

**Error: "HTTP 403"**
- JSON API might not be enabled in SearXNG settings
- Check SearXNG configuration

**Empty results**
- Try different search terms
- Check `unresponsive_engines` in response
