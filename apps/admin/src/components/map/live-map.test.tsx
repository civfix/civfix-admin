import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { HomeMapPin } from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import type { LeafletMapProps } from "@/components/map/leaflet-map"
import { LiveMap } from "@/components/map/live-map"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

vi.mock("@/components/map/leaflet-map", () => ({
  LeafletMap: ({ pins = [], onPinTap }: LeafletMapProps) => (
    <div>
      {pins.map((p) => (
        <button key={p.id} type="button" onClick={() => onPinTap?.(p)}>
          {`pin ${p.id}`}
        </button>
      ))}
    </div>
  ),
}))

function reportPin(over: Partial<HomeMapPin> = {}): HomeMapPin {
  return {
    refType: "report",
    id: "r1",
    lat: 34,
    lng: -118,
    category: "graffiti",
    status: "published",
    flagged: false,
    title: "Tagged wall",
    place: "Echo Park",
    ...over,
  }
}

function eventPin(over: Partial<HomeMapPin> = {}): HomeMapPin {
  return {
    refType: "event",
    id: "e1",
    lat: 34.1,
    lng: -118.1,
    category: null,
    eventKind: "cleanup",
    status: "upcoming",
    flagged: false,
    title: "Park cleanup",
    place: "Elysian Park",
    ...over,
  }
}

async function renderMap(pins: HomeMapPin[]) {
  apiMock.adminHomeMap.mockResolvedValue({ pins })
  const user = userEvent.setup()
  const view = renderWithQuery(<LiveMap />)
  return { user, ...view }
}

async function tap(user: ReturnType<typeof userEvent.setup>, id: string): Promise<void> {
  await user.click(await screen.findByRole("button", { name: `pin ${id}` }))
}

describe("LiveMap active card", () => {
  it("titles an untitled report by its category", async () => {
    const { user } = await renderMap([reportPin({ title: "" })])
    await tap(user, "report-r1")

    expect(screen.getByText("Graffiti report")).toBeInTheDocument()
  })

  it("titles an untitled report without a category as a report", async () => {
    const { user } = await renderMap([reportPin({ title: "", category: null })])
    await tap(user, "report-r1")

    expect(screen.getByText("Report")).toBeInTheDocument()
  })

  it.each([
    ["cleanup", "Cleanup event"],
    ["other_volunteer", "Other Volunteer event"],
  ] as const)("labels a %s event pin by its kind", async (eventKind, label) => {
    const { user } = await renderMap([eventPin({ eventKind })])
    await tap(user, "event-e1")

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it("follows the tapped pin's data when the feed refetches", async () => {
    const { user, client } = await renderMap([reportPin()])
    await tap(user, "report-r1")
    expect(screen.getByText("Tagged wall")).toBeInTheDocument()

    act(() => {
      client.setQueryData(queryKeys.home.map, { pins: [reportPin({ title: "Wall repainted" })] })
    })
    expect(await screen.findByText("Wall repainted")).toBeInTheDocument()
    expect(screen.queryByText("Tagged wall")).toBeNull()
  })

  it("drops the card when the tapped pin leaves the feed", async () => {
    const { user, client } = await renderMap([reportPin(), eventPin()])
    await tap(user, "report-r1")

    act(() => {
      client.setQueryData(queryKeys.home.map, { pins: [eventPin()] })
    })
    await waitFor(() => expect(screen.queryByText("Tagged wall")).toBeNull())
    expect(screen.queryByRole("button", { name: /Open report/ })).toBeNull()
  })

  it("announces the card politely and closes it from its Close button", async () => {
    const { user } = await renderMap([reportPin()])
    await tap(user, "report-r1")

    const card = screen.getByText("Tagged wall").closest(".map-active-card") as HTMLElement
    expect(card.closest('[aria-live="polite"]')).not.toBeNull()

    await user.click(within(card).getByRole("button", { name: "Close" }))
    expect(screen.queryByText("Tagged wall")).toBeNull()
  })
})
