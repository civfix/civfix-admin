"use client"

import { QueryClient } from "@tanstack/react-query"
import { AppError, ErrorCode } from "@civfix/shared"

/**
 * Create a React Query client tuned for a runtime-fetching admin SPA.
 *
 * Retries are conservative: we never retry 4xx (validation/auth/not-found/forbidden) and only retry
 * transient failures (network/5xx) a couple of times. This keeps the UI responsive when the backend is
 * down (it fails fast into an error state instead of hammering a dead endpoint).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof AppError) {
            const noRetry: ErrorCode[] = [
              ErrorCode.UNAUTHORIZED,
              ErrorCode.FORBIDDEN,
              ErrorCode.NOT_FOUND,
              ErrorCode.VALIDATION,
            ]
            if (noRetry.includes(error.code)) return false
          }
          return failureCount < 2
        },
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Stable query keys for every admin domain. Centralized so invalidation stays consistent.
 *
 * Query-key conventions:
 *  - List keys take the FULL filter/search/sort object (e.g. `reports.list({ filter, q })`) so two
 *    views with different filters do not collide on one cache entry.
 *  - Detail keys take the id (`reports.detail(id)`).
 *  - Each domain exposes a `*.all` PREFIX (React Query matches by key prefix) so a mutation can
 *    invalidate every list/detail variant of that domain at once, e.g.
 *      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
 *  - After a mutation also invalidate cross-cutting keys when relevant: `queryKeys.home.all`,
 *    `queryKeys.activity.all` (the activity feed and home aggregates reflect domain writes).
 */
export const queryKeys = {
  // ----- auth / session -----
  session: ["admin", "session"] as const,

  // ----- home / dashboard -----
  home: {
    all: ["admin", "home"] as const,
    summary: ["admin", "home", "summary"] as const,
    map: ["admin", "home", "map"] as const,
  },
  activity: {
    all: ["admin", "activity"] as const,
    list: (params?: unknown) => ["admin", "activity", params ?? null] as const,
  },
  system: {
    health: ["admin", "system", "health"] as const,
  },

  // ----- discovery / jurisdictions -----
  discovery: {
    all: ["admin", "discovery"] as const,
    list: (params?: unknown) => ["admin", "discovery", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "discovery", "detail", id] as const,
  },
  jurisdictions: {
    all: ["admin", "jurisdictions"] as const,
    list: (params?: unknown) => ["admin", "jurisdictions", "list", params ?? null] as const,
  },

  // ----- reports -----
  reports: {
    all: ["admin", "reports"] as const,
    list: (params?: unknown) => ["admin", "reports", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "reports", "detail", id] as const,
  },

  // ----- events (cleanups) -----
  events: {
    all: ["admin", "events"] as const,
    list: (params?: unknown) => ["admin", "events", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "events", "detail", id] as const,
  },

  // ----- users -----
  users: {
    all: ["admin", "users"] as const,
    list: (params?: unknown) => ["admin", "users", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "users", "detail", id] as const,
    reports: (id: string, params?: unknown) => ["admin", "users", id, "reports", params ?? null] as const,
    events: (id: string, params?: unknown) => ["admin", "users", id, "events", params ?? null] as const,
    messages: (id: string, params?: unknown) =>
      ["admin", "users", id, "messages", params ?? null] as const,
  },

  // ----- gov provisioning -----
  gov: {
    all: ["admin", "gov-claims"] as const,
    list: (params?: unknown) => ["admin", "gov-claims", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "gov-claims", "detail", id] as const,
  },

  // ----- moderation -----
  moderation: {
    all: ["admin", "moderation"] as const,
    list: (params?: unknown) => ["admin", "moderation", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "moderation", "detail", id] as const,
  },

  // ----- mail / outreach -----
  mail: {
    all: ["admin", "mail"] as const,
    list: (params?: unknown) => ["admin", "mail", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "mail", "detail", id] as const,
    stats: ["admin", "mail", "stats"] as const,
  },

  // ----- analytics -----
  analytics: {
    all: ["admin", "analytics"] as const,
    kpis: ["admin", "analytics", "kpis"] as const,
    pinsByWeek: ["admin", "analytics", "pins-by-week"] as const,
    byCategory: ["admin", "analytics", "by-category"] as const,
    funnel: ["admin", "analytics", "funnel"] as const,
    coverage: ["admin", "analytics", "coverage"] as const,
    resolutionByCategory: ["admin", "analytics", "resolution-by-category"] as const,
    events: ["admin", "analytics", "events"] as const,
    topJurisdictions: ["admin", "analytics", "top-jurisdictions"] as const,
    topContributors: ["admin", "analytics", "top-contributors"] as const,
    heatmap: ["admin", "analytics", "heatmap"] as const,
    retention: ["admin", "analytics", "retention"] as const,
  },

  // ----- audit log -----
  audit: {
    all: ["admin", "audit"] as const,
    list: (params?: unknown) => ["admin", "audit", "list", params ?? null] as const,
  },
}
