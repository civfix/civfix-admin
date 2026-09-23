import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  GovClaimDTO,
  GovClaimListResponse,
  ModerationItemDTO,
  ModerationListItemDTO,
  ModerationListResponse,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { ModerationPage } from "@/features/moderation/moderation-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})


function modItem(over: Partial<ModerationListItemDTO> & { id: string; flag: string }) {
  return {
    reporter: "Dana Cho",
    category: null,
    reason: "Spam",
    age: "5m",
    priority: "low",
    kind: "image",
    subjectId: "subj-1",
    destinationKind: null,
    destinationId: null,
    reporterId: null,
    ...over,
  } satisfies ModerationListItemDTO
}

const COMMENT_REPORT = modItem({
  id: "mod-1",
  flag: "MOD-101",
  kind: "user_report",
  subjectType: "comment",
  reason: "Harassment",
  reporter: "Dana Cho",
  reporterId: "u-dana",
  priority: "high",
  age: "12m",
})
const APPEAL = modItem({
  id: "mod-2",
  flag: "MOD-202",
  kind: "appeal",
  reason: "Wrongly removed",
  reporter: "Eli Park",
  priority: "med",
  age: "1h",
})

function modPage(items: ModerationListItemDTO[], nextCursor: string | null = null) {
  return { items, nextCursor } satisfies ModerationListResponse
}

function modDetail(item: ModerationListItemDTO): ModerationItemDTO {
  return {
    ...item,
    desc: `Details for ${item.flag}`,
    autoAction: null,
    place: "Temescal",
    signals: [{ label: "Prior flags", val: "3", tone: "warn" }],
    user: {
      id: "u-subject",
      handle: "@subject",
      name: "Subject Person",
      joined: "Jan 2026",
      priorReports: 4,
      priorRemovals: 1,
      strikes: 2,
      device: "iOS 19",
    },
    similar: [],
    media: [],
  } satisfies ModerationItemDTO
}

function mockModDetails(...items: ModerationListItemDTO[]) {
  apiMock.getModerationItem.mockImplementation(async ({ id }: { id: string }) => {
    const m = items.find((x) => x.id === id)
    if (!m) throw new Error(`no item ${id}`)
    return modDetail(m)
  })
}

function claim(over: Partial<GovClaimDTO> & { id: string; name: string }) {
  return {
    title: "Public Works Director",
    org: "City of Oakland",
    jurisdictionGeoid: "0653000",
    method: "email",
    status: "pending",
    age: "2d",
    contactEmail: "applicant@oaklandca.gov",
    verified: ["linkedin"],
    pending: ["directory", "callback"],
    checks: {
      linkedin: { status: "verified", evidence: "https://linkedin.example/in/applicant", note: null },
      directory: { status: "pending", evidence: null, note: null },
      callback: { status: "pending", evidence: null, note: null },
    },
    ...over,
  } satisfies GovClaimDTO
}

const RIVERA = claim({ id: "gc-1", name: "Maya Rivera" })
const NGUYEN = claim({
  id: "gc-2",
  name: "Tom Nguyen",
  org: "Alameda County",
  title: "Clerk",
  status: "approved",
  contactEmail: "tom@acgov.org",
  method: "cold_outreach",
})

function claimPage(items: GovClaimDTO[], nextCursor: string | null = null) {
  return { items, nextCursor } satisfies GovClaimListResponse
}

function mockClaimDetails(...claims: GovClaimDTO[]) {
  apiMock.getGovClaim.mockImplementation(async ({ id }: { id: string }) => {
    const c = claims.find((x) => x.id === id)
    if (!c) throw new Error(`no claim ${id}`)
    return c
  })
}

function listCard(heading: string) {
  return screen.getByRole("heading", { level: 3, name: heading }).closest("section") as HTMLElement
}

function detailCard() {
  return document.querySelector(".md-detail-card") as HTMLElement
}

async function openGovClaims() {
  await userEvent.click(screen.getByRole("radio", { name: "Gov claims" }))
}

describe("ModerationPage queue", () => {
  it("starts on the Queue section", () => {
    apiMock.listModeration.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<ModerationPage focusId={null} />)
    expect(screen.getByRole("radio", { name: "Queue" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("radio", { name: "Gov claims" })).toHaveAttribute("aria-checked", "false")
  })

  it("shows the loading state while the first page is in flight", () => {
    apiMock.listModeration.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<ModerationPage focusId={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading queue...")
    expect(within(detailCard()).getByText("No item selected")).toBeInTheDocument()
  })

  it("shows the empty copy when the queue is clear", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    renderWithQuery(<ModerationPage focusId={null} />)
    expect(await screen.findByText("Queue is clear")).toBeInTheDocument()
    expect(screen.getByText("Nothing needs review right now.")).toBeInTheDocument()
    expect(within(detailCard()).getByText("Pick an item from the queue.")).toBeInTheDocument()
  })

  it("shows the error state with the failure message and a retry", async () => {
    apiMock.listModeration.mockRejectedValue(new Error("Moderation backend unreachable"))
    renderWithQuery(<ModerationPage focusId={null} />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("Moderation backend unreachable")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("renders rows with key fields and auto-selects the first item into the detail pane", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT, APPEAL]))
    mockModDetails(COMMENT_REPORT, APPEAL)
    renderWithQuery(<ModerationPage focusId={null} />)

    await screen.findByText("MOD-101")
    const list = listCard("Queue")
    expect(within(list).getByText("Reported comment")).toBeInTheDocument()
    expect(within(list).getByText("Harassment")).toBeInTheDocument()
    expect(within(list).getByText("Dana Cho")).toBeInTheDocument()
    expect(within(list).getByText("High")).toBeInTheDocument()
    expect(within(list).getByText("12m")).toBeInTheDocument()
    expect(within(list).getByText("Appeal")).toBeInTheDocument()
    expect(within(list).getByText("MOD-202")).toBeInTheDocument()
    expect(within(list).getByText("Med")).toBeInTheDocument()
    expect(apiMock.listModeration).toHaveBeenCalledWith({})

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "MOD-101" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Dana Cho" })).toBeInTheDocument()
    expect(within(card).getByText("Details for MOD-101")).toBeInTheDocument()
    expect(within(card).getByText(/High priority/)).toBeInTheDocument()
    expect(within(card).getByText("Prior flags")).toBeInTheDocument()
    expect(within(card).getByText("Subject Person")).toBeInTheDocument()
    expect(within(card).getByText("iOS 19")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Keep" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Hold" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Remove" })).toBeInTheDocument()
    expect(apiMock.getModerationItem).toHaveBeenCalledWith({ id: "mod-1" })
  })

  it("opens the clicked item in the detail pane", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT, APPEAL]))
    mockModDetails(COMMENT_REPORT, APPEAL)
    renderWithQuery(<ModerationPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "MOD-101" })

    await userEvent.click(within(listCard("Queue")).getByText("MOD-202"))

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "MOD-202" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Overturn" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Uphold" })).toBeInTheDocument()
    expect(within(card).queryByRole("button", { name: "Keep" })).not.toBeInTheDocument()
  })

  it("sends the chosen filter chip to the api", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT]))
    mockModDetails(COMMENT_REPORT)
    renderWithQuery(<ModerationPage focusId={null} />)
    await screen.findByText("MOD-101")

    await userEvent.click(screen.getByRole("button", { name: "User reports" }))
    await waitFor(() =>
      expect(apiMock.listModeration).toHaveBeenLastCalledWith({ filter: "user_report" }),
    )

    await userEvent.click(screen.getByRole("button", { name: "High" }))
    await waitFor(() => expect(apiMock.listModeration).toHaveBeenLastCalledWith({ filter: "high" }))

    await userEvent.click(screen.getByRole("button", { name: "All" }))
    await waitFor(() => expect(apiMock.listModeration).toHaveBeenLastCalledWith({}))
  })

  it("sends the trimmed search text to the api after the debounce", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT]))
    mockModDetails(COMMENT_REPORT)
    renderWithQuery(<ModerationPage focusId={null} />)
    await screen.findByText("MOD-101")

    await userEvent.type(screen.getByPlaceholderText("Search flag, reporter, reason…"), " spam ")
    await waitFor(() => expect(apiMock.listModeration).toHaveBeenLastCalledWith({ q: "spam" }))
  })

  it("shows Load more when a cursor is returned and fetches the next page with it", async () => {
    apiMock.listModeration.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "m-2" ? modPage([APPEAL]) : modPage([COMMENT_REPORT], "m-2"),
    )
    mockModDetails(COMMENT_REPORT, APPEAL)
    renderWithQuery(<ModerationPage focusId={null} />)
    await screen.findByText("MOD-101")

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(listCard("Queue")).findByText("MOD-202")).toBeInTheDocument()
    expect(apiMock.listModeration).toHaveBeenLastCalledWith({ cursor: "m-2" })
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("opens a deep-linked focusId that is on the first page", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT, APPEAL]))
    mockModDetails(COMMENT_REPORT, APPEAL)
    renderWithQuery(<ModerationPage focusId="mod-2" />)
    expect(await within(detailCard()).findByRole("heading", { name: "MOD-202" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "MOD-101" })).not.toBeInTheDocument()
  })

  it("replaces a deep-linked focusId that is not on the first page with the first row (auto-select override)", async () => {
    const OTHER = modItem({ id: "mod-9", flag: "MOD-909" })
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT, APPEAL]))
    mockModDetails(COMMENT_REPORT, APPEAL, OTHER)
    renderWithQuery(<ModerationPage focusId="mod-9" />)
    expect(await within(detailCard()).findByRole("heading", { name: "MOD-101" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "MOD-909" })).not.toBeInTheDocument()
  })
})

describe("ModerationPage gov claims", () => {
  it("switches to the Gov claims section and asks for pending claims by default", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()

    expect(screen.getByRole("radio", { name: "Gov claims" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByText(/Government staff asking for access/)).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Loading claims...")
    expect(within(detailCard()).getByText("No claim selected")).toBeInTheDocument()
    expect(apiMock.listGovClaims).toHaveBeenCalledWith({ filter: "pending" })
  })

  it("shows the empty copy when no claim is waiting", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([]))
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()

    expect(await screen.findByText("No claims here")).toBeInTheDocument()
    expect(screen.getByText("Nobody is waiting on government access right now.")).toBeInTheDocument()
    expect(within(detailCard()).getByText("Pick a claim from the queue.")).toBeInTheDocument()
  })

  it("shows the error state with the failure message and a retry", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockRejectedValue(new Error("Claims backend unreachable"))
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("Claims backend unreachable")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("renders claim rows and auto-selects the first claim into the detail pane", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([RIVERA, NGUYEN]))
    mockClaimDetails(RIVERA, NGUYEN)
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()

    await screen.findByText("Maya Rivera")
    const list = listCard("Gov claims")
    expect(within(list).getByText("City of Oakland")).toBeInTheDocument()
    expect(within(list).getByText("Public Works Director")).toBeInTheDocument()
    expect(within(list).getAllByText("1 of 3 checks verified")).toHaveLength(2)
    expect(within(list).getByText("Tom Nguyen")).toBeInTheDocument()
    expect(within(list).getByText("Approved")).toBeInTheDocument()

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "Maya Rivera" })).toBeInTheDocument()
    expect(within(card).getAllByText("applicant@oaklandca.gov")).toHaveLength(2)
    expect(within(card).getByText(/Gov provisioning · Emailed us/)).toBeInTheDocument()
    expect(within(card).getByText("LinkedIn")).toBeInTheDocument()
    expect(within(card).getByRole("link", { name: "https://linkedin.example/in/applicant" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Mark pending" })).toBeInTheDocument()
    expect(within(card).getAllByRole("button", { name: "Mark verified" })).toHaveLength(2)
    expect(within(card).getByRole("button", { name: "Approve" })).toBeEnabled()
    expect(within(card).getByRole("button", { name: "Reject" })).toBeEnabled()
    expect(apiMock.getGovClaim).toHaveBeenCalledWith({ id: "gc-1" })
  })

  it("opens the clicked claim, which shows a decided claim as locked", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([RIVERA, NGUYEN]))
    mockClaimDetails(RIVERA, NGUYEN)
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()
    await within(detailCard()).findByRole("heading", { name: "Maya Rivera" })

    await userEvent.click(within(listCard("Gov claims")).getByText("Tom Nguyen"))

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "Tom Nguyen" })).toBeInTheDocument()
    expect(within(card).getByText(/Gov provisioning · Cold outreach/)).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Approve" })).toBeDisabled()
    expect(within(card).getByRole("button", { name: "Reject" })).toBeDisabled()
    expect(within(card).getByText(/This claim was already approved\. Decisions are final/)).toBeInTheDocument()
  })

  it("sends the chosen filter chip to the api", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([RIVERA]))
    mockClaimDetails(RIVERA)
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()
    await screen.findByText("City of Oakland")

    await userEvent.click(screen.getByRole("button", { name: "Approved" }))
    await waitFor(() =>
      expect(apiMock.listGovClaims).toHaveBeenLastCalledWith({ filter: "approved" }),
    )

    await userEvent.click(screen.getByRole("button", { name: "All" }))
    await waitFor(() => expect(apiMock.listGovClaims).toHaveBeenLastCalledWith({}))
  })

  it("sends the trimmed search text alongside the filter after the debounce", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([RIVERA]))
    mockClaimDetails(RIVERA)
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()
    await screen.findByText("City of Oakland")

    await userEvent.type(screen.getByPlaceholderText("Search name or organization…"), " maya ")
    await waitFor(() =>
      expect(apiMock.listGovClaims).toHaveBeenLastCalledWith({ filter: "pending", q: "maya" }),
    )
  })

  it("shows Load more when a cursor is returned and fetches the next page with it", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "gc-next" ? claimPage([NGUYEN]) : claimPage([RIVERA], "gc-next"),
    )
    mockClaimDetails(RIVERA, NGUYEN)
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()
    await screen.findByText("City of Oakland")

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(listCard("Gov claims")).findByText("Tom Nguyen")).toBeInTheDocument()
    expect(apiMock.listGovClaims).toHaveBeenLastCalledWith({ filter: "pending", cursor: "gc-next" })
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })
})
