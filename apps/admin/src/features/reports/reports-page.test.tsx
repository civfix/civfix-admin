import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AdminReportDTO,
  AdminReportListItemDTO,
  AdminReportListResponse,
  ChatHistoryResponse,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { ReportsPage } from "@/features/reports/reports-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

// Leaflet needs real layout; the minimap is irrelevant to the list/detail states pinned here.
vi.mock("@/components/map/leaflet-map", () => ({
  LeafletMap: () => <div data-testid="leaflet-map" />,
}))

function listItem(over: Partial<AdminReportListItemDTO> & { id: string; title: string }) {
  return {
    category: "trash",
    status: "published",
    flagged: false,
    place: "Temescal",
    reporter: { id: "u-rita", name: "Rita Gomez", handle: "@rita", joined: "Feb 2026" },
    confirmations: 0,
    submitted: { rel: "3h", abs: "Sep 23, 2026, 9:00 AM" },
    coords: [37.83, -122.26],
    address: "4900 Telegraph Ave",
    hasPhoto: false,
    thumbnailUrl: null,
    ...over,
  } satisfies AdminReportListItemDTO
}

const COUCH = listItem({
  id: "r1a2b3c4-0000-4000-8000-000000000001",
  title: "Couch dumped on sidewalk",
  confirmations: 2,
})
const TAG = listItem({
  id: "r5d6e7f8-0000-4000-8000-000000000002",
  title: "Tag on the underpass",
  category: "graffiti",
  status: "in_progress",
  flagged: true,
  place: "West Oakland",
  reporter: { id: null, name: "Sam Ortiz", handle: "@sam", joined: "-" },
  submitted: { rel: "1d", abs: "Sep 22, 2026, 9:00 AM" },
})

const COUNTS = { all: 30, submitted: 9, in_progress: 4, completed: 12, flagged: 2, needsVerification: 5 }

function page(items: AdminReportListItemDTO[], nextCursor: string | null = null) {
  return { items, nextCursor, counts: COUNTS } satisfies AdminReportListResponse
}

function detail(item: AdminReportListItemDTO): AdminReportDTO {
  return {
    ...item,
    desc: `Description of ${item.title}`,
    timeline: [{ who: "Rita", what: "submitted the report", when: "3h ago", kind: "submit" }],
    city: {
      dept: "Oakland Public Works",
      place: item.place,
      contact: "works@oaklandca.gov",
      routed: false,
    },
    media: [],
    linkedEvents: [],
    geoid: "0653000",
    outreach: { status: "not_sent", threadId: null, routedTo: null, routedAt: null },
    referenceCode: `CF-${item.id.slice(0, 4).toUpperCase()}`,
    verificationVerdict: null,
    verifiedAt: null,
    reporterReportVerified: false,
  } satisfies AdminReportDTO
}

const NO_CHAT = { items: [], nextCursor: null } satisfies ChatHistoryResponse

function mockDetails(...items: AdminReportListItemDTO[]) {
  apiMock.getAdminReport.mockImplementation(async ({ id }: { id: string }) => {
    const r = items.find((x) => x.id === id)
    if (!r) throw new Error(`no report ${id}`)
    return detail(r)
  })
  apiMock.adminReportMessages.mockResolvedValue(NO_CHAT)
}

function listCard() {
  return screen.getByRole("heading", { level: 3, name: "Reports" }).closest("section") as HTMLElement
}

describe("ReportsPage", () => {
  it("shows the loading state while the first page is in flight", () => {
    apiMock.listAdminReports.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<ReportsPage focusId={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading reports...")
    expect(within(detailCard()).getByText("No report selected")).toBeInTheDocument()
  })

  it("asks for the Needs verification facet by default", () => {
    apiMock.listAdminReports.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<ReportsPage focusId={null} />)
    expect(apiMock.listAdminReports).toHaveBeenCalledWith({ filter: "needs_verification" })
  })

  it("shows the empty copy when no report matches", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([]))
    renderWithQuery(<ReportsPage focusId={null} />)
    expect(await screen.findByText("Nothing matches")).toBeInTheDocument()
    expect(screen.getByText("Try a different filter or search.")).toBeInTheDocument()
    expect(within(detailCard()).getByText("Pick a report from the list.")).toBeInTheDocument()
  })

  it("shows the error state with the failure message and a retry", async () => {
    apiMock.listAdminReports.mockRejectedValue(new Error("Reports backend unreachable"))
    renderWithQuery(<ReportsPage focusId={null} />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("Reports backend unreachable")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("renders rows with key fields and auto-selects the first report into the detail pane", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH, TAG]))
    mockDetails(COUCH, TAG)
    renderWithQuery(<ReportsPage focusId={null} />)

    await screen.findByText("Couch dumped on sidewalk")
    const list = listCard()
    expect(within(list).getByText("#r1a2b3c4")).toBeInTheDocument()
    expect(within(list).getByText("Temescal")).toBeInTheDocument()
    expect(within(list).getByRole("button", { name: "Rita" })).toBeInTheDocument()
    expect(within(list).getByText("2 confirms")).toBeInTheDocument()
    expect(within(list).getByText("Needs verification")).toBeInTheDocument()
    expect(within(list).getByText("3h")).toBeInTheDocument()
    expect(within(list).getByRole("img", { name: "Trash" })).toBeInTheDocument()
    expect(within(list).getByText("Tag on the underpass")).toBeInTheDocument()
    expect(within(list).getByText("Sam")).toBeInTheDocument()
    expect(within(list).queryByRole("button", { name: "Sam" })).not.toBeInTheDocument()
    expect(within(list).getByText("In progress")).toBeInTheDocument()
    expect(within(list).getByTitle("Flagged")).toBeInTheDocument()
    // The card head shows the server's facet total, not the number of rows loaded.
    expect(within(list).getByText("5")).toBeInTheDocument()

    const card = detailCard()
    expect(
      await within(card).findByRole("heading", { name: "Couch dumped on sidewalk" }),
    ).toBeInTheDocument()
    expect(within(card).getByText("CF-R1A2")).toBeInTheDocument()
    expect(within(card).getByText("Description of Couch dumped on sidewalk")).toBeInTheDocument()
    expect(within(card).getByText("4900 Telegraph Ave")).toBeInTheDocument()
    expect(within(card).getByText("2 neighbors confirmed")).toBeInTheDocument()
    expect(within(card).getByText("submitted the report")).toBeInTheDocument()
    expect(within(card).getByText("Rita Gomez")).toBeInTheDocument()
    expect(within(card).getAllByText("Oakland Public Works")).toHaveLength(2)
    expect(within(card).getByText("works@oaklandca.gov")).toBeInTheDocument()
    expect(within(card).getByText("Not yet reviewed")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Verify and send to city/ })).toBeEnabled()
    expect(within(card).getByRole("button", { name: "Acknowledged" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Under review" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Remove report/ })).toBeInTheDocument()
    expect(await within(card).findByText("No messages yet")).toBeInTheDocument()
    expect(apiMock.getAdminReport).toHaveBeenCalledWith({ id: COUCH.id })
    expect(apiMock.adminReportMessages).toHaveBeenCalledWith({ id: COUCH.id, limit: 50 })
  })

  it("opens the clicked report in the detail pane", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH, TAG]))
    mockDetails(COUCH, TAG)
    renderWithQuery(<ReportsPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Couch dumped on sidewalk" })

    await userEvent.click(within(listCard()).getByText("Tag on the underpass"))

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "Tag on the underpass" })).toBeInTheDocument()
    // Both the status badge and the toggled flag button read "Flagged".
    expect(within(card).getAllByText("Flagged")).toHaveLength(2)
    expect(within(card).getByRole("button", { name: "Flagged" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Resolved" })).toBeInTheDocument()
    expect(within(card).queryByRole("button", { name: /View full account/ })).not.toBeInTheDocument()
    expect(apiMock.getAdminReport).toHaveBeenCalledWith({ id: TAG.id })
  })

  it("shows the facet counts on the filter chips", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH]))
    mockDetails(COUCH)
    renderWithQuery(<ReportsPage focusId={null} />)
    await screen.findByText("Couch dumped on sidewalk")
    expect(screen.getByRole("button", { name: "Needs verification 5" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "In progress 4" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Completed 12" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Flagged 2" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "All 30" })).toBeInTheDocument()
  })

  it("sends the chosen filter chip to the api", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH]))
    mockDetails(COUCH)
    renderWithQuery(<ReportsPage focusId={null} />)
    await screen.findByText("Couch dumped on sidewalk")

    await userEvent.click(screen.getByRole("button", { name: /^Completed/ }))
    await waitFor(() =>
      expect(apiMock.listAdminReports).toHaveBeenLastCalledWith({ filter: "completed" }),
    )
    expect(within(listCard()).getByText("12")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /^Flagged/ }))
    await waitFor(() =>
      expect(apiMock.listAdminReports).toHaveBeenLastCalledWith({ filter: "flagged" }),
    )

    await userEvent.click(screen.getByRole("button", { name: /^All/ }))
    await waitFor(() => expect(apiMock.listAdminReports).toHaveBeenLastCalledWith({}))
  })

  it("sends the trimmed search text alongside the filter after the debounce", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH]))
    mockDetails(COUCH)
    renderWithQuery(<ReportsPage focusId={null} />)
    await screen.findByText("Couch dumped on sidewalk")

    await userEvent.type(screen.getByPlaceholderText("Search title, place, reporter…"), " couch ")
    await waitFor(() =>
      expect(apiMock.listAdminReports).toHaveBeenLastCalledWith({
        filter: "needs_verification",
        q: "couch",
      }),
    )
  })

  it("shows Load more when a cursor is returned and fetches the next page with it", async () => {
    apiMock.listAdminReports.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "rep-2" ? page([TAG]) : page([COUCH], "rep-2"),
    )
    mockDetails(COUCH, TAG)
    renderWithQuery(<ReportsPage focusId={null} />)
    await screen.findByText("Couch dumped on sidewalk")

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(listCard()).findByText("Tag on the underpass")).toBeInTheDocument()
    expect(apiMock.listAdminReports).toHaveBeenLastCalledWith({
      filter: "needs_verification",
      cursor: "rep-2",
    })
    expect(within(listCard()).getByText("Couch dumped on sidewalk")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("opens a deep-linked focusId that is on the first page", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH, TAG]))
    mockDetails(COUCH, TAG)
    renderWithQuery(<ReportsPage focusId={TAG.id} />)
    expect(await within(detailCard()).findByRole("heading", { name: "Tag on the underpass" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Couch dumped on sidewalk" })).not.toBeInTheDocument()
    expect(within(listCard()).queryByText("Linked report")).not.toBeInTheDocument()
  })

  it("keeps a deep-linked focusId that is not on the first page and pins it above the list as a linked report", async () => {
    const OLD = listItem({
      id: "r9f9f9f9-0000-4000-8000-000000000009",
      title: "Old broken hydrant",
      category: "water",
      status: "resolved",
    })
    apiMock.listAdminReports.mockResolvedValue(page([COUCH, TAG]))
    mockDetails(COUCH, TAG, OLD)
    renderWithQuery(<ReportsPage focusId={OLD.id} />)

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "Old broken hydrant" })).toBeInTheDocument()
    expect(within(card).queryByRole("heading", { name: "Couch dumped on sidewalk" })).not.toBeInTheDocument()

    const list = listCard()
    expect(await within(list).findByText("Linked report")).toBeInTheDocument()
    expect(within(list).getByText("Old broken hydrant")).toBeInTheDocument()
    expect(within(list).getByText("Couch dumped on sidewalk")).toBeInTheDocument()
    expect(apiMock.getAdminReport).toHaveBeenCalledWith({ id: OLD.id })
  })
})
