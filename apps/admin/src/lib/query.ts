"use client"

import { MutationCache, QueryClient } from "@tanstack/react-query"
import {
  ErrorCode,
  type AdminBroadcastListQuery,
  type AdminEventListQuery,
  type AdminEventPageListQuery,
  type AdminHostListQuery,
  type AdminOrgEventWhen,
  type AdminOrgListQuery,
  type AdminOrgMemberListRequest,
  type AdminReportListQuery,
  type AdminUserListQuery,
  type AuditListQuery,
  type ChatHistoryQuery,
  type DiscoveryListQuery,
  type GovClaimListQuery,
  type InboxFeedQuery,
  type InboxListQuery,
  type JurisdictionListQuery,
  type MailListQuery,
  type ModerationListQuery,
  type UserSubListQuery,
} from "@civfix/shared"
import { useUiStore } from "@/store/ui-store"
import { toAppError } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** false when the mutation's own UI shows every error inline, so the global toast stays quiet. */
      errorToast?: false
      /**
       * Domain copy for the global error toast, built from the error and the mutation's variables so it
       * still shows after the component that fired the mutation unmounts. Returning null leaves this
       * error to the UI, which shows it inline.
       */
      // Method syntax keeps the parameters bivariant, so a hook can declare its own variables type.
      errorMessage?(error: unknown, variables: unknown): string | null
    }
  }
}

type UserSubPageParams = Omit<UserSubListQuery, "id">
type OrgMemberPageParams = Omit<AdminOrgMemberListRequest, "id">

const MAX_QUERY_RETRIES = 2

// Retrying cannot change these answers, and a retried 429 only deepens the rate limit.
const NO_RETRY_CODES: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.UNAUTHORIZED,
  ErrorCode.FORBIDDEN,
  ErrorCode.NOT_FOUND,
  ErrorCode.VALIDATION,
  ErrorCode.CONFLICT,
  ErrorCode.RATE_LIMITED,
])

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    // The cache-level handler runs for every failed mutation, even one with its own onError, which
    // would silently replace a defaultOptions.mutations.onError.
    mutationCache: new MutationCache({
      onError: (error, variables, _onMutateResult, mutation) => {
        const meta = mutation.meta
        if (meta?.errorToast === false) return
        const text = meta?.errorMessage ? meta.errorMessage(error, variables) : errorMessage(error)
        if (text !== null) useUiStore.getState().showToast(text, "error")
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          !NO_RETRY_CODES.has(toAppError(error).code) && failureCount < MAX_QUERY_RETRIES,
      },
      mutations: {
        retry: false,
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
    list: (params?: DiscoveryListQuery) => ["admin", "discovery", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "discovery", "detail", id] as const,
  },
  jurisdictions: {
    all: ["admin", "jurisdictions"] as const,
    list: (params?: Partial<JurisdictionListQuery>) =>
      ["admin", "jurisdictions", "list", params ?? null] as const,
    geometry: (geoid: string) => ["admin", "jurisdictions", "geometry", geoid] as const,
  },

  reports: {
    all: ["admin", "reports"] as const,
    list: (params?: AdminReportListQuery) => ["admin", "reports", "list", params ?? null] as const,
    page: (params?: AdminReportListQuery) => ["admin", "reports", "page", params ?? null] as const,
    detail: (id: string) => ["admin", "reports", "detail", id] as const,
    chat: (id: string, params?: ChatHistoryQuery) =>
      ["admin", "reports", id, "chat", params ?? null] as const,
  },

  events: {
    all: ["admin", "events"] as const,
    list: (params?: AdminEventListQuery) => ["admin", "events", "list", params ?? null] as const,
    page: (params?: AdminEventListQuery) => ["admin", "events", "page", params ?? null] as const,
    detail: (id: string) => ["admin", "events", "detail", id] as const,
  },

  users: {
    all: ["admin", "users"] as const,
    list: (params?: AdminUserListQuery) => ["admin", "users", "list", params ?? null] as const,
    page: (params?: AdminUserListQuery) => ["admin", "users", "page", params ?? null] as const,
    detail: (id: string) => ["admin", "users", "detail", id] as const,
    reports: (id: string, params?: UserSubPageParams) =>
      ["admin", "users", id, "reports", params ?? null] as const,
    events: (id: string, params?: UserSubPageParams) =>
      ["admin", "users", id, "events", params ?? null] as const,
    messages: (id: string, params?: UserSubPageParams) =>
      ["admin", "users", id, "messages", params ?? null] as const,
  },

  mail: {
    all: ["admin", "mail"] as const,
    list: (params?: MailListQuery) => ["admin", "mail", "list", params ?? null] as const,
    page: (params?: MailListQuery) => ["admin", "mail", "page", params ?? null] as const,
    detail: (id: string) => ["admin", "mail", "detail", id] as const,
    stats: ["admin", "mail", "stats"] as const,
    forwardTemplate: ["admin", "mail", "forward-template"] as const,
  },

  inbox: {
    all: ["admin", "inbox"] as const,
    list: (params?: InboxListQuery) => ["admin", "inbox", "list", params ?? null] as const,
    page: (params?: InboxListQuery) => ["admin", "inbox", "page", params ?? null] as const,
    feed: (params?: InboxFeedQuery) => ["admin", "inbox", "feed", params ?? null] as const,
    detail: (id: string) => ["admin", "inbox", "detail", id] as const,
  },

  moderation: {
    all: ["admin", "moderation"] as const,
    list: (params?: ModerationListQuery) => ["admin", "moderation", "list", params ?? null] as const,
    page: (params?: ModerationListQuery) => ["admin", "moderation", "page", params ?? null] as const,
    detail: (id: string) => ["admin", "moderation", "detail", id] as const,
  },

  govClaims: {
    all: ["admin", "gov-claims"] as const,
    list: (params?: GovClaimListQuery) => ["admin", "gov-claims", "list", params ?? null] as const,
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
    list: (params?: AdminOrgListQuery) => ["admin", "orgs", "list", params ?? null] as const,
    detail: (id: string) => ["admin", "orgs", "detail", id] as const,
    members: (id: string, params?: OrgMemberPageParams) =>
      ["admin", "orgs", id, "members", params ?? null] as const,
    events: (id: string, params?: { when: AdminOrgEventWhen }) =>
      ["admin", "orgs", id, "events", params ?? null] as const,
  },

  media: {
    all: ["admin", "media"] as const,
    document: (mediaId: string) => ["admin", "media", "document", mediaId] as const,
  },

  hosts: {
    all: ["admin", "hosts"] as const,
    list: (params?: AdminHostListQuery) => ["admin", "hosts", "list", params ?? null] as const,
    broadcasts: (params?: AdminBroadcastListQuery) =>
      ["admin", "hosts", "broadcasts", params ?? null] as const,
  },

  pages: {
    all: ["admin", "pages"] as const,
    list: (params?: AdminEventPageListQuery) => ["admin", "pages", "list", params ?? null] as const,
    preview: (cleanupId: string) => ["admin", "pages", "preview", cleanupId] as const,
  },

  audit: {
    all: ["admin", "audit"] as const,
    list: (params?: AuditListQuery) => ["admin", "audit", "list", params ?? null] as const,
  },
}
