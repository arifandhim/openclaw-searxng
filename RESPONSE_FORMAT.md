# SearXNG Plugin Response Format

## Default Response Structure

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
      "publishedDate": null,
      "thumbnail": null,
      "siteName": "openclaw.ai"
    }
  ],
  "suggestions": ["openclaw hub", "openclaw ai"],
  "infoboxes": [...],
  "unresponsiveEngines": [["duckduckgo", "timeout"]]
}
```

## Response Fields

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | The search query that was executed |
| `provider` | string | Always "searxng" |
| `page` | number | Current page number |
| `numberOfResults` | number | Total number of results available |
| `resultCount` | number | Number of results in this response |
| `tookMs` | number | Time taken for the request in milliseconds |
| `baseUrl` | string | SearXNG instance URL used |
| `results` | array | Array of search result objects |
| `suggestions` | array | Optional search suggestions |
| `infoboxes` | array | Optional infoboxes (knowledge panels) |
| `unresponsiveEngines` | array | Optional list of engines that failed |

### Result Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Page title |
| `url` | string | Page URL |
| `snippet` | string | Content/description snippet |
| `engine` | string | Primary engine that returned this result |
| `engines` | array | All engines that returned this result |
| `score` | number | Relevance score |
| `category` | string | Result category |
| `publishedDate` | string/null | Publication date if available |
| `thumbnail` | string/null | Thumbnail URL if available |
| `siteName` | string | Extracted domain name |

## Error Response

```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Try again in 30 seconds.",
  "retryAfter": 30
}
```

Or:

```json
{
  "error": "searxng_fetch_error",
  "message": "fetch failed",
  "hint": "Ensure SearXNG is running at http://localhost:8888"
}
```

## Configuration Options

Add to `~/.openclaw/openclaw.json`:

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

## Making Response Format Configurable

To make the response format configurable, you would need to add options like:

```json
{
  "responseFormat": {
    "includeMetadata": true,      // Include tookMs, baseUrl, etc.
    "includeSuggestions": true,   // Include search suggestions
    "includeInfoboxes": true,     // Include infoboxes
    "includeUnresponsive": true,  // Include unresponsive engines
    "maxResults": 20,             // Limit number of results
    "fields": ["title", "url", "snippet"]  // Only include specific fields
  }
}
```

This would require modifying the plugin code to conditionally include fields based on configuration.
