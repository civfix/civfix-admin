import { describe, expect, it } from "vitest"
import type { EventPageBlock } from "@civfix/shared"

import { pageBlockView, pageBlockViews } from "./page-blocks"

describe("signup page block extraction", () => {
  it("strips markdown emphasis and links down to plain text", () => {
    const block: EventPageBlock = {
      id: "b1",
      kind: "about",
      title: "About **us**",
      body: "We clean *Echo Park* every [Saturday](https://civfix.org/e/echo-park).",
    }
    const view = pageBlockView(block)
    expect(view.title).toBe("About us")
    expect(view.lines).toEqual(["We clean Echo Park every Saturday."])
    expect(view.label).toBe("About")
  })

  it("flattens agenda items into time-prefixed lines", () => {
    const view = pageBlockView({
      id: "b2",
      kind: "agenda",
      items: [
        { time: "9:00", title: "Check-in", description: "Grab a bag" },
        { time: null, title: "Cleanup" },
      ],
    })
    expect(view.lines).toEqual(["9:00 · Check-in", "Grab a bag", "Cleanup"])
  })

  it("collects outbound links without duplicating them", () => {
    const view = pageBlockView({
      id: "b3",
      kind: "sponsors",
      entries: [
        { name: "Acme", url: "https://acme.test" },
        { name: "Acme Again", url: "https://acme.test" },
        { name: "No link" },
      ],
    })
    expect(view.lines).toEqual(["Acme", "Acme Again", "No link"])
    expect(view.links).toEqual(["https://acme.test"])
  })

  it("drops empty text rather than rendering blank rows", () => {
    const view = pageBlockView({ id: "b4", kind: "location", title: null, note: "   ", showMap: true })
    expect(view.title).toBeNull()
    expect(view.lines).toEqual([])
  })

  it("maps every block in document order", () => {
    const views = pageBlockViews([
      { id: "a", kind: "hero", headline: "Come clean up" },
      { id: "b", kind: "registration", note: "Doors at 8" },
    ])
    expect(views.map((v) => v.id)).toEqual(["a", "b"])
    expect(views[0]!.title).toBe("Come clean up")
  })
})
