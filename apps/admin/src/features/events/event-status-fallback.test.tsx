import { screen, within } from "@testing-library/react"
import type {
  AdminEventDTO,
  AdminEventListItemDTO,
  AdminEventListResponse,
  EventStatus,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard, listCard } from "@/test/panes"
import { EventsPage } from "@/features/events/events-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

vi.mock("@/components/map/leaflet-map", () => ({
  LeafletMap: () => <div data-testid="leaflet-map" />,
}))

// The client passes a response through unparsed when it fails the schema, so a status added to the
// contract after this build still reaches the page.
const POSTPONED = {
  id: "aaaa1111-0000-4000-8000-000000000001",
  title: "Beach sweep",
  status: "postponed" as EventStatus,
  eventKind: "cleanup",
  flagged: false,
  place: "Ocean Beach",
  attendees: 4,
  capacity: null,
  bags: 0,
  organizer: { id: "u-org", name: "Olive Park", handle: "@olive", joined: "Mar 2026" },
  date: { rel: "in 3 days", abs: "Sep 26, 9:00 AM" },
  coords: [37.8, -122.26],
} satisfies AdminEventListItemDTO

describe("EventsPage with an event status this build does not know", () => {
  it("renders the raw status in a neutral pill in the list and the detail pane", async () => {
    apiMock.listAdminEvents.mockResolvedValue({
      items: [POSTPONED],
      nextCursor: null,
      counts: { all: 1, upcoming: 0, in_progress: 0, completed: 0, flagged: 0 },
    } satisfies AdminEventListResponse)
    apiMock.getAdminEvent.mockResolvedValue({
      ...POSTPONED,
      desc: "About the sweep",
      address: "Ocean Beach main entrance",
      timeline: [],
      messages: [],
      linkedReports: [],
    } satisfies AdminEventDTO)

    renderWithQuery(<EventsPage focusId={null} />)

    const listPill = await within(listCard()).findByText("postponed")
    expect(listPill).toHaveClass("pill", "priority-low")
    expect(within(listCard()).queryByText("Upcoming")).toBeNull()

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "Beach sweep" })).toBeInTheDocument()
    expect(within(card).getByText("postponed")).toHaveClass("pill", "priority-low")
    expect(screen.queryByText("Upcoming", { selector: ".pill" })).toBeNull()
  })
})
