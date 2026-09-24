import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AdminReportDTO,
  AdminReportListItemDTO,
  AdminReportListResponse,
  ChatHistoryResponse,
  ChatMessageDTO,
} from "@civfix/shared"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { startFakeTimersWithUser } from "@/test/fake-timers"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { DialogHost } from "@/components/shared/dialog"
import { ReportsPage } from "@/features/reports/reports-page"
import { useUiStore } from "@/store/ui-store"

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

    const user = startFakeTimersWithUser()
    await user.type(screen.getByPlaceholderText("Search title, place, reporter…"), " couch ")
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(apiMock.listAdminReports).toHaveBeenLastCalledWith({
      filter: "needs_verification",
      q: "couch",
    })
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

function renderPage(focusId: string | null = null) {
  return renderWithQuery(
    <>
      <ReportsPage focusId={focusId} />
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

const RITA = {
  id: "0a0a0a0a-0000-4000-8000-00000000000a",
  name: "Rita Gomez",
  handle: "@rita",
  followers: 0,
  following: 0,
  isFollowing: false,
}

function chatMessage(over: Partial<ChatMessageDTO> & { id: string }): ChatMessageDTO {
  return {
    cleanupId: "c0c0c0c0-0000-4000-8000-00000000000c",
    roomKind: "report",
    from: RITA,
    body: "Still there this morning",
    kind: "text",
    createdAt: "2026-09-23T09:00:00.000Z",
    reactions: [],
    mentions: [],
    ...over,
  }
}

describe("ReportsPage correctness and accessibility", () => {
  beforeEach(() => {
    useUiStore.setState({ page: "reports", focusId: null, toast: null })
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    return () => {
      scrollTo.mockRestore()
      window.history.replaceState(null, "", "#/")
    }
  })

  it("selects a row from the keyboard with Enter or Space and marks it current", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH, TAG]))
    mockDetails(COUCH, TAG)
    const user = userEvent.setup()
    renderPage()
    await within(detailCard()).findByRole("heading", { name: COUCH.title })

    const tagRow = within(listCard()).getByRole("button", { name: /Tag on the underpass/ })
    tagRow.focus()
    await user.keyboard("{Enter}")
    expect(await within(detailCard()).findByRole("heading", { name: TAG.title })).toBeInTheDocument()
    expect(tagRow).toHaveAttribute("aria-current", "true")

    const couchRow = within(listCard()).getByRole("button", { name: /Couch dumped on sidewalk/ })
    expect(couchRow).not.toHaveAttribute("aria-current")
    couchRow.focus()
    await user.keyboard(" ")
    expect(await within(detailCard()).findByRole("heading", { name: COUCH.title })).toBeInTheDocument()
  })

  it("opens the reporter profile from the keyboard inside a row", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH, TAG]))
    mockDetails(COUCH, TAG)
    const user = userEvent.setup()
    renderPage()
    await within(detailCard()).findByRole("heading", { name: COUCH.title })

    within(listCard()).getByRole("button", { name: "Rita" }).focus()
    await user.keyboard("{Enter}")

    expect(useUiStore.getState()).toMatchObject({ page: "users", focusId: "u-rita" })
  })

  it("names the flagged marker for assistive tech", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH, TAG]))
    mockDetails(COUCH, TAG)
    renderPage()
    await screen.findByText(TAG.title)
    expect(within(listCard()).getByRole("img", { name: "Flagged" })).toBeInTheDocument()
  })

  it("labels the search box and the email fields", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH]))
    mockDetails(COUCH)
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: COUCH.title })

    expect(screen.getByRole("textbox", { name: "Search reports" })).toBeInTheDocument()
    const followup = within(card).getByRole("textbox", { name: "Message to the city" })
    expect(followup).toHaveAttribute("maxlength", "4000")

    await userEvent.click(within(card).getByRole("button", { name: /Verify and send to city/ }))
    const note = within(card).getByRole("textbox", { name: "Note to include in the email" })
    expect(note).toHaveAttribute("maxlength", "4000")
  })

  it("still sends a verified report to the city when the operator opens another report mid-approval", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH, TAG]))
    mockDetails(COUCH, TAG)
    const verdict = deferred<{ ok: true }>()
    apiMock.setReportVerdict.mockReturnValue(verdict.promise)
    apiMock.routeReport.mockResolvedValue({
      ok: true,
      threadId: "t-1",
      routedTo: "works@oaklandca.gov",
    })
    const user = userEvent.setup()
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: COUCH.title })

    await user.click(within(card).getByRole("button", { name: /Verify and send to city/ }))
    await user.click(within(card).getByRole("button", { name: /Verify and send to city/ }))
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Verify and send" }))
    await waitFor(() =>
      expect(apiMock.setReportVerdict).toHaveBeenCalledWith({ id: COUCH.id, verdict: "approved" }),
    )

    await user.click(within(listCard()).getByText(TAG.title))
    await within(detailCard()).findByRole("heading", { name: TAG.title })
    await act(async () => {
      verdict.resolve({ ok: true })
    })

    await waitFor(() => expect(apiMock.routeReport).toHaveBeenCalledWith({ id: COUCH.id }))
  })

  it("does not jump to another report after the selected one is removed", async () => {
    let removed = false
    apiMock.listAdminReports.mockImplementation(async () => page(removed ? [TAG] : [COUCH, TAG]))
    mockDetails(COUCH, TAG)
    apiMock.removeReport.mockImplementation(async () => {
      removed = true
      return { ok: true }
    })
    const user = userEvent.setup()
    renderPage()
    await within(detailCard()).findByRole("heading", { name: COUCH.title })

    await user.click(within(detailCard()).getByRole("button", { name: /Remove report/ }))
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" }))

    expect(await within(detailCard()).findByText("No report selected")).toBeInTheDocument()
    await waitFor(() =>
      expect(within(listCard()).queryByText(COUCH.title)).not.toBeInTheDocument(),
    )
    expect(within(detailCard()).getByText("No report selected")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: TAG.title })).not.toBeInTheDocument()
  })

  it("labels a selection that left the filter as selected, not linked", async () => {
    apiMock.listAdminReports.mockImplementation(async (params: { filter?: string }) =>
      params.filter === "completed" ? page([COUCH]) : page([COUCH, TAG]),
    )
    mockDetails(COUCH, TAG)
    const user = userEvent.setup()
    renderPage()
    await within(detailCard()).findByRole("heading", { name: COUCH.title })

    await user.click(within(listCard()).getByText(TAG.title))
    await within(detailCard()).findByRole("heading", { name: TAG.title })
    await user.click(screen.getByRole("button", { name: /^Completed/ }))

    expect(await within(listCard()).findByText("Selected report")).toBeInTheDocument()
    expect(within(listCard()).queryByText("Linked report")).not.toBeInTheDocument()
    expect(within(detailCard()).getByRole("heading", { name: TAG.title })).toBeInTheDocument()
  })

  it("shows why Send is blocked as visible text tied to the button", async () => {
    const SENT = listItem({ id: "r3c3c3c3-0000-4000-8000-000000000003", title: "Pothole on 40th" })
    apiMock.listAdminReports.mockResolvedValue(page([SENT]))
    apiMock.getAdminReport.mockResolvedValue({
      ...detail(SENT),
      outreach: {
        status: "sent",
        threadId: "t-9",
        routedTo: "works@oaklandca.gov",
        routedAt: "2026-09-22T10:00:00.000Z",
      },
    })
    apiMock.adminReportMessages.mockResolvedValue(NO_CHAT)
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: SENT.title })

    const reason = "This report was already sent. Resend it from the Mail thread."
    expect(within(card).getByText(reason)).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Already sent/ })).toHaveAccessibleDescription(reason)
  })

  it("shows why a follow-up is blocked before the first send", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH]))
    mockDetails(COUCH)
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: COUCH.title })

    const reason = "Send the report to the city first. A follow-up goes on that conversation."
    expect(within(card).getByText(reason)).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Send to city" })).toHaveAccessibleDescription(reason)
  })

  it("does not offer Reject again on an already rejected report", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH]))
    apiMock.getAdminReport.mockResolvedValue({ ...detail(COUCH), verificationVerdict: "rejected" })
    apiMock.adminReportMessages.mockResolvedValue(NO_CHAT)
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: COUCH.title })

    const reject = within(card).getByRole("button", { name: /Reject/ })
    expect(reject).toBeDisabled()
    expect(reject).toHaveAccessibleDescription("This report is already rejected.")
    expect(within(card).getByText("This report is already rejected.")).toBeInTheDocument()
  })

  it("links the video of a video-only report instead of hiding it behind the preview", async () => {
    const CLIP = listItem({
      id: "r4d4d4d4-0000-4000-8000-000000000004",
      title: "Dumping caught on video",
      hasPhoto: true,
    })
    apiMock.listAdminReports.mockResolvedValue(page([CLIP]))
    apiMock.getAdminReport.mockResolvedValue({
      ...detail(CLIP),
      media: [
        {
          id: "m-video",
          kind: "video",
          url: "https://media.test/clip.mp4",
          thumbUrl: "https://media.test/clip.jpg",
        },
      ],
    })
    apiMock.adminReportMessages.mockResolvedValue(NO_CHAT)
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: CLIP.title })

    expect(within(card).getByRole("link", { name: "Open full media in a new tab" })).toHaveAttribute(
      "href",
      "https://media.test/clip.mp4",
    )
    expect(within(card).queryByText("Reporter photo")).not.toBeInTheDocument()
  })

  it("words the flag toast from the refetched report, not the cached one", async () => {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH]))
    mockDetails(COUCH)
    apiMock.flagReport.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderPage()
    const card = detailCard()
    await within(card).findByRole("heading", { name: COUCH.title })

    // Another operator flagged it first, so this toggle cleared the flag and the refetch says so.
    await user.click(within(card).getByRole("button", { name: "Flag" }))

    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe("#r1a2b3c4 · flag cleared"))
  })
})

describe("ReportsPage chat", () => {
  beforeEach(() => {
    useUiStore.setState({ page: "reports", focusId: null, toast: null })
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    return () => {
      scrollTo.mockRestore()
      window.history.replaceState(null, "", "#/")
    }
  })

  function renderWithChat(chat: (params: { before?: string }) => ChatHistoryResponse) {
    apiMock.listAdminReports.mockResolvedValue(page([COUCH]))
    mockDetails(COUCH)
    apiMock.adminReportMessages.mockImplementation(async (params: { before?: string }) => chat(params))
    renderPage()
    return detailCard()
  }

  it("falls back to the message body when a system event carries a blank body", async () => {
    const card = renderWithChat(() => ({
      items: [
        chatMessage({
          id: "0b0b0b0b-0000-4000-8000-00000000000b",
          kind: "system",
          from: null,
          body: "Crew dispatched",
          system: { status: "acknowledged", body: "   " },
        }),
      ],
      nextCursor: null,
    }))
    expect(await within(card).findByText(/Crew dispatched/)).toBeInTheDocument()
  })

  it("labels every reaction the contract knows", async () => {
    const card = renderWithChat(() => ({
      items: [
        chatMessage({
          id: "0d0d0d0d-0000-4000-8000-00000000000d",
          reactions: [
            { emoji: "laugh", count: 2, mine: false },
            { emoji: "sad", count: 1, mine: false },
          ],
        }),
      ],
      nextCursor: null,
    }))
    expect(await within(card).findByText("Laugh 2")).toBeInTheDocument()
    expect(within(card).getByText("Sad 1")).toBeInTheDocument()
  })

  it("opens the author's profile with Space", async () => {
    const card = renderWithChat(() => ({
      items: [chatMessage({ id: "0e0e0e0e-0000-4000-8000-00000000000e" })],
      nextCursor: null,
    }))
    const user = userEvent.setup()
    const author = await within(card).findByRole("button", { name: "Rita Gomez" })
    author.focus()
    await user.keyboard(" ")
    expect(useUiStore.getState()).toMatchObject({ page: "users", focusId: RITA.id })
  })

  it("names Post without reading the shortcut glyphs and declares the shortcut on the composer", async () => {
    const card = renderWithChat(() => ({ items: [], nextCursor: null }))
    await within(card).findByText("No messages yet")
    expect(within(card).getByRole("button", { name: "Post" })).toBeInTheDocument()
    expect(within(card).getByRole("textbox", { name: "Message the report chat" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Meta+Enter Control+Enter",
    )
  })

  it("loads older messages past the first page", async () => {
    const OLDER = chatMessage({
      id: "0f0f0f0f-0000-4000-8000-00000000000f",
      body: "First sighting last week",
      createdAt: "2026-09-16T09:00:00.000Z",
    })
    const NEWER = chatMessage({ id: "1a1a1a1a-0000-4000-8000-00000000001a", body: "Still there" })
    const card = renderWithChat(({ before }) =>
      before === OLDER.id ? { items: [OLDER], nextCursor: null } : { items: [NEWER], nextCursor: OLDER.id },
    )
    await within(card).findByText("Still there")

    await userEvent.click(within(card).getByRole("button", { name: "Load older messages" }))

    expect(await within(card).findByText("First sighting last week")).toBeInTheDocument()
    expect(apiMock.adminReportMessages).toHaveBeenLastCalledWith({
      id: COUCH.id,
      limit: 50,
      before: OLDER.id,
    })
    expect(within(card).queryByRole("button", { name: "Load older messages" })).not.toBeInTheDocument()
  })
})
