import { fireEvent, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import L from "leaflet"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BoundaryMap } from "@/components/map/boundary-map"
import { LeafletMap, tooltipText, type MapPin } from "@/components/map/leaflet-map"

// jsdom has no layout engine: Leaflet sizes the map from clientWidth/clientHeight (0 in jsdom, which
// makes fitBounds produce NaN coordinates) and the wrappers observe their container for resizes.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const PINS: MapPin[] = [
  { id: "r1", lat: 34.05, lng: -118.25, category: "pothole", tip: "Deep pothole", place: "Los Angeles" },
  { id: "r2", lat: 34.06, lng: -118.24, category: "graffiti", draft: true, label: "Tagged wall" },
  { id: "e1", lat: 34.07, lng: -118.23, kind: "event", tip: "Park cleanup" },
]

function markerIcons(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".leaflet-marker-icon")]
}

function hoverAndReadTooltip(container: HTMLElement, icon: HTMLElement): HTMLElement | null {
  fireEvent.mouseOver(icon)
  return container.querySelector<HTMLElement>(".leaflet-tooltip")
}

describe("LeafletMap", () => {
  it("renders one marker per pin with the state-specific pin markup", () => {
    const { container } = render(<LeafletMap pins={PINS} />)

    const icons = markerIcons(container)
    expect(icons).toHaveLength(3)
    expect(icons.map((el) => el.querySelector(".pi-pin2")?.className)).toEqual([
      "pi-pin2 routed",
      "pi-pin2 needs",
      "pi-pin2 event",
    ])
    for (const el of icons) expect(el).toHaveClass("pi-pin2-wrap")
  })

  it("renders the active pin with the active treatment", () => {
    const { container } = render(<LeafletMap pins={PINS} activeId="r2" />)

    const active = container.querySelectorAll(".pi-pin2.is-active")
    expect(active).toHaveLength(1)
    expect(active[0]).toHaveClass("needs")
  })

  it("reconciles markers when the pin list changes", () => {
    const { container, rerender } = render(<LeafletMap pins={PINS} />)
    expect(markerIcons(container)).toHaveLength(3)

    rerender(<LeafletMap pins={PINS.slice(0, 1)} />)
    expect(markerIcons(container)).toHaveLength(1)
  })

  it("shows the title and place in the tooltip, joined by a middle dot", () => {
    const { container } = render(<LeafletMap pins={PINS} />)

    const tip = hoverAndReadTooltip(container, markerIcons(container)[0]!)
    expect(tip).not.toBeNull()
    expect(tip).toHaveClass("pi-map-tip")
    expect(tip).toHaveTextContent("Deep pothole · Los Angeles")
  })

  it("falls back to the label when a pin has no tip and omits the place suffix", () => {
    const { container } = render(<LeafletMap pins={PINS} />)

    const tip = hoverAndReadTooltip(container, markerIcons(container)[1]!)
    expect(tip?.textContent).toBe("Tagged wall")
  })

  it("binds no tooltip for a pin with neither tip nor label", () => {
    const { container } = render(<LeafletMap pins={[{ id: "x", lat: 34, lng: -118 }]} />)

    const tip = hoverAndReadTooltip(container, markerIcons(container)[0]!)
    expect(tip).toBeNull()
  })

  it("renders a pin title and place in the tooltip as literal text, never as markup", () => {
    const pin: MapPin = { id: "h", lat: 34, lng: -118, tip: "<b>x</b>", place: "<i>y</i>" }
    const { container } = render(<LeafletMap pins={[pin]} />)

    const tip = hoverAndReadTooltip(container, markerIcons(container)[0]!)
    expect(tip?.querySelector("b")).toBeNull()
    expect(tip?.querySelector("i")).toBeNull()
    expect(tip?.textContent).toBe("<b>x</b> · <i>y</i>")
  })

  it("never runs markup from a citizen-authored title in the tooltip", () => {
    const payload = '<img src=x onerror="window.__pwned=1">'
    const pin: MapPin = { id: "x", lat: 34, lng: -118, tip: payload, place: "<svg onload=alert(1)>" }
    const { container } = render(<LeafletMap pins={[pin]} />)

    const tip = hoverAndReadTooltip(container, markerIcons(container)[0]!)
    expect(tip?.querySelector("img, svg")).toBeNull()
    expect(tip?.textContent).toBe(`${payload} · <svg onload=alert(1)>`)
  })

  it("keeps a label with entity-like text literal in the tooltip", () => {
    const pin: MapPin = { id: "a", lat: 34, lng: -118, label: "Fish &amp; Chips" }
    const { container } = render(<LeafletMap pins={[pin]} />)

    const tip = hoverAndReadTooltip(container, markerIcons(container)[0]!)
    expect(tip?.textContent).toBe("Fish &amp; Chips")
  })

  it.each(["constructor", "toString", "__proto__"])(
    "draws the generic glyph for the inherited object key %j as a category",
    (category) => {
      const { container } = render(
        <LeafletMap
          pins={[
            { id: "g", lat: 34, lng: -118, category },
            { id: "o", lat: 34.1, lng: -118.1, category: "other" },
          ]}
        />,
      )

      const glyphs = markerIcons(container).map((el) => el.querySelector("g path")?.getAttribute("d"))
      expect(glyphs[0]).toBe(glyphs[1])
    },
  )

  it("calls onPinTap with the tapped pin", () => {
    const onPinTap = vi.fn()
    const { container } = render(<LeafletMap pins={PINS} onPinTap={onPinTap} />)

    fireEvent.click(markerIcons(container)[2]!)
    expect(onPinTap).toHaveBeenCalledTimes(1)
    expect(onPinTap).toHaveBeenCalledWith(PINS[2])
  })

  it("updates a pin's tooltip when its title changes under the same id", () => {
    const { container, rerender } = render(<LeafletMap pins={PINS} />)
    hoverAndReadTooltip(container, markerIcons(container)[0]!)

    rerender(<LeafletMap pins={[{ ...PINS[0]!, tip: "Filled pothole" }, ...PINS.slice(1)]} />)
    const tip = hoverAndReadTooltip(container, markerIcons(container)[0]!)
    expect(tip?.textContent).toBe("Filled pothole · Los Angeles")
  })

  it("binds a tooltip when a pin gains a title and drops it when the title goes", () => {
    const bare: MapPin = { id: "x", lat: 34, lng: -118 }
    const { container, rerender } = render(<LeafletMap pins={[bare]} />)

    rerender(<LeafletMap pins={[{ ...bare, tip: "Now titled" }]} />)
    expect(hoverAndReadTooltip(container, markerIcons(container)[0]!)?.textContent).toBe("Now titled")

    fireEvent.mouseOut(markerIcons(container)[0]!)
    rerender(<LeafletMap pins={[bare]} />)
    expect(hoverAndReadTooltip(container, markerIcons(container)[0]!)).toBeNull()
  })

  it("hands onPinTap the pin's latest data after a refetch", () => {
    const onPinTap = vi.fn()
    const { container, rerender } = render(<LeafletMap pins={PINS} onPinTap={onPinTap} />)
    const refetched: MapPin = { ...PINS[2]!, tip: "Park cleanup (moved)" }

    rerender(<LeafletMap pins={[PINS[0]!, PINS[1]!, refetched]} onPinTap={onPinTap} />)
    fireEvent.click(markerIcons(container)[2]!)
    expect(onPinTap).toHaveBeenCalledWith(refetched)
  })

  it("names each interactive marker by its tooltip text", () => {
    const { container } = render(<LeafletMap pins={PINS} />)

    const icons = markerIcons(container)
    expect(icons.map((el) => el.getAttribute("role"))).toEqual(["button", "button", "button"])
    expect(icons.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Deep pothole · Los Angeles",
      "Tagged wall",
      "Park cleanup",
    ])
  })

  it("renames a marker when its title changes", () => {
    const { container, rerender } = render(<LeafletMap pins={PINS} />)

    rerender(<LeafletMap pins={[{ ...PINS[0]!, tip: "Filled pothole" }]} />)
    expect(markerIcons(container)[0]).toHaveAttribute("aria-label", "Filled pothole · Los Angeles")
  })

  it("keeps markers of a non-interactive map out of the tab order", () => {
    const { container } = render(<LeafletMap pins={PINS} interactive={false} />)

    for (const el of markerIcons(container)) {
      expect(el).not.toHaveAttribute("tabindex")
      expect(el).not.toHaveAttribute("role")
    }
  })

  it.each(["{Enter}", " "])("activates a focused marker with %j like a tap", async (key) => {
    const onPinTap = vi.fn()
    const { container } = render(<LeafletMap pins={PINS} onPinTap={onPinTap} />)

    const icon = markerIcons(container)[1]!
    icon.focus()
    await userEvent.setup().keyboard(key)
    expect(onPinTap).toHaveBeenCalledTimes(1)
    expect(onPinTap).toHaveBeenCalledWith(PINS[1])
  })

  it("moves the view when the center or zoom props change", () => {
    const setView = vi.spyOn(L.Map.prototype, "setView")
    const { rerender } = render(<LeafletMap pins={PINS} center={[34, -118]} zoom={10} />)

    rerender(<LeafletMap pins={PINS} center={[40.7, -74]} zoom={12} />)
    expect(setView).toHaveBeenLastCalledWith([40.7, -74], 12)
  })

  it("removes the Leaflet map on unmount", () => {
    const remove = vi.spyOn(L.Map.prototype, "remove")
    const { unmount } = render(<LeafletMap pins={PINS} />)
    expect(remove).not.toHaveBeenCalled()

    unmount()
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

describe("BoundaryMap", () => {
  const square = {
    type: "Polygon",
    coordinates: [
      [
        [-118.3, 34.0],
        [-118.2, 34.0],
        [-118.2, 34.1],
        [-118.3, 34.1],
        [-118.3, 34.0],
      ],
    ],
  }
  const bbox: [number, number, number, number] = [-118.3, 34.0, -118.2, 34.1]

  it("draws the boundary polygon", () => {
    const { container } = render(<BoundaryMap geometry={square} bbox={bbox} layer="county" />)

    const path = container.querySelector("path.leaflet-interactive")
    expect(path).not.toBeNull()
    expect(path).toHaveAttribute("stroke", "#3F7CAC")
  })

  it("removes the Leaflet map on unmount", () => {
    const remove = vi.spyOn(L.Map.prototype, "remove")
    const { unmount } = render(<BoundaryMap geometry={square} bbox={bbox} />)
    expect(remove).not.toHaveBeenCalled()

    unmount()
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

describe("tooltipText", () => {
  it("joins the title and place with a middle dot", () => {
    expect(tooltipText({ id: "1", lat: 0, lng: 0, tip: "Pothole", place: "Oakland" })).toBe(
      "Pothole · Oakland",
    )
  })

  it("falls back to the label and omits a missing place", () => {
    expect(tooltipText({ id: "1", lat: 0, lng: 0, label: "Wall" })).toBe("Wall")
  })

  it("returns null when there is no title to show", () => {
    expect(tooltipText({ id: "1", lat: 0, lng: 0, place: "Oakland" })).toBeNull()
  })
})
