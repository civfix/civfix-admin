"use client"

import { QueryClient } from "@tanstack/react-query"
import { AppError, ErrorCode } from "@civfix/shared"
import { useUiStore } from "@/store/ui-store"
import { errorMessage } from "@/lib/error-messages"

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
        onError: (error) => {
          try {
            useUiStore
              .getState()
              .showToast(
                errorMessage(error, {}, { fallback: "Something went wrong. Please try again." }),
              )
          } catch {
            void 0
          }
        },
      },
    },
  })
}

export const queryKeys = {
  session: ["admin", "session"] as const,

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

  discovery: {
    all: ["admin", "discovery"] as const,
    list: (params?: unknown) => ["admin", "discovery", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "discovery", "detail", id] as const,
  },
  jurisdictions: {
    all: ["admin", "jurisdictions"] as const,
    list: (params?: unknown) => ["admin", "jurisdictions", "list", params ?? null] as const,
    geometry: (geoid: string) => ["admin", "jurisdictions", "geometry", geoid] as const,
  },

  reports: {
    all: ["admin", "reports"] as const,
    list: (params?: unknown) => ["admin", "reports", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "reports", "detail", id] as const,
    discussion: (id: string, params?: unknown) =>
      ["admin", "reports", id, "discussion", params ?? null] as const,
  },

  events: {
    all: ["admin", "events"] as const,
    list: (params?: unknown) => ["admin", "events", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "events", "detail", id] as const,
  },

  users: {
    all: ["admin", "users"] as const,
    list: (params?: unknown) => ["admin", "users", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "users", "detail", id] as const,
    reports: (id: string, params?: unknown) => ["admin", "users", id, "reports", params ?? null] as const,
    events: (id: string, params?: unknown) => ["admin", "users", id, "events", params ?? null] as const,
    messages: (id: string, params?: unknown) =>
      ["admin", "users", id, "messages", params ?? null] as const,
  },

  mail: {
    all: ["admin", "mail"] as const,
    list: (params?: unknown) => ["admin", "mail", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "mail", "detail", id] as const,
    stats: ["admin", "mail", "stats"] as const,
  },

  inbox: {
    all: ["admin", "inbox"] as const,
    list: (params?: unknown) => ["admin", "inbox", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "inbox", "detail", id] as const,
  },

  moderation: {
    all: ["admin", "moderation"] as const,
    list: (params?: unknown) => ["admin", "moderation", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "moderation", "detail", id] as const,
  },

  gov: {
    all: ["admin", "gov"] as const,
    list: (params?: unknown) => ["admin", "gov", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "gov", "detail", id] as const,
  },

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

  audit: {
    all: ["admin", "audit"] as const,
    list: (params?: unknown) => ["admin", "audit", "list", params ?? null] as const,
  },
}
