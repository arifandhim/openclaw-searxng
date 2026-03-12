#!/usr/bin/env python3
"""
SearXNG Local Search Script

Search the web using a local SearXNG instance and retrieve results as JSON.

Usage:
    python searxng_search.py "openclaw"
    python searxng_search.py "openclaw" --page 2
    python searxng_search.py "openclaw" --time-range month --output results.json
"""

import argparse
import json
import sys
import urllib.parse
import urllib.request
from typing import Optional


def search_searxng(
    query: str,
    page: int = 1,
    time_range: Optional[str] = None,
    safe_search: int = 0,
    language: str = "auto",
    engines: Optional[str] = None,
    base_url: str = "http://localhost:8888"
) -> dict:
    """
    Perform a search using local SearXNG instance.
    
    Args:
        query: Search query string
        page: Page number (default: 1)
        time_range: Time filter - day, week, month, year
        safe_search: Safe search level - 0 (off), 1 (moderate), 2 (strict)
        language: Language code (default: auto)
        engines: Comma-separated list of engines
        base_url: SearXNG base URL
    
    Returns:
        Parsed JSON response as dictionary
    
    Raises:
        Exception: If the request fails
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
            return json.loads(data)
    except urllib.error.HTTPError as e:
        raise Exception(f"HTTP Error {e.code}: {e.reason}") from e
    except urllib.error.URLError as e:
        raise Exception(f"URL Error: {e.reason}") from e
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse JSON response: {e}") from e


def main():
    parser = argparse.ArgumentParser(
        description='Search using local SearXNG instance',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "openclaw"
  %(prog)s "openclaw" --page 2
  %(prog)s "openclaw" --time-range month
  %(prog)s "openclaw" --output results.json
  %(prog)s "openclaw" --engines google,brave
        """
    )
    
    parser.add_argument('query', help='Search query')
    parser.add_argument('--page', '-p', type=int, default=1,
                        help='Page number (default: 1)')
    parser.add_argument('--time-range', '-t', choices=['day', 'week', 'month', 'year'],
                        help='Filter by time range')
    parser.add_argument('--safe-search', '-s', type=int, choices=[0, 1, 2], default=0,
                        help='Safe search: 0=off, 1=moderate, 2=strict (default: 0)')
    parser.add_argument('--language', '-l', default='auto',
                        help='Language code (default: auto)')
    parser.add_argument('--engines', '-e',
                        help='Comma-separated list of engines (e.g., google,brave)')
    parser.add_argument('--output', '-o',
                        help='Output file path (default: stdout)')
    parser.add_argument('--base-url', '-b', default='http://localhost:8888',
                        help='SearXNG base URL (default: http://localhost:8888)')
    parser.add_argument('--pretty', action='store_true',
                        help='Pretty-print JSON output')
    
    args = parser.parse_args()
    
    try:
        # Perform search
        result = search_searxng(
            query=args.query,
            page=args.page,
            time_range=args.time_range,
            safe_search=args.safe_search,
            language=args.language,
            engines=args.engines,
            base_url=args.base_url
        )
        
        # Format JSON output
        indent = 2 if args.pretty else None
        json_output = json.dumps(result, indent=indent, ensure_ascii=False)
        
        # Output to file or stdout
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(json_output)
            print(f"Results saved to: {args.output}", file=sys.stderr)
        else:
            # Handle Unicode output properly on Windows
            if sys.platform == 'win32':
                import io
                sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
            print(json_output)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
