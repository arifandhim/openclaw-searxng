/**
 * openclaw-searxng — SearXNG local search plugin for OpenClaw
 *
 * Exposes tools:
 *   - `searxng_search`    — local web search with structured JSON results
 *   - `searxng_extract`   — extract clean content from URLs
 *   - `searxng_crawl`     — crawl a website and extract page content
 *   - `searxng_map`       — discover and list URLs from a website
 *   - `searxng_research`  — multi-step research with synthesis
 *
 * Config (openclaw.json → plugins.entries.openclaw-searxng.config):
 *   baseUrl           - SearXNG instance URL (or set SEARXNG_URL env var)
 *   defaultSafeSearch - 0 | 1 | 2 (default: 0)
 *   defaultLanguage   - language code (default: "auto")
 *   defaultEngines    - comma-separated engine list (default: undefined)
 *   timeoutSeconds    - number (default: 30)
 *   cacheTtlMinutes   - number (default: 15)
 *   rateLimit         - { maxRequests, windowMs }
 *   responseFormat    - { includeMetadata, includeSuggestions, ... }
 */

import { Type } from "@sinclair/typebox";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PluginApi = {
  pluginConfig?: Record<string, unknown>;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  registerTool: (tool: unknown, opts?: unknown) => void;
  registerService: (svc: unknown) => void;
};

type SearXNGResult = {
  title: string;
  url: string;
  content: string;
  engine: string;
  engines?: string[];
  positions?: number[];
  score: number;
  category?: string;
  publishedDate?: string | null;
  thumbnail?: string | null;
};

type SearXNGResponse = {
  query: string;
  number_of_results: number;
  results: SearXNGResult[];
  infoboxes?: Array<{
    infobox: string;
    content: string;
    urls?: unknown[];
    attributes?: unknown[];
  }>;
  suggestions?: string[];
  unresponsive_engines?: Array<[string, string]>;
};

type CacheEntry = {
  value: Record<string, unknown>;
  expiresAt: number;
};

type CrawlResult = {
  url: string;
  title: string;
  content: string;
  links: string[];
  depth: number;
  statusCode?: number;
  error?: string;
};

type ExtractResult = {
  url: string;
  title: string;
  content: string;
  textContent: string;
  wordCount: number;
  author?: string;
  publishedDate?: string;
  description?: string;
  keywords?: string[];
  images: string[];
  links: string[];
  error?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "http://localhost:8888";
const DEFAULT_SAFE_SEARCH = 0;
const DEFAULT_LANGUAGE = "auto";
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_CACHE_TTL_MINUTES = 15;
const DEFAULT_RATE_LIMIT_MAX = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;
const MAX_CACHE_ENTRIES = 100;
const DEFAULT_CRAWL_DELAY_MS = 1000;
const DEFAULT_MAX_CRAWL_DEPTH = 2;
const DEFAULT_MAX_CRAWL_PAGES = 10;

// ---------------------------------------------------------------------------
// Cache (in-memory)
// ---------------------------------------------------------------------------

const SEARCH_CACHE = new Map<string, CacheEntry>();
const EXTRACT_CACHE = new Map<string, CacheEntry>();
const CRAWL_CACHE = new Map<string, CacheEntry>();

function readCache(cache: Map<string, CacheEntry>, key: string): Record<string, unknown> | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(cache: Map<string, CacheEntry>, key: string, value: Record<string, unknown>, ttlMs: number): void {
  if (ttlMs <= 0) return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_MAP = new Map<string, RateLimitEntry>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(key);
  
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT_MAP.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  
  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  
  entry.count++;
  return { allowed: true };
}

function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of RATE_LIMIT_MAP.entries()) {
    if (now > entry.resetAt) {
      RATE_LIMIT_MAP.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveBaseUrl(cfg: Record<string, unknown>): string {
  const fromConfig = typeof cfg.baseUrl === "string" ? cfg.baseUrl.trim() : "";
  const fromEnv = (process.env.SEARXNG_URL ?? "").trim();
  return fromConfig || fromEnv || DEFAULT_BASE_URL;
}

function resolveSafeSearch(cfg: Record<string, unknown>): number {
  const v = typeof cfg.defaultSafeSearch === "number" ? cfg.defaultSafeSearch : DEFAULT_SAFE_SEARCH;
  return Math.max(0, Math.min(2, Math.floor(v)));
}

function resolveLanguage(cfg: Record<string, unknown>): string {
  const v = typeof cfg.defaultLanguage === "string" ? cfg.defaultLanguage.trim() : "";
  return v || DEFAULT_LANGUAGE;
}

function resolveEngines(cfg: Record<string, unknown>): string | undefined {
  const v = typeof cfg.defaultEngines === "string" ? cfg.defaultEngines.trim() : "";
  return v || undefined;
}

function resolveTimeout(cfg: Record<string, unknown>): number {
  const v = typeof cfg.timeoutSeconds === "number" ? cfg.timeoutSeconds : DEFAULT_TIMEOUT_SECONDS;
  return Math.max(1, Math.floor(v));
}

function resolveCacheTtlMs(cfg: Record<string, unknown>): number {
  const minutes = typeof cfg.cacheTtlMinutes === "number" ? Math.max(0, cfg.cacheTtlMinutes) : DEFAULT_CACHE_TTL_MINUTES;
  return Math.round(minutes * 60_000);
}

function resolveRateLimit(cfg: Record<string, unknown>): { maxRequests: number; windowMs: number } {
  const rateLimitCfg = typeof cfg.rateLimit === "object" && cfg.rateLimit !== null ? cfg.rateLimit as Record<string, unknown> : {};
  const maxRequests = typeof rateLimitCfg.maxRequests === "number" ? Math.max(1, Math.floor(rateLimitCfg.maxRequests)) : DEFAULT_RATE_LIMIT_MAX;
  const windowMs = typeof rateLimitCfg.windowMs === "number" ? Math.max(1000, Math.floor(rateLimitCfg.windowMs)) : DEFAULT_RATE_LIMIT_WINDOW_MS;
  return { maxRequests, windowMs };
}

function resolveResponseFormat(cfg: Record<string, unknown>): {
  includeMetadata: boolean;
  includeSuggestions: boolean;
  includeInfoboxes: boolean;
  includeUnresponsive: boolean;
  maxResults: number;
  fields: string[];
} {
  const fmtCfg = typeof cfg.responseFormat === "object" && cfg.responseFormat !== null ? cfg.responseFormat as Record<string, unknown> : {};
  return {
    includeMetadata: typeof fmtCfg.includeMetadata === "boolean" ? fmtCfg.includeMetadata : true,
    includeSuggestions: typeof fmtCfg.includeSuggestions === "boolean" ? fmtCfg.includeSuggestions : true,
    includeInfoboxes: typeof fmtCfg.includeInfoboxes === "boolean" ? fmtCfg.includeInfoboxes : true,
    includeUnresponsive: typeof fmtCfg.includeUnresponsive === "boolean" ? fmtCfg.includeUnresponsive : true,
    maxResults: typeof fmtCfg.maxResults === "number" ? Math.max(0, Math.floor(fmtCfg.maxResults)) : 0,
    fields: Array.isArray(fmtCfg.fields) ? fmtCfg.fields.filter((f): f is string => typeof f === "string") : [],
  };
}

function filterResultFields(result: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  if (fields.length === 0) return result;
  const filtered: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in result) {
      filtered[field] = result[field];
    }
  }
  return filtered;
}

function siteName(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// HTML Content Extraction (Simple implementation)
// ---------------------------------------------------------------------------

function extractFromHTML(html: string, url: string): ExtractResult {
  // Simple regex-based extraction (in production, use a proper HTML parser)
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const description = metaDescMatch ? metaDescMatch[1] : '';
  
  const metaAuthorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*)["']/i);
  const author = metaAuthorMatch ? metaAuthorMatch[1] : '';
  
  // Remove script and style tags
  let textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract main content (between common content markers)
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const contentDiv = html.match(/<div[^>]*class=["'][^"']*(?:content|article|post)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  
  let content = '';
  if (articleMatch) {
    content = articleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } else if (mainMatch) {
    content = mainMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } else if (contentDiv) {
    content = contentDiv[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } else {
    content = textContent.slice(0, 5000);
  }
  
  // Extract images
  const imageMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi);
  const images: string[] = [];
  for (const match of imageMatches) {
    if (match[1] && !match[1].startsWith('data:')) {
      try {
        images.push(new URL(match[1], url).href);
      } catch {
        images.push(match[1]);
      }
    }
  }
  
  // Extract links
  const linkMatches = html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
  const links: string[] = [];
  for (const match of linkMatches) {
    if (match[1] && !match[1].startsWith('#') && !match[1].startsWith('javascript:')) {
      try {
        links.push(new URL(match[1], url).href);
      } catch {
        links.push(match[1]);
      }
    }
  }
  
  return {
    url,
    title,
    content: content.slice(0, 10000),
    textContent: textContent.slice(0, 10000),
    wordCount: textContent.split(/\s+/).length,
    author,
    description,
    images: images.slice(0, 20),
    links: links.slice(0, 50),
  };
}

// ---------------------------------------------------------------------------
// Tool Schemas
// ---------------------------------------------------------------------------

const SearXNGSearchSchema = Type.Object({
  query: Type.String({ description: "Search query string." }),
  page: Type.Optional(Type.Number({ description: "Page number for pagination. Default: 1.", minimum: 1 })),
  time_range: Type.Optional(Type.String({ description: 'Time range filter: "day", "week", "month", or "year".', enum: ["day", "week", "month", "year"] })),
  safe_search: Type.Optional(Type.Number({ description: "Safe search level: 0=off, 1=moderate, 2=strict. Default: from config.", enum: [0, 1, 2] })),
  language: Type.Optional(Type.String({ description: "Language code (e.g., 'en-US', 'id-ID', 'auto'). Default: from config." })),
  engines: Type.Optional(Type.String({ description: "Comma-separated list of search engines (e.g., 'google,brave,duckduckgo')." })),
  base_url: Type.Optional(Type.String({ description: "SearXNG instance URL. Default: from config or env." })),
});

const SearXNGExtractSchema = Type.Object({
  url: Type.String({ description: "URL to extract content from." }),
  include_images: Type.Optional(Type.Boolean({ description: "Include image URLs. Default: true." })),
  include_links: Type.Optional(Type.Boolean({ description: "Include link URLs. Default: true." })),
  max_content_length: Type.Optional(Type.Number({ description: "Maximum content length in characters. Default: 10000." })),
});

const SearXNGCrawlSchema = Type.Object({
  start_url: Type.String({ description: "Starting URL to crawl from." }),
  max_depth: Type.Optional(Type.Number({ description: "Maximum crawl depth. Default: 2.", minimum: 1, maximum: 5 })),
  max_pages: Type.Optional(Type.Number({ description: "Maximum pages to crawl. Default: 10.", minimum: 1, maximum: 50 })),
  same_domain: Type.Optional(Type.Boolean({ description: "Only crawl same domain. Default: true." })),
  delay_ms: Type.Optional(Type.Number({ description: "Delay between requests in ms. Default: 1000." })),
  extract_content: Type.Optional(Type.Boolean({ description: "Extract page content. Default: true." })),
});

const SearXNGMapSchema = Type.Object({
  url: Type.String({ description: "Website URL to map." }),
  max_depth: Type.Optional(Type.Number({ description: "Maximum crawl depth. Default: 2.", minimum: 1, maximum: 5 })),
  max_urls: Type.Optional(Type.Number({ description: "Maximum URLs to discover. Default: 100.", minimum: 1, maximum: 500 })),
  same_domain: Type.Optional(Type.Boolean({ description: "Only map same domain. Default: true." })),
  include_sitemap: Type.Optional(Type.Boolean({ description: "Parse sitemap.xml if available. Default: true." })),
});

const SearXNGResearchSchema = Type.Object({
  query: Type.String({ description: "Research topic or question." }),
  depth: Type.Optional(Type.String({ description: 'Research depth: "quick", "medium", "deep". Default: "medium".', enum: ["quick", "medium", "deep"] })),
  max_sources: Type.Optional(Type.Number({ description: "Maximum sources to analyze. Default: 5.", minimum: 1, maximum: 20 })),
  time_range: Type.Optional(Type.String({ description: 'Time range for sources: "day", "week", "month", "year". Default: "month".' })),
});

// ---------------------------------------------------------------------------
// Plugin Definition
// ---------------------------------------------------------------------------

const searxngPlugin = {
  id: "openclaw-searxng",
  name: "SearXNG Local Search",
  description:
    "Local web search via SearXNG instance with extraction, crawling, and mapping capabilities. " +
    "Provides searxng_search, searxng_extract, searxng_crawl, searxng_map, and searxng_research tools.",
  kind: "tools" as const,

  register(api: PluginApi) {
    const cfg = api.pluginConfig ?? {};
    const baseUrl = resolveBaseUrl(cfg);
    const defaultSafeSearch = resolveSafeSearch(cfg);
    const defaultLanguage = resolveLanguage(cfg);
    const defaultEngines = resolveEngines(cfg);
    const defaultTimeout = resolveTimeout(cfg);
    const cacheTtlMs = resolveCacheTtlMs(cfg);
    const rateLimit = resolveRateLimit(cfg);
    const responseFormat = resolveResponseFormat(cfg);

    api.logger.info(
      `searxng: initialized (baseUrl=${baseUrl}, safeSearch=${defaultSafeSearch}, ` +
      `language=${defaultLanguage}, timeout=${defaultTimeout}s, cacheTtl=${Math.round(cacheTtlMs / 60000)}min, ` +
      `rateLimit=${rateLimit.maxRequests}/${rateLimit.windowMs}ms)`
    );

    const rateLimitCleanupInterval = setInterval(cleanupRateLimits, 60000);

    // ==================== SEARCH TOOL ====================
    api.registerTool(
      {
        name: "searxng_search",
        label: "SearXNG Search",
        description:
          "Search the web using your local SearXNG instance and return structured JSON results. " +
          "Use when you need programmatic access to search results with full metadata.",
        parameters: SearXNGSearchSchema,
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          // ... (existing search implementation)
          const query = typeof params.query === "string" ? params.query.trim() : "";
          if (!query) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "missing_query", message: "A non-empty query string is required." }, null, 2) }],
              details: {},
            };
          }

          const rateLimitKey = `searxng:${baseUrl}`;
          const rateLimitResult = checkRateLimit(rateLimitKey, rateLimit.maxRequests, rateLimit.windowMs);
          if (!rateLimitResult.allowed) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "rate_limit_exceeded", message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`, retryAfter: rateLimitResult.retryAfter }, null, 2) }],
              details: {},
            };
          }

          // Build and execute search
          const searchParams = new URLSearchParams();
          searchParams.set("q", query);
          searchParams.set("format", "json");
          searchParams.set("pageno", String(typeof params.page === "number" ? Math.max(1, Math.floor(params.page)) : 1));
          searchParams.set("safesearch", String(typeof params.safe_search === "number" && [0, 1, 2].includes(params.safe_search) ? params.safe_search : defaultSafeSearch));
          searchParams.set("language", typeof params.language === "string" && params.language.trim() ? params.language.trim() : defaultLanguage);

          if (typeof params.time_range === "string" && ["day", "week", "month", "year"].includes(params.time_range)) {
            searchParams.set("time_range", params.time_range);
          }

          const engines = typeof params.engines === "string" && params.engines.trim() ? params.engines.trim() : defaultEngines;
          if (engines) {
            searchParams.set("engines", engines);
          }

          const callBaseUrl = typeof params.base_url === "string" && params.base_url.trim() ? params.base_url.trim() : baseUrl;
          const url = `${callBaseUrl}/search?${searchParams.toString()}`;

          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), defaultTimeout * 1000);

            const res = await fetch(url, {
              method: "GET",
              headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
              signal: controller.signal,
            });

            clearTimeout(timer);

            if (!res.ok) {
              const errPayload = { error: "searxng_api_error", status: res.status, message: res.statusText };
              return { content: [{ type: "text" as const, text: JSON.stringify(errPayload, null, 2) }], details: {} };
            }

            const data = await res.json() as SearXNGResponse;
            const tookMs = Date.now();

            let results = (data.results ?? []).map((r) => ({
              title: r.title || "",
              url: r.url || "",
              snippet: r.content || "",
              engine: r.engine || "",
              engines: r.engines,
              score: r.score,
              category: r.category,
              publishedDate: r.publishedDate,
              thumbnail: r.thumbnail,
              siteName: siteName(r.url) || undefined,
            }));

            if (responseFormat.maxResults > 0 && results.length > responseFormat.maxResults) {
              results = results.slice(0, responseFormat.maxResults);
            }

            if (responseFormat.fields.length > 0) {
              results = results.map((r) => filterResultFields(r, responseFormat.fields) as typeof r);
            }

            const payload: Record<string, unknown> = { query: data.query ?? query, provider: "searxng", results };

            if (responseFormat.includeMetadata) {
              payload.page = typeof params.page === "number" ? Math.max(1, Math.floor(params.page)) : 1;
              payload.numberOfResults = data.number_of_results;
              payload.resultCount = results.length;
              payload.tookMs = tookMs;
              payload.baseUrl = callBaseUrl;
            }

            if (responseFormat.includeSuggestions && data.suggestions && data.suggestions.length > 0) {
              payload.suggestions = data.suggestions;
            }

            if (responseFormat.includeInfoboxes && data.infoboxes && data.infoboxes.length > 0) {
              payload.infoboxes = data.infoboxes;
            }

            if (responseFormat.includeUnresponsive && data.unresponsive_engines && data.unresponsive_engines.length > 0) {
              payload.unresponsiveEngines = data.unresponsive_engines;
            }

            writeCache(SEARCH_CACHE, `${query}:${JSON.stringify(params)}`, payload, cacheTtlMs);

            return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }], details: {} };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "searxng_fetch_error", message: msg, hint: "Ensure SearXNG is running at " + callBaseUrl }, null, 2) }], details: {} };
          }
        },
      },
      { source: "openclaw-searxng" },
    );

    // ==================== EXTRACT TOOL ====================
    api.registerTool(
      {
        name: "searxng_extract",
        label: "SearXNG Extract",
        description:
          "Extract clean, readable content from a URL. Removes navigation, ads, and clutter. " +
          "Returns title, content, text, word count, images, and links.",
        parameters: SearXNGExtractSchema,
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const url = typeof params.url === "string" ? params.url.trim() : "";
          if (!url) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "missing_url", message: "URL is required" }, null, 2) }], details: {} };
          }

          // Check cache
          const cacheKey = `extract:${url}`;
          const cached = readCache(EXTRACT_CACHE, cacheKey);
          if (cached) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ ...cached, cached: true }, null, 2) }], details: {} };
          }

          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), defaultTimeout * 1000);

            const res = await fetch(url, {
              method: "GET",
              headers: { "User-Agent": "Mozilla/5.0 (compatible; SearXNG-Extract/1.0)" },
              signal: controller.signal,
            });

            clearTimeout(timer);

            if (!res.ok) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: "fetch_error", status: res.status, url }, null, 2) }], details: {} };
            }

            const html = await res.text();
            const result = extractFromHTML(html, url);

            const maxLength = typeof params.max_content_length === "number" ? params.max_content_length : 10000;
            if (result.content.length > maxLength) {
              result.content = result.content.slice(0, maxLength) + "...";
            }

            if (params.include_images === false) {
              result.images = [];
            }

            if (params.include_links === false) {
              result.links = [];
            }

            writeCache(EXTRACT_CACHE, cacheKey, result as Record<string, unknown>, cacheTtlMs);

            return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], details: {} };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "extract_error", message: msg, url }, null, 2) }], details: {} };
          }
        },
      },
      { source: "openclaw-searxng" },
    );

    // ==================== CRAWL TOOL ====================
    api.registerTool(
      {
        name: "searxng_crawl",
        label: "SearXNG Crawl",
        description:
          "Crawl a website starting from a URL and extract content from discovered pages. " +
          "Respects depth limits, same-domain restrictions, and crawl delays.",
        parameters: SearXNGCrawlSchema,
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const startUrl = typeof params.start_url === "string" ? params.start_url.trim() : "";
          if (!startUrl) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "missing_url", message: "start_url is required" }, null, 2) }], details: {} };
          }

          const maxDepth = typeof params.max_depth === "number" ? Math.max(1, Math.min(5, Math.floor(params.max_depth))) : DEFAULT_MAX_CRAWL_DEPTH;
          const maxPages = typeof params.max_pages === "number" ? Math.max(1, Math.min(50, Math.floor(params.max_pages))) : DEFAULT_MAX_CRAWL_PAGES;
          const sameDomain = typeof params.same_domain === "boolean" ? params.same_domain : true;
          const delayMs = typeof params.delay_ms === "number" ? Math.max(100, params.delay_ms) : DEFAULT_CRAWL_DELAY_MS;
          const extractContent = typeof params.extract_content === "boolean" ? params.extract_content : true;

          const startDomain = new URL(startUrl).hostname;
          const visited = new Set<string>();
          const toVisit: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
          const results: CrawlResult[] = [];

          while (toVisit.length > 0 && visited.size < maxPages) {
            const { url, depth } = toVisit.shift()!;
            if (visited.has(url) || depth > maxDepth) continue;

            try {
              await sleep(delayMs);

              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), defaultTimeout * 1000);

              const res = await fetch(url, {
                method: "GET",
                headers: { "User-Agent": "Mozilla/5.0 (compatible; SearXNG-Crawler/1.0)" },
                signal: controller.signal,
              });

              clearTimeout(timer);

              if (!res.ok) {
                results.push({ url, title: "", content: "", links: [], depth, statusCode: res.status, error: `HTTP ${res.status}` });
                visited.add(url);
                continue;
              }

              const html = await res.text();
              const extracted = extractFromHTML(html, url);

              const result: CrawlResult = {
                url,
                title: extracted.title,
                content: extractContent ? extracted.textContent.slice(0, 5000) : "",
                links: extracted.links.slice(0, 20),
                depth,
                statusCode: res.status,
              };

              results.push(result);
              visited.add(url);

              // Add new links to queue
              for (const link of extracted.links) {
                try {
                  const linkUrl = new URL(link, url).href;
                  const linkDomain = new URL(linkUrl).hostname;
                  if (!visited.has(linkUrl) && !toVisit.some(v => v.url === linkUrl)) {
                    if (!sameDomain || linkDomain === startDomain) {
                      toVisit.push({ url: linkUrl, depth: depth + 1 });
                    }
                  }
                } catch {
                  // Invalid URL, skip
                }
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              results.push({ url, title: "", content: "", links: [], depth, error: msg });
              visited.add(url);
            }
          }

          const payload = {
            startUrl,
            pagesCrawled: visited.size,
            maxDepth,
            maxPages,
            sameDomain,
            results,
          };

          return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }], details: {} };
        },
      },
      { source: "openclaw-searxng" },
    );

    // ==================== MAP TOOL ====================
    api.registerTool(
      {
        name: "searxng_map",
        label: "SearXNG Map",
        description:
          "Discover and list all URLs from a website. Can parse sitemap.xml or crawl to find URLs. " +
          "Returns organized URL list with metadata.",
        parameters: SearXNGMapSchema,
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const url = typeof params.url === "string" ? params.url.trim() : "";
          if (!url) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "missing_url", message: "url is required" }, null, 2) }], details: {} };
          }

          const maxDepth = typeof params.max_depth === "number" ? Math.max(1, Math.min(5, Math.floor(params.max_depth))) : 2;
          const maxUrls = typeof params.max_urls === "number" ? Math.max(1, Math.min(500, Math.floor(params.max_urls))) : 100;
          const sameDomain = typeof params.same_domain === "boolean" ? params.same_domain : true;
          const includeSitemap = typeof params.include_sitemap === "boolean" ? params.include_sitemap : true;

          const domain = new URL(url).hostname;
          const urls = new Set<string>();
          const sitemapUrls: string[] = [];

          // Try to fetch sitemap.xml
          if (includeSitemap) {
            try {
              const sitemapUrl = new URL("/sitemap.xml", url).href;
              const sitemapRes = await fetch(sitemapUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
              if (sitemapRes.ok) {
                const sitemapXml = await sitemapRes.text();
                const urlMatches = sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g);
                for (const match of urlMatches) {
                  if (urls.size < maxUrls) {
                    sitemapUrls.push(match[1]);
                    urls.add(match[1]);
                  }
                }
              }
            } catch {
              // Sitemap not available, continue with crawling
            }
          }

          // Crawl to discover more URLs
          const toVisit: Array<{ url: string; depth: number }> = [{ url, depth: 0 }];
          const visited = new Set<string>();

          while (toVisit.length > 0 && urls.size < maxUrls) {
            const { url: currentUrl, depth } = toVisit.shift()!;
            if (visited.has(currentUrl) || depth > maxDepth) continue;

            try {
              await sleep(500);

              const res = await fetch(currentUrl, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; SearXNG-Map/1.0)" },
              });

              if (!res.ok) continue;

              const html = await res.text();
              visited.add(currentUrl);

              // Extract links
              const linkMatches = html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
              for (const match of linkMatches) {
                if (urls.size >= maxUrls) break;

                try {
                  const linkUrl = new URL(match[1], currentUrl).href;
                  const linkDomain = new URL(linkUrl).hostname;

                  if (!sameDomain || linkDomain === domain) {
                    if (!urls.has(linkUrl)) {
                      urls.add(linkUrl);
                      toVisit.push({ url: linkUrl, depth: depth + 1 });
                    }
                  }
                } catch {
                  // Invalid URL
                }
              }
            } catch {
              visited.add(currentUrl);
            }
          }

          const payload = {
            startUrl: url,
            domain,
            urlsFound: urls.size,
            fromSitemap: sitemapUrls.length,
            urls: Array.from(urls).sort(),
          };

          return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }], details: {} };
        },
      },
      { source: "openclaw-searxng" },
    );

    // ==================== RESEARCH TOOL ====================
    api.registerTool(
      {
        name: "searxng_research",
        label: "SearXNG Research",
        description:
          "Multi-step research that searches, extracts, and synthesizes information on a topic. " +
          "Note: This performs automated multi-query research but does NOT use AI synthesis. " +
          "Human analysis of results is required for final synthesis.",
        parameters: SearXNGResearchSchema,
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const query = typeof params.query === "string" ? params.query.trim() : "";
          if (!query) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "missing_query", message: "Query is required" }, null, 2) }], details: {} };
          }

          const depth = typeof params.depth === "string" && ["quick", "medium", "deep"].includes(params.depth) ? params.depth : "medium";
          const maxSources = typeof params.max_sources === "number" ? Math.max(1, Math.min(20, Math.floor(params.max_sources))) : 5;
          const timeRange = typeof params.time_range === "string" && ["day", "week", "month", "year"].includes(params.time_range) ? params.time_range : "month";

          const searchConfig: Record<string, unknown> = { baseUrl, defaultSafeSearch, defaultLanguage, defaultEngines, timeoutSeconds: defaultTimeout, cacheTtlMinutes: DEFAULT_CACHE_TTL_MINUTES };

          // Step 1: Initial broad search
          const searchParams = new URLSearchParams();
          searchParams.set("q", query);
          searchParams.set("format", "json");
          searchParams.set("time_range", timeRange);
          if (defaultEngines) searchParams.set("engines", defaultEngines);

          let initialResults: SearXNGResult[] = [];
          try {
            const res = await fetch(`${baseUrl}/search?${searchParams.toString()}`, {
              headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
            });
            if (res.ok) {
              const data = await res.json() as SearXNGResponse;
              initialResults = data.results ?? [];
            }
          } catch (err) {
            api.logger.warn(`Research initial search failed: ${err}`);
          }

          // Step 2: Extract subtopics from suggestions or top results
          const subtopics: string[] = [];
          if (depth !== "quick") {
            // Use result titles/snippets to find subtopics
            for (const result of initialResults.slice(0, 3)) {
              const words = result.title.split(/\s+/).slice(0, 3).join(" ");
              if (words && words !== query) {
                subtopics.push(`${query} ${words}`);
              }
            }
          }

          // Step 3: Search subtopics (for medium/deep)
          const allResults: SearXNGResult[] = [...initialResults];
          if (depth !== "quick") {
            for (const subtopic of subtopics.slice(0, depth === "deep" ? 3 : 2)) {
              try {
                const subParams = new URLSearchParams();
                subParams.set("q", subtopic);
                subParams.set("format", "json");
                subParams.set("time_range", timeRange);
                if (defaultEngines) subParams.set("engines", defaultEngines);

                const res = await fetch(`${baseUrl}/search?${subParams.toString()}`, {
                  headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
                });
                if (res.ok) {
                  const data = await res.json() as SearXNGResponse;
                  allResults.push(...(data.results ?? []));
                }
                await sleep(1000);
              } catch {
                // Continue with other subtopics
              }
            }
          }

          // Step 4: Deduplicate and select top sources
          const seenUrls = new Set<string>();
          const uniqueResults = allResults.filter(r => {
            if (seenUrls.has(r.url)) return false;
            seenUrls.add(r.url);
            return true;
          }).slice(0, maxSources * 2);

          // Step 5: Extract content from top sources
          const extractedSources: ExtractResult[] = [];
          for (const result of uniqueResults.slice(0, maxSources)) {
            try {
              await sleep(500);
              const res = await fetch(result.url, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; SearXNG-Research/1.0)" },
              });
              if (res.ok) {
                const html = await res.text();
                const extracted = extractFromHTML(html, result.url);
                extractedSources.push(extracted);
              }
            } catch {
              // Skip failed extractions
            }
          }

          // Step 6: Compile research findings
          const payload = {
            query,
            depth,
            timeRange,
            sourcesSearched: 1 + subtopics.length,
            sourcesFound: uniqueResults.length,
            sourcesAnalyzed: extractedSources.length,
            note: "This is automated multi-query research. Human synthesis of findings is required for final analysis.",
            searchResults: uniqueResults.slice(0, maxSources).map(r => ({
              title: r.title,
              url: r.url,
              snippet: r.content,
              score: r.score,
            })),
            extractedContent: extractedSources.map(e => ({
              url: e.url,
              title: e.title,
              content: e.content.slice(0, 2000),
              wordCount: e.wordCount,
            })),
            subtopicsExplored: subtopics,
            recommendations: {
              nextSteps: [
                "Review extracted content for key themes",
                "Identify conflicting information across sources",
                "Synthesize findings into coherent narrative",
                "Verify claims against primary sources",
              ],
            },
          };

          return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }], details: {} };
        },
      },
      { source: "openclaw-searxng" },
    );

    // Register service for cleanup
    api.registerService({
      id: "openclaw-searxng",
      start: () => api.logger.info("searxng: service started with 5 tools (search, extract, crawl, map, research)"),
      stop: () => {
        clearInterval(rateLimitCleanupInterval);
        SEARCH_CACHE.clear();
        EXTRACT_CACHE.clear();
        CRAWL_CACHE.clear();
        RATE_LIMIT_MAP.clear();
        api.logger.info("searxng: service stopped, all caches cleared");
      },
    });
  },
};

export default searxngPlugin;
