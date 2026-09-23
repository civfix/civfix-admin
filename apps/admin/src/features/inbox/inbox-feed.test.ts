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
} from "./inbox-feed"

describe("inbox feed keys", () => {
  it("keys an item by source and id and parses it back", () => {
    expect(feedKey({ source: "reply", id: "m1" })).toBe("reply:m1")
    expect(parseFeedKey("reply:m1")).toEqual({ source: "reply", id: "m1" })
    expect(parseFeedKey(feedKey({ source: "email", id: "e1" }))).toEqual({ source: "email", id: "e1" })
  })

  it("maps the Home tile's inbox deep link onto an email key", () => {
    expect(emailFocusKey("e1")).toBe("email:e1")
  })

  it("rejects keys that name no feed source or no id", () => {
    expect(parseFeedKey("e1")).toBeNull()
    expect(parseFeedKey("thread:t1")).toBeNull()
    expect(parseFeedKey("email:")).toBeNull()
    expect(parseFeedKey(":e1")).toBeNull()
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
    expect(isInboxFeedFilter("in")).toBe(false)
    expect(isInboxFeedFilter("out")).toBe(false)
    expect(isInboxFeedFilter("attn")).toBe(false)
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
