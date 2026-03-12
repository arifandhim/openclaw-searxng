/**
 * openclaw-searxng — SearXNG local search plugin for OpenClaw
 *
 * Exposes one tool:
 *   - `searxng_search` — local web search with structured JSON results
 *
 * Config (openclaw.json → plugins.entries.openclaw-searxng.config):
 *   baseUrl           - SearXNG instance URL (or set SEARXNG_URL env var)
 *   defaultSafeSearch - 0 | 1 | 2 (default: 0)
 *   defaultLanguage   - language code (default: "auto")
 *   defaultEngines    - comma-separated engine list (default: undefined)
 *   timeoutSeconds    - number (default: 30)
 *   cacheTtlMinutes   - number (default: 15)
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "http://localhost:8888";
const DEFAULT_SAFE_SEARCH = 0;
const DEFAULT_LANGUAGE = "auto";
const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_CACHE_TTL_MINUTES = 15;
const MAX_CACHE_ENTRIES = 100;

// ---------------------------------------------------------------------------
// Cache (in-memory)
// ---------------------------------------------------------------------------

const SEARCH_CACHE = new Map<string, CacheEntry>();

function readCache(key: string): Record<string, unknown> | null {
  const entry = SEARCH_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    SEARCH_CACHE.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: Record<string, unknown>, ttlMs: number): void {
  if (ttlMs <= 0) return;
  if (SEARCH_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldest = SEARCH_CACHE.keys().next();
    if (!oldest.done) SEARCH_CACHE.delete(oldest.value);
  }
  SEARCH_CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
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

function siteName(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Tool schema
// ---------------------------------------------------------------------------

const SearXNGSearchSchema = Type.Object({
  query: Type.String({ description: "Search query string." }),
  page: Type.Optional(
    Type.Number({
      description: "Page number for pagination. Default: 1.",
      minimum: 1,
    }),
  ),
  time_range: Type.Optional(
    Type.String({
      description: 'Time range filter: "day", "week", "month", or "year".',
      enum: ["day", "week", "month", "year"],
    }),
  ),
  safe_search: Type.Optional(
    Type.Number({
      description: "Safe search level: 0=off, 1=moderate, 2=strict. Default: from config.",
      enum: [0, 1, 2],
    }),
  ),
  language: Type.Optional(
    Type.String({
      description: "Language code (e.g., 'en-US', 'id-ID', 'auto'). Default: from config.",
    }),
  ),
  engines: Type.Optional(
    Type.String({
      description: "Comma-separated list of search engines (e.g., 'google,brave,duckduckgo').",
    }),
  ),
  base_url: Type.Optional(
    Type.String({
      description: "SearXNG instance URL. Default: from config or env.",
    }),
  ),
});

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const searxngPlugin = {
  id: "openclaw-searxng",
  name: "SearXNG Local Search",
  description:
    "Local web search via SearXNG instance. Provides searxng_search tool for private, " +
    "structured web search with full metadata, pagination, time filtering, and engine selection.",
  kind: "tools" as const,

  register(api: PluginApi) {
    const cfg = api.pluginConfig ?? {};
    const baseUrl = resolveBaseUrl(cfg);

    const defaultSafeSearch = resolveSafeSearch(cfg);
    const defaultLanguage = resolveLanguage(cfg);
    const defaultEngines = resolveEngines(cfg);
    const defaultTimeout = resolveTimeout(cfg);
    const cacheTtlMs = resolveCacheTtlMs(cfg);

    api.logger.info(
      `searxng: initialized (baseUrl=${baseUrl}, safeSearch=${defaultSafeSearch}, ` +
        `language=${defaultLanguage}, timeout=${defaultTimeout}s, cacheTtl=${Math.round(cacheTtlMs / 60000)}min)`,
    );

    api.registerTool(
      {
        name: "searxng_search",
        label: "SearXNG Search",
        description:
          "Search the web using your local SearXNG instance and return structured JSON results. " +
          "Use when you need programmatic access to search results with full metadata including URLs, " +
          "scores, engines, and suggestions. Returns raw JSON that you can parse and process. " +
          "All search data stays local — no external API calls.",
        parameters: SearXNGSearchSchema,
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          // --- resolve per-call params ---
          const query = typeof params.query === "string" ? params.query.trim() : "";
          if (!query) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: "missing_query",
                    message: "A non-empty query string is required.",
                  }, null, 2),
                },
              ],
              details: {},
            };
          }

          const page = typeof params.page === "number" && Number.isFinite(params.page)
            ? Math.max(1, Math.floor(params.page))
            : 1;

          const timeRange = typeof params.time_range === "string" &&
            ["day", "week", "month", "year"].includes(params.time_range)
            ? params.time_range
            : undefined;

          const safeSearch = typeof params.safe_search === "number" && [0, 1, 2].includes(params.safe_search)
            ? params.safe_search
            : defaultSafeSearch;

          const language = typeof params.language === "string" && params.language.trim()
            ? params.language.trim()
            : defaultLanguage;

          const engines = typeof params.engines === "string" && params.engines.trim()
            ? params.engines.trim()
            : defaultEngines;

          const callBaseUrl = typeof params.base_url === "string" && params.base_url.trim()
            ? params.base_url.trim()
            : baseUrl;

          // --- cache ---
          const cacheKey = [
            "searxng",
            query,
            page,
            timeRange ?? "",
            safeSearch,
            language,
            engines ?? "",
            callBaseUrl,
          ]
            .join(":")
            .toLowerCase();

          const cached = readCache(cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({ ...cached, cached: true }, null, 2),
                },
              ],
              details: {},
            };
          }

          // --- build SearXNG API request ---
          const searchParams = new URLSearchParams();
          searchParams.set("q", query);
          searchParams.set("format", "json");
          searchParams.set("pageno", String(page));
          searchParams.set("safesearch", String(safeSearch));
          searchParams.set("language", language);

          if (timeRange) {
            searchParams.set("time_range", timeRange);
          }

          if (engines) {
            searchParams.set("engines", engines);
          }

          const url = `${callBaseUrl}/search?${searchParams.toString()}`;

          // --- call SearXNG ---
          const start = Date.now();
          let data: SearXNGResponse;
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), defaultTimeout * 1000);

            const res = await fetch(url, {
              method: "GET",
              headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0",
                "X-Forwarded-For": "127.0.0.1",
              },
              signal: controller.signal,
            });

            clearTimeout(timer);

            if (!res.ok) {
              let detail = "";
              try {
                detail = await res.text();
              } catch {}
              const errPayload = {
                error: "searxng_api_error",
                status: res.status,
                message: detail || res.statusText,
              };
              api.logger.warn(`searxng: API error ${res.status}: ${detail || res.statusText}`);
              return {
                content: [
                  { type: "text" as const, text: JSON.stringify(errPayload, null, 2) },
                ],
                details: {},
              };
            }

            data = (await res.json()) as SearXNGResponse;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            api.logger.warn(`searxng: fetch error: ${msg}`);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      error: "searxng_fetch_error",
                      message: msg,
                      hint: "Ensure SearXNG is running at " + callBaseUrl,
                    },
                    null,
                    2,
                  ),
                },
              ],
              details: {},
            };
          }

          const tookMs = Date.now() - start;

          // --- format results ---
          const results = (data.results ?? []).map((r) => ({
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

          const payload: Record<string, unknown> = {
            query: data.query ?? query,
            provider: "searxng",
            page,
            numberOfResults: data.number_of_results,
            resultCount: results.length,
            tookMs,
            baseUrl: callBaseUrl,
            results,
          };

          if (data.suggestions && data.suggestions.length > 0) {
            payload.suggestions = data.suggestions;
          }

          if (data.infoboxes && data.infoboxes.length > 0) {
            payload.infoboxes = data.infoboxes;
          }

          if (data.unresponsive_engines && data.unresponsive_engines.length > 0) {
            payload.unresponsiveEngines = data.unresponsive_engines;
          }

          // --- cache + return ---
          writeCache(cacheKey, payload, cacheTtlMs);

          api.logger.info(
            `searxng: "${query}" → ${results.length} results in ${tookMs}ms (page=${page})`,
          );

          return {
            content: [
              { type: "text" as const, text: JSON.stringify(payload, null, 2) },
            ],
            details: {},
          };
        },
      },
      { source: "openclaw-searxng" },
    );

    api.registerService({
      id: "openclaw-searxng",
      start: () => api.logger.info("searxng: service started"),
      stop: () => {
        SEARCH_CACHE.clear();
        api.logger.info("searxng: service stopped, cache cleared");
      },
    });
  },
};

export default searxngPlugin;
