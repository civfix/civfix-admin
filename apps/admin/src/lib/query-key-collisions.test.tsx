import type { ReactNode } from "react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { makeTestQueryClient } from "@/test/render"
import { useEventList, useEventListInfinite } from "@/features/events/use-events"
import { useInboxList, useInboxListInfinite } from "@/features/inbox/use-inbox"
import { useMailList, useMailListInfinite } from "@/features/mail/use-mail"
import { useModerationList, useModerationListInfinite } from "@/features/moderation/use-moderation"
import { useReportList, useReportListInfinite } from "@/features/reports/use-reports"
import { useUserList, useUserListInfinite } from "@/features/users/use-users"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const PARAMS = { q: "park", limit: 25 }
const EMPTY_PAGE = { items: [], nextCursor: null }

type ListMethod =
  | "listAdminEvents"
  | "listInbox"
  | "listMail"
  | "listModeration"
  | "listAdminReports"
  | "listAdminUsers"

async function mountBoth(method: ListMethod, useBoth: () => unknown): Promise<QueryClient> {
  apiMock[method].mockResolvedValue(EMPTY_PAGE)
  const client = makeTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  renderHook(useBoth, { wrapper })
  await waitFor(() => {
    expect(apiMock[method]).toHaveBeenCalled()
    expect(client.isFetching()).toBe(0)
  })
  return client
}

describe("list and infinite hooks mounted with equal params", () => {
  it.each([
    [
      "events",
      "listAdminEvents",
      () => {
        useEventList(PARAMS)
        useEventListInfinite(PARAMS)
      },
      queryKeys.events.all,
      queryKeys.events.page(PARAMS),
      queryKeys.events.list(PARAMS),
    ],
    [
      "inbox",
      "listInbox",
      () => {
        useInboxList(PARAMS)
        useInboxListInfinite(PARAMS)
      },
      queryKeys.inbox.all,
      queryKeys.inbox.page(PARAMS),
      queryKeys.inbox.list(PARAMS),
    ],
    [
      "mail",
      "listMail",
      () => {
        useMailList(PARAMS)
        useMailListInfinite(PARAMS)
      },
      queryKeys.mail.all,
      queryKeys.mail.page(PARAMS),
      queryKeys.mail.list(PARAMS),
    ],
    [
      "moderation",
      "listModeration",
      () => {
        useModerationList(PARAMS)
        useModerationListInfinite(PARAMS)
      },
      queryKeys.moderation.all,
      queryKeys.moderation.page(PARAMS),
      queryKeys.moderation.list(PARAMS),
    ],
    [
      "reports",
      "listAdminReports",
      () => {
        useReportList(PARAMS)
        useReportListInfinite(PARAMS)
      },
      queryKeys.reports.all,
      queryKeys.reports.page(PARAMS),
      queryKeys.reports.list(PARAMS),
    ],
    [
      "users",
      "listAdminUsers",
      () => {
        useUserList(PARAMS)
        useUserListInfinite(PARAMS)
      },
      queryKeys.users.all,
      queryKeys.users.page(PARAMS),
      queryKeys.users.list(PARAMS),
    ],
  ] as const)(
    "%s list hook and infinite hook keep separate cache entries",
    async (_name, method, useBoth, all, pageKey, listKey) => {
      const client = await mountBoth(method, useBoth)
      const cache = client.getQueryCache()
      expect(cache.findAll({ queryKey: all })).toHaveLength(2)
      expect(cache.findAll({ queryKey: pageKey, exact: true })).toHaveLength(1)
      expect(cache.findAll({ queryKey: listKey, exact: true })).toHaveLength(1)
    },
  )
})
