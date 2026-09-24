import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AdminEventDTO,
  AdminEventListItemDTO,
  AdminEventListResponse,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { startFakeTimersWithUser } from "@/test/fake-timers"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { EventsPage } from "@/features/events/events-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

// Leaflet needs real layout; the minimap is irrelevant to the list/detail states pinned here.
vi.mock("@/components/map/leaflet-map", () => ({
  LeafletMap: () => <div data-testid="leaflet-map" />,
}))

function listItem(over: Partial<AdminEventListItemDTO> & { id: string; title: string }) {
  return {
    status: "upcoming",
    eventKind: "cleanup",
    flagged: false,
    place: "Lake Merritt",
    attendees: 0,
    capacity: null,
    bags: 0,
    organizer: { id: "u-org", name: "Olive Park", handle: "@olive", joined: "Mar 2026" },
    date: { rel: "in 3 days", abs: "Sep 26, 9:00 AM" },
    coords: [37.8, -122.26],
    ...over,
  } satisfies AdminEventListItemDTO
}

const BEACH = listItem({
  id: "aaaa1111-0000-4000-8000-000000000001",
  title: "Beach sweep",
  place: "Ocean Beach",
  attendees: 14,
  capacity: 20,
})
const PARK = listItem({
  id: "bbbb2222-0000-4000-8000-000000000002",
  title: "Park tidy",
  status: "completed",
  flagged: true,
  attendees: 6,
  bags: 9,
  organizer: { id: "u-sam", name: "Sam Lee", handle: "@samlee", joined: "-" },
})

const COUNTS = { all: 7, upcoming: 3, in_progress: 1, completed: 2, flagged: 1 }

function page(items: AdminEventListItemDTO[], nextCursor: string | null = null) {
  return { items, nextCursor, counts: COUNTS } satisfies AdminEventListResponse
}

function detail(item: AdminEventListItemDTO): AdminEventDTO {
  return {
    ...item,
    desc: `About ${item.title}`,
    address: `${item.place} main entrance`,
    timeline: [{ who: "Olive", what: "created the event", when: "2d ago", kind: "create" }],
    messages: [],
    linkedReports: [],
  } satisfies AdminEventDTO
}

function mockDetails(...events: AdminEventListItemDTO[]) {
  apiMock.getAdminEvent.mockImplementation(async ({ id }: { id: string }) => {
    const e = events.find((x) => x.id === id)
    if (!e) throw new Error(`no event ${id}`)
    return detail(e)
  })
}

function listCard() {
  return screen.getByRole("heading", { level: 3, name: "Events" }).closest("section") as HTMLElement
}

describe("EventsPage", () => {
  it("shows the loading state while the first page is in flight", () => {
    apiMock.listAdminEvents.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<EventsPage focusId={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading events...")
    expect(within(detailCard()).getByText("No event selected")).toBeInTheDocument()
  })

  it("shows the empty copy when no event matches", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([]))
    renderWithQuery(<EventsPage focusId={null} />)
    expect(await screen.findByText("Nothing matches")).toBeInTheDocument()
    expect(screen.getByText("Try a different filter or search.")).toBeInTheDocument()
    expect(within(detailCard()).getByText("Pick an event from the list.")).toBeInTheDocument()
  })

  it("shows the error state with the failure message and a retry", async () => {
    apiMock.listAdminEvents.mockRejectedValue(new Error("Events backend unreachable"))
    renderWithQuery(<EventsPage focusId={null} />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("Events backend unreachable")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("renders rows with key fields and auto-selects the first event into the detail pane", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH, PARK]))
    mockDetails(BEACH, PARK)
    renderWithQuery(<EventsPage focusId={null} />)

    await screen.findByText("Beach sweep")
    const list = listCard()
    expect(within(list).getByText("#aaaa1111")).toBeInTheDocument()
    expect(within(list).getByText("Ocean Beach")).toBeInTheDocument()
    expect(within(list).getByText("14 attending")).toBeInTheDocument()
    expect(within(list).getByText("Olive")).toBeInTheDocument()
    expect(within(list).getByText("Sam")).toBeInTheDocument()
    expect(within(list).getByText("Upcoming")).toBeInTheDocument()
    expect(within(list).getAllByText("Sep 26, 9:00 AM")).toHaveLength(2)
    expect(within(list).getByText("Park tidy")).toBeInTheDocument()
    expect(within(list).getByText("Completed")).toBeInTheDocument()
    expect(within(list).getByTitle("Flagged")).toBeInTheDocument()
    expect(apiMock.listAdminEvents).toHaveBeenCalledWith({})

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "Beach sweep" })).toBeInTheDocument()
    expect(within(card).getByText("#aaaa1111 · Cleanup")).toBeInTheDocument()
    expect(within(card).getByText("About Beach sweep")).toBeInTheDocument()
    expect(within(card).getByText("Ocean Beach main entrance")).toBeInTheDocument()
    expect(within(card).getByText("created the event")).toBeInTheDocument()
    expect(within(card).getByText("No linked reports")).toBeInTheDocument()
    expect(within(card).getByText("Olive Park")).toBeInTheDocument()
    expect(within(card).getByPlaceholderText("Post an update to 14 attendees…")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Cancel event/ })).toBeEnabled()
    expect(apiMock.getAdminEvent).toHaveBeenCalledWith({ id: BEACH.id })
  })

  it("opens the clicked event in the detail pane", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH, PARK]))
    mockDetails(BEACH, PARK)
    renderWithQuery(<EventsPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Beach sweep" })

    await userEvent.click(within(listCard()).getByText("Park tidy"))

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "Park tidy" })).toBeInTheDocument()
    // Both the status badge and the toggled flag button read "Flagged".
    expect(within(card).getAllByText("Flagged")).toHaveLength(2)
    expect(within(card).getByRole("button", { name: "Flagged" })).toBeInTheDocument()
    expect(within(card).getByText("9")).toBeInTheDocument()
    expect(within(card).getByText(/bags collected/)).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Cancel event/ })).toBeDisabled()
    expect(apiMock.getAdminEvent).toHaveBeenCalledWith({ id: PARK.id })
  })

  it("shows the facet counts on the filter chips", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH]))
    mockDetails(BEACH)
    renderWithQuery(<EventsPage focusId={null} />)
    await screen.findByText("Beach sweep")
    expect(screen.getByRole("button", { name: "All 7" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "In progress 1" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Flagged 1" })).toBeInTheDocument()
  })

  it("sends the chosen filter chip to the api", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH]))
    mockDetails(BEACH)
    renderWithQuery(<EventsPage focusId={null} />)
    await screen.findByText("Beach sweep")

    await userEvent.click(screen.getByRole("button", { name: /^In progress/ }))
    await waitFor(() =>
      expect(apiMock.listAdminEvents).toHaveBeenLastCalledWith({ filter: "in_progress" }),
    )

    await userEvent.click(screen.getByRole("button", { name: /^Flagged/ }))
    await waitFor(() =>
      expect(apiMock.listAdminEvents).toHaveBeenLastCalledWith({ filter: "flagged" }),
    )
  })

  it("sends the trimmed search text to the api after the debounce", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH]))
    mockDetails(BEACH)
    renderWithQuery(<EventsPage focusId={null} />)
    await screen.findByText("Beach sweep")

    const user = startFakeTimersWithUser()
    await user.type(screen.getByPlaceholderText("Search title, place, organizer…"), " beach ")
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(apiMock.listAdminEvents).toHaveBeenLastCalledWith({ q: "beach" })
  })

  it("shows Load more when a cursor is returned and fetches the next page with it", async () => {
    apiMock.listAdminEvents.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "ev-2" ? page([PARK]) : page([BEACH], "ev-2"),
    )
    mockDetails(BEACH, PARK)
    renderWithQuery(<EventsPage focusId={null} />)
    await screen.findByText("Beach sweep")

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(listCard()).findByText("Park tidy")).toBeInTheDocument()
    expect(apiMock.listAdminEvents).toHaveBeenLastCalledWith({ cursor: "ev-2" })
    expect(within(listCard()).getByText("Beach sweep")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("opens a deep-linked focusId that is on the first page", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH, PARK]))
    mockDetails(BEACH, PARK)
    renderWithQuery(<EventsPage focusId={PARK.id} />)
    expect(await within(detailCard()).findByRole("heading", { name: "Park tidy" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Beach sweep" })).not.toBeInTheDocument()
  })

  it("replaces a deep-linked focusId that is not on the first page with the first row (current behavior)", async () => {
    const OTHER = listItem({ id: "cccc3333-0000-4000-8000-000000000003", title: "Creek haul" })
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH, PARK]))
    mockDetails(BEACH, PARK, OTHER)
    renderWithQuery(<EventsPage focusId={OTHER.id} />)
    expect(await within(detailCard()).findByRole("heading", { name: "Beach sweep" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Creek haul" })).not.toBeInTheDocument()
  })
})
