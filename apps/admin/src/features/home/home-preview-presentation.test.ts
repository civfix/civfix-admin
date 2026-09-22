import { describe, expect, it } from "vitest"

import {
  getMailPreviewPresentation,
  getModerationPreviewPresentation,
} from "./home-preview-presentation"

describe("home preview presentation", () => {
  it("leads the mail tile with the server-side outreach unread total", () => {
    expect(getMailPreviewPresentation(7)).toEqual({
      lead: 7,
      unit: "unread outreach messages",
    })
    expect(getMailPreviewPresentation(1).unit).toBe("unread outreach message")
  })

  it("leads the moderation tile with a label, never the preview length", () => {
    expect(getModerationPreviewPresentation()).toEqual({
      lead: null,
      unit: "held media, clusters and appeals",
    })
  })
})
