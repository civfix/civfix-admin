import { describe, expect, it } from "vitest"
import type { EventPageDTO } from "@civfix/shared"

import { pageListParams, pageRowFromDTO } from "./pages-filters"

function page(over: Partial<EventPageDTO>): EventPageDTO {
  return {
    cleanupId: "c1",
    slug: "echo-park-cleanup",
    status: "published",
    theme: { accent: "bloom" },
    blocks: [],
    seo: { noindex: false },
    visibility: "public",
    ...over,
  }
}

describe("signup page list params", () => {
  it("sends nothing but the search for the all chip", () => {
    expect(pageListParams("all", "  echo park ")).toEqual({ q: "echo park" })
  })

  it("maps the flagged chip to the boolean facet, not a status", () => {
    expect(pageListParams("flagged", "")).toEqual({ flagged: true, q: undefined })
  })

  it("maps each page status chip to the status facet", () => {
    expect(pageListParams("published", "")).toEqual({ status: "published", q: undefined })
    expect(pageListParams("unpublished", "")).toEqual({ status: "unpublished", q: undefined })
    expect(pageListParams("draft", "")).toEqual({ status: "draft", q: undefined })
  })

  it("drops an unknown chip instead of sending it", () => {
    expect(pageListParams("bogus", "x")).toEqual({ q: "x" })
  })
})

describe("deep-linked page row", () => {
  it("carries the moderation fields the detail header renders", () => {
    const row = pageRowFromDTO(
      page({
        status: "unpublished",
        viewCount: 12,
        publishedAt: "2026-05-01T00:00:00.000Z",
        flaggedAt: "2026-06-01T00:00:00.000Z",
        flagReason: "impersonates a city agency",
      }),
    )
    expect(row.cleanupId).toBe("c1")
    expect(row.status).toBe("unpublished")
    expect(row.viewCount).toBe(12)
    expect(row.flaggedAt).toBe("2026-06-01T00:00:00.000Z")
    expect(row.flagReason).toBe("impersonates a city agency")
  })

  it("titles a page from its SEO title, then its slug, then a neutral label", () => {
    expect(pageRowFromDTO(page({ seo: { title: "Echo Park cleanup", noindex: false } })).title).toBe(
      "Echo Park cleanup",
    )
    expect(pageRowFromDTO(page({})).title).toBe("/e/echo-park-cleanup")
    expect(pageRowFromDTO(page({ slug: null })).title).toBe("Signup page")
  })

  it("defaults the counters and actor refs the list read would have carried", () => {
    const row = pageRowFromDTO(page({}))
    expect(row.viewCount).toBe(0)
    expect(row.organizer).toBeNull()
    expect(row.orgName).toBeNull()
    expect(row.flaggedBy).toBeNull()
  })
})
