import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { InboxFeedResponse } from "@civfix/shared"

import type * as apiModule from "@/lib/api"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { invalidateMail } from "@/features/mail/use-mail"

import { inboxFeedQueryOptions } from "./use-inbox"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { listInboxFeed: vi.fn() },
}))

const listInboxFeed = vi.mocked(api.listInboxFeed)

const reply = {
  source: "reply",
  id: "m1",
  threadId: "t1",
  reportId: "r1",
  cleanupId: null,
  org: "City of Springfield",
  from: "clerk@springfield.gov",
  subject: "Re: pothole",
  preview: "Crew is scheduled",
  ts: "2026-09-22T10:00:00.000Z",
  unread: true,
  threadStatus: "needs_action",
  hasAttachments: false,
  authVerdict: "fail",
  publication: "withheld",
} as const satisfies InboxFeedResponse["items"][number]

describe("inbox feed query", () => {
  beforeEach(() => listInboxFeed.mockReset())

  it("pages the feed with its filter and search until the server cursor runs out", async () => {
    listInboxFeed
      .mockResolvedValueOnce({ items: [reply], nextCursor: "c1" })
      .mockResolvedValueOnce({ items: [{ ...reply, id: "m2" }], nextCursor: null })
    const qc = new QueryClient()
    const params = { filter: "review", q: "pothole" } as const

    const data = await qc.fetchInfiniteQuery({ ...inboxFeedQueryOptions(params), pages: 3 })

    expect(listInboxFeed.mock.calls.map(([input]) => input)).toEqual([
      { filter: "review", q: "pothole" },
      { filter: "review", q: "pothole", cursor: "c1" },
    ])
    expect(data.pages.flatMap((p) => p.items.map((item) => item.id))).toEqual(["m1", "m2"])
  })

  it("refreshes when a thread changes, since reply rows carry thread state", async () => {
    listInboxFeed.mockResolvedValue({ items: [reply], nextCursor: null })
    const qc = new QueryClient()
    const options = inboxFeedQueryOptions({ filter: "all" })
    await qc.fetchInfiniteQuery(options)

    invalidateMail(qc, "t1")

    expect(qc.getQueryState(options.queryKey)?.isInvalidated).toBe(true)
  })
})

describe("inbox feed cache key", () => {
  it("sits under the inbox key every inbox mutation invalidates", () => {
    expect(queryKeys.inbox.feed({ filter: "all" }).slice(0, 2)).toEqual(queryKeys.inbox.all)
  })
})
