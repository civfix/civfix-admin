import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"
import { INBOX_FEED_FILTER_LABELS, InboxFeedFilterSchema } from "@civfix/shared"

import {
  INBOX_EMPTY_COPY,
  INBOX_FEED_FILTER_ORDER,
  emailFocusKey,
  feedKey,
  isInboxFeedFilter,
  parseFeedKey,
  replyOriginLabel,
  resolveFeedSelection,
} from "./inbox-feed"

describe("inbox feed keys", () => {
  it("keys an item by source and id and parses it back", () => {
    expect(feedKey({ source: "reply", id: "m1" })).toBe("reply:m1")
    expect(parseFeedKey("reply:m1")).toEqual({ source: "reply", id: "m1" })
    expect(parseFeedKey(emailFocusKey("e1"))).toEqual({ source: "email", id: "e1" })
  })

  it("rejects keys that name no feed source or no id", () => {
    for (const key of ["e1", "thread:t1", "email:", ":e1"]) expect(parseFeedKey(key)).toBeNull()
  })
})

describe("selected feed item", () => {
  const picked = { item: { source: "reply" as const, id: "m1", unread: true }, view: "unread:" }
  const listed = { ...picked.item, unread: false }

  it("reads the listed row, and keeps the picked row once marking it read drops it", () => {
    expect(resolveFeedSelection(new Map([["reply:m1", listed]]), picked, "reply:m1", "unread:")).toBe(listed)
    expect(resolveFeedSelection(new Map(), picked, "reply:m1", "unread:")).toBe(picked.item)
  })

  it("resolves nothing for an unlisted key unless it was picked under the same filter and search", () => {
    expect(resolveFeedSelection(new Map(), picked, "reply:m1", "replies:")).toBeUndefined()
    expect(resolveFeedSelection(new Map(), picked, "reply:m1", "unread:city")).toBeUndefined()
    expect(resolveFeedSelection(new Map(), picked, "reply:m2", "unread:")).toBeUndefined()
    expect(resolveFeedSelection(new Map(), null, "email:e1", "unread:")).toBeUndefined()
  })
})

describe("inbox feed filters", () => {
  it("offers every contract filter, in contract order, with a label and empty copy", () => {
    expect(INBOX_FEED_FILTER_ORDER).toEqual(InboxFeedFilterSchema.options)
    for (const filter of INBOX_FEED_FILTER_ORDER) {
      expect(INBOX_FEED_FILTER_LABELS[filter]).toBeTruthy()
      expect(INBOX_EMPTY_COPY[filter].title).toBeTruthy()
      expect(INBOX_EMPTY_COPY[filter].sub).toBeTruthy()
    }
  })

  it("does not treat an Outreach chip as an inbox filter", () => {
    expect(isInboxFeedFilter("review")).toBe(true)
    for (const chip of ["in", "out", "attn"]) expect(isInboxFeedFilter(chip)).toBe(false)
  })
})

describe("reply rows", () => {
  it("names what the reply answers", () => {
    expect(replyOriginLabel({ reportId: "r1", cleanupId: null })).toBe("Report reply")
    expect(replyOriginLabel({ reportId: null, cleanupId: "c1" })).toBe("Event reply")
    expect(replyOriginLabel({ reportId: null, cleanupId: null })).toBe("Thread reply")
  })
})

describe("inbound mail rendering", () => {
  it("renders sender-controlled mail as text, never as markup", () => {
    const sources = [
      "./inbox-views.tsx",
      "../mail/mail-page.tsx",
      "../mail/mail-badges.tsx",
    ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
    for (const source of sources) {
      expect(source).not.toMatch(/dangerouslySetInnerHTML|innerHTML|bodyHtml/)
    }
  })
})
