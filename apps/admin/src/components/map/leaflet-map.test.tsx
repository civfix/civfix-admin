import { fireEvent, render } from "@testing-library/react"
import L from "leaflet"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BoundaryMap } from "@/components/map/boundary-map"
import { LeafletMap, type MapPin } from "@/components/map/leaflet-map"

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

  it("renders markup in a pin title (current behavior: tooltip string is parsed as HTML)", () => {
    const pin: MapPin = { id: "h", lat: 34, lng: -118, tip: "<b>x</b>", place: "<i>y</i>" }
    const { container } = render(<LeafletMap pins={[pin]} />)

    const tip = hoverAndReadTooltip(container, markerIcons(container)[0]!)
    expect(tip?.querySelector("b")?.textContent).toBe("x")
    expect(tip?.querySelector("i")?.textContent).toBe("y")
    expect(tip?.textContent).toBe("x · y")
    expect(tip?.textContent).not.toContain("<b>")
  })

  it("calls onPinTap with the tapped pin", () => {
    const onPinTap = vi.fn()
    const { container } = render(<LeafletMap pins={PINS} onPinTap={onPinTap} />)

    fireEvent.click(markerIcons(container)[2]!)
    expect(onPinTap).toHaveBeenCalledTimes(1)
    expect(onPinTap).toHaveBeenCalledWith(PINS[2])
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
