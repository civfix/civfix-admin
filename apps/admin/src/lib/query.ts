"use client"

import { QueryClient } from "@tanstack/react-query"
import { ErrorCode } from "@civfix/shared"
import { useUiStore } from "@/store/ui-store"
import { toAppError } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const noRetry: ErrorCode[] = [
            ErrorCode.UNAUTHORIZED,
            ErrorCode.FORBIDDEN,
            ErrorCode.NOT_FOUND,
            ErrorCode.VALIDATION,
          ]
          if (noRetry.includes(toAppError(error).code)) return false
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
    page: (params?: unknown) => ["admin", "reports", "page", params ?? null] as const,
    detail: (id: string) => ["admin", "reports", "detail", id] as const,
    chat: (id: string, params?: unknown) =>
      ["admin", "reports", id, "chat", params ?? null] as const,
  },

  events: {
    all: ["admin", "events"] as const,
    list: (params?: unknown) => ["admin", "events", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "events", "detail", id] as const,
  },

  users: {
    all: ["admin", "users"] as const,
    list: (params?: unknown) => ["admin", "users", "list", params ?? null] as const,
    /** One flat page (home preview, user picker) — kept apart from the infinite `list` cache entries. */
    page: (params?: unknown) => ["admin", "users", "page", params ?? null] as const,
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
    forwardTemplate: ["admin", "mail", "forward-template"] as const,
  },

  inbox: {
    all: ["admin", "inbox"] as const,
    list: (params?: unknown) => ["admin", "inbox", "list", params ?? null] as const,
    feed: (params?: unknown) => ["admin", "inbox", "feed", params ?? null] as const,
    detail: (id: string) => ["admin", "inbox", "detail", id] as const,
  },

  moderation: {
    all: ["admin", "moderation"] as const,
    list: (params?: unknown) => ["admin", "moderation", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "moderation", "detail", id] as const,
  },

  govClaims: {
    all: ["admin", "gov-claims"] as const,
    list: (params?: unknown) => ["admin", "gov-claims", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "gov-claims", "detail", id] as const,
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

  orgs: {
    all: ["admin", "orgs"] as const,
    list: (params?: unknown) => ["admin", "orgs", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "orgs", "detail", id] as const,
    members: (id: string, params?: unknown) =>
      ["admin", "orgs", id, "members", params ?? null] as const,
    events: (id: string, params?: unknown) =>
      ["admin", "orgs", id, "events", params ?? null] as const,
  },

  media: {
    all: ["admin", "media"] as const,
    document: (mediaId: string) => ["admin", "media", "document", mediaId] as const,
  },

  hosts: {
    all: ["admin", "hosts"] as const,
    list: (params?: unknown) => ["admin", "hosts", "list", params ?? null] as const,
    broadcasts: (params?: unknown) => ["admin", "hosts", "broadcasts", params ?? null] as const,
  },

  pages: {
    all: ["admin", "pages"] as const,
    list: (params?: unknown) => ["admin", "pages", "list", params ?? null] as const,
    preview: (cleanupId: string) => ["admin", "pages", "preview", cleanupId] as const,
  },

  audit: {
    all: ["admin", "audit"] as const,
    list: (params?: unknown) => ["admin", "audit", "list", params ?? null] as const,
  },
}
