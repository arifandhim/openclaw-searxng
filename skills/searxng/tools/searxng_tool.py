from typing import Optional
import json
import urllib.request
import urllib.parse
import urllib.error

def searxng_search(
    query: str,
    page: int = 1,
    time_range: Optional[str] = None,
    safe_search: int = 0,
    language: str = "auto",
    engines: Optional[str] = None,
    base_url: str = "http://localhost:8888"
) -> str:
    """
    Search the web using local SearXNG instance and return JSON results.
    
    This tool queries your locally running SearXNG search engine and returns
    structured JSON with search results, suggestions, and metadata.
    
    Args:
        query: The search query string (required)
        page: Page number for pagination (default: 1)
        time_range: Filter by time - "day", "week", "month", or "year"
        safe_search: Safe search level - 0 (off), 1 (moderate), 2 (strict)
        language: Language code like "en-US", "id-ID", or "auto"
        engines: Comma-separated list of engines (e.g., "google,brave")
        base_url: SearXNG instance URL (default: http://localhost:8888)
    
    Returns:
        JSON string containing search results with this structure:
        {
            "query": "search term",
            "results": [
                {
                    "title": "Result Title",
                    "url": "https://example.com",
                    "content": "Description...",
                    "engine": "brave",
                    "score": 4.0
                }
            ],
            "suggestions": [...],
            "infoboxes": [...]
        }
    
    Example:
        searxng_search("openclaw")
        searxng_search("AI news", time_range="week", page=2)
        searxng_search("python tutorial", engines="google,brave")
    """
    # Build query parameters
    params = {
        'q': query,
        'format': 'json',
        'pageno': page,
        'safesearch': safe_search,
        'language': language
    }
    
    if time_range:
        params['time_range'] = time_range
    
    if engines:
        params['engines'] = engines
    
    # Encode parameters
    query_string = urllib.parse.urlencode(params)
    url = f"{base_url}/search?{query_string}"
    
    # Prepare headers (X-Forwarded-For is required for JSON API)
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'X-Forwarded-For': '127.0.0.1'
    }
    
    # Make request
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as response:
            data = response.read().decode('utf-8')
            return data  # Already JSON string
    except urllib.error.HTTPError as e:
        return json.dumps({"error": f"HTTP {e.code}: {e.reason}"})
    except urllib.error.URLError as e:
        return json.dumps({"error": f"Connection failed: {e.reason}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# Tool definition for OpenClaw
TOOL_DEFINITION = {
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
                "description": "Comma-separated list of search engines to use (e.g., 'google,brave,duckduckgo')"
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
