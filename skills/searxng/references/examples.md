# SearXNG Skill Usage Examples

## Example 1: Basic Search

```bash
# From the skill directory
python scripts/searxng_search.py "openclaw"
```

```python
# As a module
from scripts.searxng_search import search_searxng
import json

result = search_searxng("openclaw")
print(json.dumps(result, indent=2))
```

## Example 2: Extract URLs Only

```python
from scripts.searxng_search import search_searxng

result = search_searxng("python tutorial")
for item in result['results']:
    print(item['url'])
```

## Example 3: Filter by Date

```bash
python scripts/searxng_search.py "AI news" --time-range week
```

```python
from scripts.searxng_search import search_searxng

result = search_searxng("AI news", time_range="week")
dated_results = [r for r in result['results'] if r.get('publishedDate')]
for item in dated_results:
    print(f"{item['title']} ({item['publishedDate']})")
```

## Example 4: Multi-Page Search

```python
from scripts.searxng_search import search_searxng

all_results = []
for page in range(1, 4):
    result = search_searxng("machine learning", page=page)
    all_results.extend(result['results'])

print(f"Total results: {len(all_results)}")
```

## Example 5: Save and Process Later

```bash
# Save to file
python scripts/searxng_search.py "docker tutorial" --output docker-results.json
```

```python
# Process later
import json

with open('docker-results.json', 'r') as f:
    data = json.load(f)

for item in data['results']:
    print(f"{item['title']}: {item['score']}")
```

## Example 6: Search with Specific Engine

```bash
python scripts/searxng_search.py "quantum computing" --engines wikipedia
```

```python
from scripts.searxng_search import search_searxng

result = search_searxng("quantum computing", engines="wikipedia")
print(result['results'])
```

## Example 7: Get Knowledge Panel

```python
from scripts.searxng_search import search_searxng

result = search_searxng("openclaw")

# Display infobox (knowledge panel)
if result['infoboxes']:
    infobox = result['infoboxes'][0]
    print(infobox['content'])
    for url in infobox['urls']:
        print(f"  - {url['title']}: {url['url']}")
```

## Example 8: Check Suggestions

```python
from scripts.searxng_search import search_searxng

result = search_searxng("openclaw")
print("Related searches:")
for suggestion in result['suggestions']:
    print(f"  - {suggestion}")
```

## Example 9: Filter by Score

```python
from scripts.searxng_search import search_searxng

result = search_searxng("openclaw")
high_score = [r for r in result['results'] if r['score'] > 1.0]
print(f"High relevance results: {len(high_score)}")
```

## Example 10: Pretty Print Output

```bash
python scripts/searxng_search.py "openclaw" --pretty
```
