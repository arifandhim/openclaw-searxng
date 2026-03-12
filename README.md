# openclaw-searxng

A [SearXNG](https://github.com/searxng/searxng) local search plugin for [OpenClaw](https://github.com/openclaw/openclaw).

Exposes **5 agent tools** for comprehensive web research:

| Tool | Description | Tavily Equivalent |
|------|-------------|-------------------|
| `searxng_search` | Local web search with structured JSON results | `tavily_search` |
| `searxng_extract` | Extract clean content from URLs | `tavily_extract` |
| `searxng_crawl` | Crawl websites and extract page content | `tavily_crawl` |
| `searxng_map` | Discover and list URLs from websites | `tavily_map` |
| `searxng_research` | Multi-step research with query expansion | `tavily_research` |

---

## Installation

### Install from Source (Recommended)

This plugin is designed to be installed directly from the GitHub repository:

```bash
# Clone to OpenClaw extensions directory
git clone https://github.com/arifandhim/openclaw-searxng.git ~/.openclaw/extensions/openclaw-searxng

# Install dependencies
cd ~/.openclaw/extensions/openclaw-searxng
npm install --omit=dev

# Restart OpenClaw gateway
openclaw gateway restart
```

### Configure OpenClaw

Add to your `~/.openclaw/openclaw.json`:

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
          "defaultEngines": "google,brave,duckduckgo",
          "timeoutSeconds": 30,
          "cacheTtlMinutes": 15,
          "rateLimit": {
            "maxRequests": 60,
            "windowMs": 60000
          },
          "responseFormat": {
            "includeMetadata": true,
            "includeSuggestions": true,
            "includeInfoboxes": true,
            "includeUnresponsive": true,
            "maxResults": 0,
            "fields": []
          }
        }
      }
    }
  }
}
```

Then restart the gateway:

```bash
openclaw gateway restart
```

---

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

Check if running:
```bash
curl http://localhost:8888/healthz
# Should return: OK
```

---

## Tools Reference

### 1. searxng_search

Local web search with structured JSON results.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ Yes | - | Search query string |
| `page` | number | ❌ No | 1 | Page number for pagination |
| `time_range` | string | ❌ No | - | Filter: "day", "week", "month", "year" |
| `safe_search` | number | ❌ No | 0 | 0=off, 1=moderate, 2=strict |
| `language` | string | ❌ No | "auto" | Language code: "en-US", "id-ID", etc. |
| `engines` | string | ❌ No | - | Comma-separated: "google,brave,duckduckgo" |
| `base_url` | string | ❌ No | config | SearXNG instance URL |

**Examples:**

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

**Response:**

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
      "thumbnail": "...",
      "siteName": "openclaw.ai"
    }
  ],
  "suggestions": ["openclaw hub", "openclaw ai"],
  "infoboxes": [...],
  "unresponsiveEngines": [["duckduckgo", "timeout"]]
}
```

---

### 2. searxng_extract

Extract clean, readable content from any URL.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | ✅ Yes | - | URL to extract content from |
| `include_images` | boolean | ❌ No | true | Include image URLs |
| `include_links` | boolean | ❌ No | true | Include link URLs |
| `max_content_length` | number | ❌ No | 10000 | Max content length in characters |

**Examples:**

```python
# Basic extraction
searxng_extract("https://openclaw.ai")

# Without images
searxng_extract("https://example.com/article", include_images=False)

# Limited content
searxng_extract("https://example.com", max_content_length=5000)
```

**Response:**

```json
{
  "url": "https://openclaw.ai",
  "title": "OpenClaw — Personal AI Assistant",
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

### 3. searxng_crawl

Crawl a website and extract content from discovered pages.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start_url` | string | ✅ Yes | - | Starting URL to crawl from |
| `max_depth` | number | ❌ No | 2 | Maximum crawl depth (1-5) |
| `max_pages` | number | ❌ No | 10 | Maximum pages to crawl (1-50) |
| `same_domain` | boolean | ❌ No | true | Only crawl same domain |
| `delay_ms` | number | ❌ No | 1000 | Delay between requests in ms |
| `extract_content` | boolean | ❌ No | true | Extract page content |

**Examples:**

```python
# Basic crawl
searxng_crawl("https://openclaw.ai")

# Deep crawl
searxng_crawl("https://example.com", max_depth=3, max_pages=20)

# Fast crawl (shallow)
searxng_crawl("https://example.com", max_depth=1, max_pages=5, delay_ms=500)

# Cross-domain crawl
searxng_crawl("https://example.com", same_domain=False)
```

**Response:**

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
      "links": ["https://openclaw.ai/docs"],
      "depth": 0,
      "statusCode": 200
    }
  ]
}
```

---

### 4. searxng_map

Discover and list URLs from a website.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | ✅ Yes | - | Website URL to map |
| `max_depth` | number | ❌ No | 2 | Maximum crawl depth (1-5) |
| `max_urls` | number | ❌ No | 100 | Maximum URLs to discover (1-500) |
| `same_domain` | boolean | ❌ No | true | Only map same domain |
| `include_sitemap` | boolean | ❌ No | true | Parse sitemap.xml if available |

**Examples:**

```python
# Basic mapping
searxng_map("https://openclaw.ai")

# Deep mapping
searxng_map("https://example.com", max_depth=3, max_urls=200)

# Sitemap only
searxng_map("https://example.com", include_sitemap=True, max_depth=1)

# Cross-domain
searxng_map("https://example.com", same_domain=False, max_urls=500)
```

**Response:**

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

### 5. searxng_research

Multi-step research with automated query expansion and content extraction.

**Note:** This performs automated multi-query research but does NOT use AI synthesis. Human analysis of results is required for final synthesis.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ Yes | - | Research topic or question |
| `depth` | string | ❌ No | "medium" | "quick", "medium", "deep" |
| `max_sources` | number | ❌ No | 5 | Maximum sources to analyze (1-20) |
| `time_range` | string | ❌ No | "month" | "day", "week", "month", "year" |

**Examples:**

```python
# Quick research
searxng_research("AI trends 2025")

# Medium depth
searxng_research("baby milestones", depth="medium", max_sources=10)

# Deep research
searxng_research(
    "machine learning applications",
    depth="deep",
    max_sources=15,
    time_range="month"
)

# Recent information only
searxng_research("tech news", depth="quick", time_range="week")
```

**Response:**

```json
{
  "query": "AI trends 2025",
  "depth": "medium",
  "timeRange": "month",
  "sourcesSearched": 3,
  "sourcesFound": 45,
  "sourcesAnalyzed": 5,
  "note": "This is automated multi-query research. Human synthesis of findings is required for final analysis.",
  "searchResults": [
    {
      "title": "Top AI Trends for 2025",
      "url": "https://example.com/ai-trends",
      "snippet": "AI is evolving rapidly...",
      "score": 4.5
    }
  ],
  "extractedContent": [
    {
      "url": "https://example.com/ai-trends",
      "title": "Top AI Trends for 2025",
      "content": "Full extracted content...",
      "wordCount": 2500
    }
  ],
  "subtopicsExplored": [
    "AI trends 2025 machine learning",
    "AI trends 2025 applications"
  ],
  "recommendations": {
    "nextSteps": [
      "Review extracted content for key themes",
      "Identify conflicting information across sources",
      "Synthesize findings into coherent narrative",
      "Verify claims against primary sources"
    ]
  }
}
```

---

## Configuration Options

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
| `responseFormat.includeMetadata` | boolean | true | Include tookMs, baseUrl, etc. |
| `responseFormat.includeSuggestions` | boolean | true | Include search suggestions |
| `responseFormat.includeInfoboxes` | boolean | true | Include knowledge panels |
| `responseFormat.includeUnresponsive` | boolean | true | Include failed engines list |
| `responseFormat.maxResults` | number | 0 | Limit results (0 = unlimited) |
| `responseFormat.fields` | array | [] | Specific fields to include |

---

## Terminal Usage

### Via OpenClaw Agent

```bash
# Search
openclaw agent --message "searxng_search('openclaw features')" --json

# Extract
openclaw agent --message "searxng_extract('https://openclaw.ai')" --json

# Crawl
openclaw agent --message "searxng_crawl('https://openclaw.ai', max_pages=5)" --json

# Map
openclaw agent --message "searxng_map('https://openclaw.ai')" --json

# Research
openclaw agent --message "searxng_research('AI trends', depth='medium')" --json
```

### Direct HTTP API

```bash
# Check SearXNG health
curl http://localhost:8888/healthz

# Search
curl "http://localhost:8888/search?q=openclaw&format=json"

# With filters
curl "http://localhost:8888/search?q=ai&format=json&time_range=month&engines=google,brave"
```

---

## Comparison: SearXNG vs Tavily

| Feature | SearXNG | Tavily |
|---------|---------|--------|
| **Privacy** | ✅ Local | ❌ External API |
| **Cost** | ✅ Free | 💰 API pricing |
| **Speed** | ⚡ Local network | 🌐 Internet dependent |
| **AI Synthesis** | ❌ No | ✅ Yes |
| **Search** | ✅ Full | ✅ Full |
| **Extract** | ✅ Basic | ✅ Advanced |
| **Crawl** | ✅ Basic | ✅ Advanced |
| **Map** | ✅ Basic | ✅ Advanced |
| **Research** | ⚠️ Multi-query | ✅ AI-powered |

---

## When to Use

**Use SearXNG when:**
- ✅ Privacy is critical (local only)
- ✅ Cost matters (no API fees)
- ✅ You need structured JSON data
- ✅ You want full control over results
- ✅ Building data pipelines
- ✅ Quick local searches

**Use Tavily when:**
- ✅ You need AI-generated summaries
- ✅ Comprehensive research reports
- ✅ JavaScript-heavy sites
- ✅ Professional research deliverables
- ✅ Time-sensitive projects

**Hybrid Approach (Recommended):**
- **SearXNG** for quick, private, local searches
- **Tavily** for AI-powered synthesis and deep research

---

## Troubleshooting

### "Connection refused" or "fetch failed"
- **Cause:** SearXNG not running
- **Fix:** Start SearXNG with Docker: `docker start searxng`

### "Rate limit exceeded"
- **Cause:** Too many requests
- **Fix:** Wait 60 seconds or adjust `rateLimit` config

### "Plugin not found"
- **Cause:** Plugin not loaded
- **Fix:** Check `openclaw plugins list` and restart gateway

### Empty results
- **Cause:** No search engines responding
- **Fix:** Check SearXNG settings and engine availability

---

## Requirements

- OpenClaw 2025+
- SearXNG instance running locally (or accessible)
- JSON API enabled in SearXNG settings

---

## Links

- GitHub: [arifandhim/openclaw-searxng](https://github.com/arifandhim/openclaw-searxng)
- SearXNG: [github.com/searxng/searxng](https://github.com/searxng/searxng)
- OpenClaw: [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
- OpenClaw plugin docs: [docs.openclaw.ai/tools/plugin](https://docs.openclaw.ai/tools/plugin)

---

## Author

[arifandhim](https://github.com/arifandhim)

---

## License

MIT

---

**Note:** This plugin is distributed via GitHub source only. Install by cloning the repository to your OpenClaw extensions directory.
