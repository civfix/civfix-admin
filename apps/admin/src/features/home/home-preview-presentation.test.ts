import { describe, expect, it } from "vitest"

import {
  mailPreviewView,
  moderationPreviewView,
} from "./home-preview-presentation"

describe("home preview presentation", () => {
  it("leads the mail tile with the server-side outreach unread total", () => {
    expect(mailPreviewView(7)).toEqual({
      lead: 7,
      unit: "unread outreach messages",
    })
    expect(mailPreviewView(1).unit).toBe("unread outreach message")
  })

  it("leads the moderation tile with a label, never the preview length", () => {
    expect(moderationPreviewView()).toEqual({
      lead: null,
      unit: "user reports, held media, clusters and appeals",
    })
  })

  it("leads the moderation tile with the server-side queue total when the summary carries one", () => {
    expect(moderationPreviewView(4)).toEqual({
      lead: 4,
      unit: "queued · user reports, held media, clusters and appeals",
    })
    expect(moderationPreviewView(0).lead).toBe(0)
  })
})
