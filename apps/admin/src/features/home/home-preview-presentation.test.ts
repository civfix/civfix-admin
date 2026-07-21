import { describe, expect, it } from "vitest"

import {
  getMailPreviewPresentation,
  getModerationPreviewPresentation,
} from "./home-preview-presentation"

describe("home preview presentation", () => {
  it("keeps the reliable outreach unread total separate from loaded catch-all mail", () => {
    expect(getMailPreviewPresentation(7, 2)).toEqual({
      lead: 7,
      unit: "unread outreach messages",
      loadedInboxLabel: "Loaded catch-all unread",
      loadedInboxUnread: 2,
    })
  })

  it("labels moderation preview length as loaded rather than a queue total", () => {
    expect(getModerationPreviewPresentation(2)).toEqual({
      lead: 2,
      unit: "loaded queue items",
    })
    expect(getModerationPreviewPresentation(1).unit).toBe("loaded queue item")
  })
})
