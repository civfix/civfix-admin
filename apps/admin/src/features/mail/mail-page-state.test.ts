import { hashKey } from "@tanstack/react-query"
import type { MailMessageDTO, MailThreadDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { EMPTY_VALUE } from "@/lib/empty-value"

import {
  correspondent,
  inboxFeedParams,
  mailListParams,
  outreachBoxLabel,
  outreachParams,
  parseFocus,
} from "./mail-page-state"

describe("mail list params", () => {
  it.each([
    ["all", { dir: undefined, filter: undefined, q: undefined }],
    ["in", { dir: "in", filter: undefined, q: undefined }],
    ["out", { dir: "out", filter: undefined, q: undefined }],
    ["attn", { dir: undefined, filter: "attn", q: undefined }],
  ] as const)("maps the %s box", (box, expected) => {
    expect(outreachParams(box, undefined)).toEqual(expected)
  })

  it("keeps the default outreach view on the inactive folder's cache entry", () => {
    expect(hashKey([outreachParams("all", undefined)])).toBe(hashKey([{}]))
    expect(mailListParams("inbox", "unread", "x")).toEqual({})
  })

  it("maps inbox feed chips and falls back to all for an outreach box", () => {
    expect(inboxFeedParams("inbox", "unread", "city")).toEqual({ filter: "unread", q: "city" })
    expect(inboxFeedParams("inbox", "attn", undefined)).toEqual({ filter: "all", q: undefined })
    expect(inboxFeedParams("outreach", "unread", "city")).toEqual({ filter: "all" })
    expect(hashKey([inboxFeedParams("inbox", "all", undefined)])).toBe(hashKey([{ filter: "all" }]))
  })

  it("never carries a page limit, so the page's infinite keys never equal home's plain ones", () => {
    for (const box of ["all", "in", "out", "attn"] as const) {
      expect(outreachParams(box, "q")).not.toHaveProperty("limit")
      expect(inboxFeedParams("inbox", box, "q")).not.toHaveProperty("limit")
    }
  })

  it("labels outreach boxes and falls back to All", () => {
    expect(outreachBoxLabel("attn")).toBe("Needs attention")
    expect(outreachBoxLabel("unread")).toBe("All")
  })
})

describe("parseFocus", () => {
  it("opens Outreach with nothing picked when there is no focus", () => {
    expect(parseFocus(null)).toEqual({ folder: "outreach", id: null })
  })

  it("opens an inbox email by its feed key", () => {
    expect(parseFocus("inbox:abc")).toEqual({ folder: "inbox", id: "email:abc" })
  })

  it("opens the Inbox with nothing picked for a bare inbox prefix, so the first row is auto-picked", () => {
    expect(parseFocus("inbox:")).toEqual({ folder: "inbox", id: null })
  })

  it("treats any other focus as an outreach thread id", () => {
    expect(parseFocus("t1")).toEqual({ folder: "outreach", id: "t1" })
  })
})

function message(overrides: Partial<MailMessageDTO>): MailMessageDTO {
  return { dir: "in", from: "", to: "", ...overrides } as MailMessageDTO
}

function thread(messages: MailMessageDTO[], to = ""): MailThreadDTO {
  return { messages, to } as unknown as MailThreadDTO
}

describe("correspondent", () => {
  it("prefers the latest inbound sender", () => {
    const t = thread([
      message({ dir: "in", from: "old@city.gov" }),
      message({ dir: "out", to: "desk@city.gov" }),
      message({ dir: "in", from: "new@city.gov" }),
    ])
    expect(correspondent(t)).toBe("new@city.gov")
  })

  it("falls back to the latest outbound recipient, then the thread's address, then the empty value", () => {
    expect(correspondent(thread([message({ dir: "out", to: "desk@city.gov" })]))).toBe(
      "desk@city.gov",
    )
    expect(correspondent(thread([], "thread@city.gov"))).toBe("thread@city.gov")
    expect(correspondent(thread([]))).toBe(EMPTY_VALUE)
  })
})
