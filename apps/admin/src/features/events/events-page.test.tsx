import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AdminEventDTO,
  AdminEventListItemDTO,
  AdminEventListResponse,
  AdminReportListItemDTO,
  AdminReportListResponse,
} from "@civfix/shared"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { startFakeTimersWithUser } from "@/test/fake-timers"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { DialogHost } from "@/components/shared/dialog"
import { EventsPage } from "@/features/events/events-page"
import { useUiStore } from "@/store/ui-store"

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

  it("keeps a deep-linked focusId that is not on the first page", async () => {
    const OTHER = listItem({ id: "cccc3333-0000-4000-8000-000000000003", title: "Creek haul" })
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH, PARK]))
    mockDetails(BEACH, PARK, OTHER)
    renderWithQuery(<EventsPage focusId={OTHER.id} />)
    expect(await within(detailCard()).findByRole("heading", { name: "Creek haul" })).toBeInTheDocument()
    await screen.findByText("Beach sweep")
    expect(within(detailCard()).getByRole("heading", { name: "Creek haul" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Beach sweep" })).not.toBeInTheDocument()
    expect(apiMock.getAdminEvent).toHaveBeenCalledWith({ id: OTHER.id })
  })
})

function renderPage(focusId: string | null = null) {
  return renderWithQuery(
    <>
      <EventsPage focusId={focusId} />
      <DialogHost />
    </>,
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const LIVE = listItem({
  id: "dddd4444-0000-4000-8000-000000000004",
  title: "Creek haul",
  status: "in_progress",
  attendees: 1,
  bags: 1,
})

function report(id: string, title: string): AdminReportListItemDTO {
  return {
    id,
    title,
    category: "trash",
    status: "published",
    flagged: false,
    place: "Ocean Beach",
    reporter: { id: "u-rita", name: "Rita Gomez", handle: "@rita", joined: "Feb 2026" },
    confirmations: 0,
    submitted: { rel: "3h", abs: "Sep 23, 2026, 9:00 AM" },
    coords: [37.8, -122.26],
    address: "Great Hwy",
    hasPhoto: false,
    thumbnailUrl: null,
  }
}

const PIER = report("eeee5555-0000-4000-8000-000000000005", "Trash pile by the pier")
const DUNE = report("ffff6666-0000-4000-8000-000000000006", "Bottles in the dunes")
const REPORT_COUNTS = { all: 2, submitted: 2, in_progress: 0, completed: 0, flagged: 0 }

function reportPage(items: AdminReportListItemDTO[], nextCursor: string | null = null) {
  return { items, nextCursor, counts: REPORT_COUNTS } satisfies AdminReportListResponse
}

describe("EventsPage correctness and accessibility", () => {
  beforeEach(() => {
    useUiStore.setState({ page: "events", focusId: null, toast: null })
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    return () => {
      scrollTo.mockRestore()
      window.history.replaceState(null, "", "#/")
    }
  })

  it("selects a row from the keyboard and marks it current", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH, PARK]))
    mockDetails(BEACH, PARK)
    const user = userEvent.setup()
    renderPage()
    await within(detailCard()).findByRole("heading", { name: BEACH.title })

    const parkRow = within(listCard()).getByRole("button", { name: /Park tidy/ })
    parkRow.focus()
    await user.keyboard(" ")
    expect(await within(detailCard()).findByRole("heading", { name: PARK.title })).toBeInTheDocument()
    expect(parkRow).toHaveAttribute("aria-current", "true")
    expect(within(listCard()).getByRole("button", { name: /Beach sweep/ })).not.toHaveAttribute(
      "aria-current",
    )
  })

  it("opens the organizer profile with Space", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH]))
    mockDetails(BEACH)
    const user = userEvent.setup()
    renderPage()
    await within(detailCard()).findByRole("heading", { name: BEACH.title })

    within(listCard()).getByRole("button", { name: "Olive" }).focus()
    await user.keyboard(" ")

    expect(useUiStore.getState()).toMatchObject({ page: "users", focusId: "u-org" })
  })

  it("names the kind and flagged markers for assistive tech", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH, PARK]))
    mockDetails(BEACH, PARK)
    renderPage()
    await screen.findByText(PARK.title)
    expect(within(listCard()).getByRole("img", { name: "Flagged" })).toBeInTheDocument()
    expect(within(listCard()).getAllByRole("img", { name: "Cleanup" })).toHaveLength(2)
  })

  it("heads the list with the server total for the active filter, not the rows loaded", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH], "ev-2"))
    mockDetails(BEACH)
    renderPage()
    await screen.findByText(BEACH.title)
    expect(within(listCard()).getByText("7")).toBeInTheDocument()
  })

  it("keeps an event the operator picked when a filter drops it from the list", async () => {
    apiMock.listAdminEvents.mockImplementation(async (params: { filter?: string }) =>
      params.filter === "upcoming" ? page([BEACH]) : page([BEACH, PARK]),
    )
    mockDetails(BEACH, PARK)
    const user = userEvent.setup()
    renderPage()
    await within(detailCard()).findByRole("heading", { name: BEACH.title })

    await user.click(within(listCard()).getByText(PARK.title))
    await within(detailCard()).findByRole("heading", { name: PARK.title })
    await user.click(screen.getByRole("button", { name: /^Upcoming/ }))
    await waitFor(() =>
      expect(within(listCard()).queryByText(PARK.title)).not.toBeInTheDocument(),
    )

    expect(within(detailCard()).getByRole("heading", { name: PARK.title })).toBeInTheDocument()
  })

  it("does not jump to another event after cancelling the selected one", async () => {
    let cancelled = false
    apiMock.listAdminEvents.mockImplementation(async () =>
      page(cancelled ? [PARK] : [BEACH, PARK]),
    )
    mockDetails(BEACH, PARK)
    apiMock.cancelEvent.mockImplementation(async () => {
      cancelled = true
      return { ok: true }
    })
    const user = userEvent.setup()
    renderPage()
    await within(detailCard()).findByRole("heading", { name: BEACH.title })

    await user.click(within(detailCard()).getByRole("button", { name: /Cancel event/ }))
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel event" }),
    )

    expect(await within(detailCard()).findByText("No event selected")).toBeInTheDocument()
    await waitFor(() =>
      expect(within(listCard()).queryByText(BEACH.title)).not.toBeInTheDocument(),
    )
    expect(within(detailCard()).getByText("No event selected")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: PARK.title })).not.toBeInTheDocument()
  })

  it("shows why Cancel is blocked as visible text tied to the button", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([PARK]))
    mockDetails(PARK)
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: PARK.title })

    const reason = "This event has already ended and can't be cancelled."
    expect(within(card).getByText(reason)).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Cancel event/ })).toHaveAccessibleDescription(reason)
  })

  it("posts an attendee update once when Cmd+Enter is pressed again while it is sending", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH]))
    mockDetails(BEACH)
    const post = deferred<{ ok: true }>()
    apiMock.postEventMessage.mockReturnValue(post.promise)
    const user = userEvent.setup()
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: BEACH.title })

    const box = within(card).getByRole("textbox", { name: "Update for attendees" })
    await user.type(box, "Meet at the north lot")
    await user.keyboard("{Meta>}{Enter}{/Meta}")
    await waitFor(() => expect(within(card).getByRole("button", { name: "Post update" })).toBeDisabled())
    await user.keyboard("{Meta>}{Enter}{/Meta}")
    await user.keyboard("{Control>}{Enter}{/Control}")

    expect(apiMock.postEventMessage).toHaveBeenCalledTimes(1)
    await act(async () => {
      post.resolve({ ok: true })
    })
  })

  it("labels the attendee message box, caps it at the contract length and declares its shortcut", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH]))
    mockDetails(BEACH)
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: BEACH.title })

    expect(screen.getByRole("textbox", { name: "Search events" })).toBeInTheDocument()
    const box = within(card).getByRole("textbox", { name: "Update for attendees" })
    expect(box).toHaveAttribute("maxlength", "4000")
    expect(box).toHaveAttribute("aria-keyshortcuts", "Meta+Enter Control+Enter")
    expect(within(card).getByRole("button", { name: "Post update" })).toBeInTheDocument()
  })

  it("pluralizes the bag and attendee counts", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([LIVE]))
    mockDetails(LIVE)
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: LIVE.title })

    expect(within(card).getByText(/bag collected/)).toHaveTextContent("1 bag collected")
    expect(within(card).getByPlaceholderText("Post an update to 1 attendee…")).toBeInTheDocument()
  })

  it("refuses a fractional bag count and saves an exponent one at its real value", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([LIVE]))
    mockDetails(LIVE)
    apiMock.setEventOutcome.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: LIVE.title })
    const bags = within(card).getByRole("spinbutton", { name: "Bags collected" })
    const log = within(card).getByRole("button", { name: "Update outcome" })

    await user.type(bags, "2.5")
    expect(log).toBeDisabled()
    await user.click(log)
    expect(apiMock.setEventOutcome).not.toHaveBeenCalled()

    await user.clear(bags)
    await user.type(bags, "1e3")
    await user.click(log)
    await waitFor(() =>
      expect(apiMock.setEventOutcome).toHaveBeenCalledWith({ id: LIVE.id, bags: 1000 }),
    )
    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe("Outcome logged · 1000 bags"))

    await user.type(bags, "1")
    await user.click(log)
    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe("Outcome logged · 1 bag"))
  })

  it("words the flag toast from the refetched event, not the cached one", async () => {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH]))
    mockDetails(BEACH)
    apiMock.flagEvent.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: BEACH.title })

    // Another operator flagged it first, so this toggle cleared the flag and the refetch says so.
    await user.click(within(card).getByRole("button", { name: "Flag" }))

    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe("#aaaa1111 · flag cleared"))
  })
})

describe("EventsPage link-reports picker", () => {
  beforeEach(() => {
    useUiStore.setState({ page: "events", focusId: null, toast: null })
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    return () => {
      scrollTo.mockRestore()
      window.history.replaceState(null, "", "#/")
    }
  })

  async function openPicker() {
    apiMock.listAdminEvents.mockResolvedValue(page([BEACH]))
    mockDetails(BEACH)
    const user = userEvent.setup()
    renderPage()
    await within(detailCard()).findByRole("heading", { name: BEACH.title })
    await user.click(within(detailCard()).getByRole("button", { name: /Link reports/ }))
    return { user, dialog: screen.getByRole("dialog", { name: "Link reports" }) }
  }

  it("exposes each report row as a pressed or unpressed toggle", async () => {
    apiMock.listAdminReports.mockResolvedValue(reportPage([PIER]))
    const { user, dialog } = await openPicker()

    const row = await within(dialog).findByRole("button", { name: /Trash pile by the pier/, pressed: false })
    await user.click(row)
    expect(within(dialog).getByRole("button", { name: /Trash pile by the pier/, pressed: true })).toBe(row)
  })

  it("loads more reports past the first page", async () => {
    apiMock.listAdminReports.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "rp-2" ? reportPage([DUNE]) : reportPage([PIER], "rp-2"),
    )
    const { user, dialog } = await openPicker()
    await within(dialog).findByText(PIER.title)

    await user.click(within(dialog).getByRole("button", { name: "Load more" }))

    expect(await within(dialog).findByText(DUNE.title)).toBeInTheDocument()
    expect(within(dialog).getByText(PIER.title)).toBeInTheDocument()
    expect(apiMock.listAdminReports).toHaveBeenLastCalledWith({ cursor: "rp-2" })
  })

  it("searches once per pause in typing, not once per keystroke", async () => {
    apiMock.listAdminReports.mockResolvedValue(reportPage([PIER]))
    const { user, dialog } = await openPicker()
    await within(dialog).findByText(PIER.title)

    await user.type(within(dialog).getByRole("textbox", { name: "Search reports to link" }), "pier")

    await waitFor(() => expect(apiMock.listAdminReports).toHaveBeenLastCalledWith({ q: "pier" }))
    expect(apiMock.listAdminReports).not.toHaveBeenCalledWith({ q: "p" })
    expect(apiMock.listAdminReports).not.toHaveBeenCalledWith({ q: "pie" })
  })
})
