# SearXNG Plugin Tools Guide

Complete guide for all 5 tools in the SearXNG plugin.

## Table of Contents

1. [searxng_search](#searxng_search)
2. [searxng_extract](#searxng_extract)
3. [searxng_crawl](#searxng_crawl)
4. [searxng_map](#searxng_map)
5. [searxng_research](#searxng_research)

---

## searxng_search

Local web search with structured JSON results.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ Yes | - | Search query string |
| `page` | number | ❌ No | 1 | Page number for pagination |
| `time_range` | string | ❌ No | - | Filter: "day", "week", "month", "year" |
| `safe_search` | number | ❌ No | 0 | 0=off, 1=moderate, 2=strict |
| `language` | string | ❌ No | "auto" | Language code: "en-US", "id-ID", etc. |
| `engines` | string | ❌ No | - | Comma-separated: "google,brave,duckduckgo" |
| `base_url` | string | ❌ No | config | SearXNG instance URL |

### Examples

```python
# Basic search
searxng_search("openclaw")

# With pagination
searxng_search("AI trends", page=2)

# Time-filtered
searxng_search("news", time_range="week")

# Specific engines
searxng_search("tutorial", engines="google,brave")

# Full options
searxng_search(
    query="machine learning",
    page=1,
    time_range="month",
    safe_search=0,
    language="en-US",
    engines="google,brave,duckduckgo"
)
```

### Response Format

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
      "title": "OpenClaw",
      "url": "https://openclaw.ai/",
      "snippet": "The AI that actually does things...",
      "engine": "brave",
      "engines": ["google", "brave"],
      "score": 4.0,
      "category": "general",
      "publishedDate": null,
      "thumbnail": "...",
      "siteName": "openclaw.ai"
    }
  ],
  "suggestions": ["openclaw hub", "openclaw ai"],
  "unresponsiveEngines": [["duckduckgo", "timeout"]]
}
```

---

## searxng_extract

Extract clean, readable content from any URL.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | ✅ Yes | - | URL to extract content from |
| `include_images` | boolean | ❌ No | true | Include image URLs in response |
| `include_links` | boolean | ❌ No | true | Include link URLs in response |
| `max_content_length` | number | ❌ No | 10000 | Maximum content length in characters |

### Examples

```python
# Basic extraction
searxng_extract("https://openclaw.ai")

# Without images
searxng_extract("https://example.com/article", include_images=False)

# Limited content
searxng_extract("https://example.com", max_content_length=5000)
```

### Response Format

```json
{
  "url": "https://openclaw.ai",
  "title": "OpenClaw",
  "content": "Full article content...",
  "textContent": "Plain text content...",
  "wordCount": 1250,
  "author": "OpenClaw Team",
  "description": "OpenClaw is a personal AI assistant...",
  "images": ["https://openclaw.ai/logo.png"],
  "links": ["https://openclaw.ai/docs"]
}
```

---

## searxng_crawl

Crawl a website and extract content from discovered pages.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start_url` | string | ✅ Yes | - | Starting URL to crawl from |
| `max_depth` | number | ❌ No | 2 | Maximum crawl depth (1-5) |
| `max_pages` | number | ❌ No | 10 | Maximum pages to crawl (1-50) |
| `same_domain` | boolean | ❌ No | true | Only crawl same domain |
| `delay_ms` | number | ❌ No | 1000 | Delay between requests in ms |
| `extract_content` | boolean | ❌ No | true | Extract page content |

### Examples

```python
# Basic crawl
searxng_crawl("https://openclaw.ai")

# Deep crawl
searxng_crawl("https://example.com", max_depth=3, max_pages=20)

# Fast crawl
searxng_crawl("https://example.com", max_depth=1, max_pages=5, delay_ms=500)
```

### Response Format

```json
{
  "startUrl": "https://openclaw.ai",
  "pagesCrawled": 10,
  "maxDepth": 2,
  "maxPages": 10,
  "sameDomain": true,
  "results": [
    {
      "url": "https://openclaw.ai/",
      "title": "OpenClaw",
      "content": "Page content...",
      "links": ["..."],
      "depth": 0,
      "statusCode": 200
    }
  ]
}
```

---

## searxng_map

Discover and list all URLs from a website.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | ✅ Yes | - | Website URL to map |
| `max_depth` | number | ❌ No | 2 | Maximum crawl depth (1-5) |
| `max_urls` | number | ❌ No | 100 | Maximum URLs to discover (1-500) |
| `same_domain` | boolean | ❌ No | true | Only map same domain |
| `include_sitemap` | boolean | ❌ No | true | Parse sitemap.xml if available |

### Examples

```python
# Basic mapping
searxng_map("https://openclaw.ai")

# Deep mapping
searxng_map("https://example.com", max_depth=3, max_urls=200)

# Sitemap only
searxng_map("https://example.com", include_sitemap=True, max_depth=1)
```

### Response Format

```json
{
  "startUrl": "https://openclaw.ai",
  "domain": "openclaw.ai",
  "urlsFound": 45,
  "fromSitemap": 12,
  "urls": [
    "https://openclaw.ai/",
    "https://openclaw.ai/docs",
    "https://openclaw.ai/download"
  ]
}
```

---

## searxng_research

Multi-step research with automated query expansion.

**Note:** Performs automated multi-query research but does NOT use AI synthesis.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ Yes | - | Research topic or question |
| `depth` | string | ❌ No | "medium" | "quick", "medium", "deep" |
| `max_sources` | number | ❌ No | 5 | Maximum sources to analyze (1-20) |
| `time_range` | string | ❌ No | "month" | "day", "week", "month", "year" |

### Examples

```python
# Quick research
searxng_research("AI trends 2025")

# Medium depth
searxng_research("baby milestones", depth="medium", max_sources=10)

# Deep research
searxng_research(
    "machine learning",
    depth="deep",
    max_sources=15,
    time_range="month"
)
```

### Response Format

```json
{
  "query": "AI trends 2025",
  "depth": "medium",
  "timeRange": "month",
  "sourcesSearched": 3,
  "sourcesFound": 45,
  "sourcesAnalyzed": 5,
  "note": "Human synthesis required",
  "searchResults": [...],
  "extractedContent": [...],
  "subtopicsExplored": [...]
}
```

---

## Comparison with Tavily

| Feature | SearXNG | Tavily |
|---------|---------|--------|
| **Privacy** | ✅ Local | ❌ External |
| **Cost** | ✅ Free | 💰 Paid |
| **AI Synthesis** | ❌ No | ✅ Yes |
| **Search** | ✅ Full | ✅ Full |
| **Extract** | ✅ Basic | ✅ Advanced |
| **Crawl** | ✅ Basic | ✅ Advanced |
| **Map** | ✅ Basic | ✅ Advanced |
| **Research** | ⚠️ Multi-query | ✅ AI-powered |

---

## Configuration

```json
{
  "plugins": {
    "allow": ["openclaw-searxng"],
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

---

## Terminal Usage

```bash
# Via OpenClaw
openclaw agent --message "searxng_search('openclaw')" --json
openclaw agent --message "searxng_extract('https://openclaw.ai')" --json

# Direct HTTP
curl "http://localhost:8888/search?q=openclaw&format=json"
```

---

## Prerequisites

**SearXNG must be running:**

```bash
docker run -d --name searxng -p 8888:8080 \
  -e "BASE_URL=http://localhost:8888/" \
  searxng/searxng
```

Check: `curl http://localhost:8888/healthz`

---

## License

MIT
