import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  AppError,
  ErrorCode,
  type GovClaimDTO,
  type GovClaimListResponse,
  type ModerationItemDTO,
  type ModerationListItemDTO,
  type ModerationListResponse,
} from "@civfix/shared"
import { describe, expect, it, onTestFinished, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { startFakeTimersWithUser } from "@/test/fake-timers"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { ModerationPage } from "@/features/moderation/moderation-page"
import { DialogHost } from "@/components/shared/dialog"
import { LightboxHost } from "@/components/shared/lightbox"
import { useUiStore } from "@/store/ui-store"

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

    const user = startFakeTimersWithUser()
    await user.type(screen.getByPlaceholderText("Search flag, reporter, reason…"), " spam ")
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(apiMock.listModeration).toHaveBeenLastCalledWith({ q: "spam" })
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

  it("keeps a deep-linked focusId that is not on the first page selected", async () => {
    const OTHER = modItem({ id: "mod-9", flag: "MOD-909" })
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT, APPEAL]))
    mockModDetails(COMMENT_REPORT, APPEAL, OTHER)
    renderWithQuery(<ModerationPage focusId="mod-9" />)
    expect(await within(detailCard()).findByRole("heading", { name: "MOD-909" })).toBeInTheDocument()
    await within(listCard("Queue")).findByText("MOD-101")
    expect(within(detailCard()).getByRole("heading", { name: "MOD-909" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "MOD-101" })).not.toBeInTheDocument()
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

    const list = listCard("Gov claims")
    await within(list).findByText("Maya Rivera")
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
    expect(within(card).getByRole("button", { name: "Mark LinkedIn pending" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Mark Directory verified" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Mark Callback verified" })).toBeInTheDocument()
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
    await within(listCard("Gov claims")).findByText("City of Oakland")

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
    await within(listCard("Gov claims")).findByText("City of Oakland")

    const user = startFakeTimersWithUser()
    await user.type(screen.getByPlaceholderText("Search name or organization…"), " maya ")
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(apiMock.listGovClaims).toHaveBeenLastCalledWith({ filter: "pending", q: "maya" })
  })

  it("shows Load more when a cursor is returned and fetches the next page with it", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "gc-next" ? claimPage([NGUYEN]) : claimPage([RIVERA], "gc-next"),
    )
    mockClaimDetails(RIVERA, NGUYEN)
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()
    await within(listCard("Gov claims")).findByText("City of Oakland")

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(listCard("Gov claims")).findByText("Tom Nguyen")).toBeInTheDocument()
    expect(apiMock.listGovClaims).toHaveBeenLastCalledWith({ filter: "pending", cursor: "gc-next" })
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function resetShellAfterTest() {
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  onTestFinished(() => {
    scrollTo.mockRestore()
    useUiStore.setState({ page: "home", focusId: null, toast: null })
    window.history.replaceState(null, "", "#/")
  })
}

function rowIn(list: HTMLElement, text: string): HTMLElement {
  const row = within(list).getByText(text).closest<HTMLElement>('[role="button"]')
  if (!row) throw new Error(`${text} has no keyboard-operable row`)
  return row
}

function StoreDrivenModerationPage() {
  const focusId = useUiStore((s) => s.focusId)
  return <ModerationPage focusId={focusId} />
}

describe("ModerationPage selection after a decision", () => {
  it("clears the selection once Keep drops the item from the queue, never opening another item's actions", async () => {
    resetShellAfterTest()
    const refetch = deferred<ModerationListResponse>()
    apiMock.listModeration
      .mockResolvedValueOnce(modPage([COMMENT_REPORT, APPEAL]))
      .mockReturnValue(refetch.promise)
    mockModDetails(COMMENT_REPORT, APPEAL)
    apiMock.approveModeration.mockResolvedValue({})
    renderWithQuery(
      <>
        <ModerationPage focusId={null} />
        <DialogHost />
      </>,
    )
    await within(detailCard()).findByRole("heading", { name: "MOD-101" })

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Keep" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }))

    await waitFor(() => expect(apiMock.approveModeration).toHaveBeenCalledWith({ id: "mod-1" }))
    expect(within(detailCard()).getByRole("heading", { name: "MOD-101" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("button", { name: "Overturn" })).not.toBeInTheDocument()

    await act(async () => {
      refetch.resolve(modPage([APPEAL]))
    })
    await waitFor(() => expect(within(listCard("Queue")).queryByText("MOD-101")).not.toBeInTheDocument())
    expect(await within(detailCard()).findByText("No item selected")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("button", { name: "Keep" })).not.toBeInTheDocument()
    expect(within(detailCard()).queryByRole("button", { name: "Overturn" })).not.toBeInTheDocument()
  })

  it("clears a deep-linked item once it is removed, though the list never held it, and opens nothing else", async () => {
    resetShellAfterTest()
    const OTHER = modItem({ id: "mod-9", flag: "MOD-909" })
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT, APPEAL]))
    mockModDetails(COMMENT_REPORT, APPEAL, OTHER)
    apiMock.removeModeration.mockResolvedValue({})
    renderWithQuery(
      <>
        <ModerationPage focusId="mod-9" />
        <DialogHost />
      </>,
    )
    await within(detailCard()).findByRole("heading", { name: "MOD-909" })
    await within(listCard("Queue")).findByText("MOD-101")

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Remove" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }))

    await waitFor(() => expect(apiMock.removeModeration).toHaveBeenCalledWith({ id: "mod-9" }))
    expect(await within(detailCard()).findByText("No item selected")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "MOD-101" })).not.toBeInTheDocument()
    expect(rowIn(listCard("Queue"), "MOD-101")).not.toHaveAttribute("aria-current")
  })

  it("holds the decision buttons disabled until the queue refetch lands, then clears without opening another", async () => {
    resetShellAfterTest()
    const refetch = deferred<ModerationListResponse>()
    apiMock.listModeration
      .mockResolvedValueOnce(modPage([COMMENT_REPORT, APPEAL]))
      .mockReturnValue(refetch.promise)
    mockModDetails(COMMENT_REPORT, APPEAL)
    apiMock.holdModeration.mockResolvedValue({})
    renderWithQuery(
      <>
        <ModerationPage focusId={null} />
        <DialogHost />
      </>,
    )
    await within(detailCard()).findByRole("heading", { name: "MOD-101" })

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Hold" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }))

    await waitFor(() => expect(apiMock.holdModeration).toHaveBeenCalledWith({ id: "mod-1" }))
    await waitFor(() => expect(apiMock.listModeration).toHaveBeenCalledTimes(2))
    for (const name of ["Keep", "Hold", "Remove"]) {
      expect(within(detailCard()).getByRole("button", { name })).toBeDisabled()
    }

    await act(async () => {
      refetch.resolve(modPage([COMMENT_REPORT, APPEAL]))
    })
    expect(await within(detailCard()).findByText("No item selected")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "MOD-202" })).not.toBeInTheDocument()
    expect(rowIn(listCard("Queue"), "MOD-101")).not.toHaveAttribute("aria-current")
    expect(rowIn(listCard("Queue"), "MOD-202")).not.toHaveAttribute("aria-current")
  })

  it("keeps a picked queue item open when a filter drops it from the list", async () => {
    apiMock.listModeration.mockImplementation(async (params: { filter?: string }) =>
      modPage(params.filter === "appeal" ? [APPEAL] : [COMMENT_REPORT, APPEAL]),
    )
    mockModDetails(COMMENT_REPORT, APPEAL)
    renderWithQuery(<ModerationPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "MOD-101" })

    await userEvent.click(screen.getByRole("button", { name: "Appeal" }))

    await waitFor(() => expect(within(listCard("Queue")).queryByText("MOD-101")).not.toBeInTheDocument())
    expect(within(detailCard()).getByRole("heading", { name: "MOD-101" })).toBeInTheDocument()
    expect(rowIn(listCard("Queue"), "MOD-202")).not.toHaveAttribute("aria-current")
  })

  it("keeps a picked claim open when a filter drops it from the list", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockImplementation(async (params: { filter?: string }) =>
      claimPage(params.filter === "approved" ? [NGUYEN] : [RIVERA, NGUYEN]),
    )
    mockClaimDetails(RIVERA, NGUYEN)
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()
    await within(detailCard()).findByRole("heading", { name: "Maya Rivera" })

    await userEvent.click(screen.getByRole("button", { name: "Approved" }))

    await waitFor(() =>
      expect(within(listCard("Gov claims")).queryByText("Maya Rivera")).not.toBeInTheDocument(),
    )
    expect(within(detailCard()).getByRole("heading", { name: "Maya Rivera" })).toBeInTheDocument()
    expect(rowIn(listCard("Gov claims"), "Tom Nguyen")).not.toHaveAttribute("aria-current")
  })

  it("clears a decided claim even while the All list still holds it, and opens no other claim", async () => {
    let rejected = false
    const rivera = () => ({ ...RIVERA, status: rejected ? ("rejected" as const) : RIVERA.status })
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockImplementation(async () => claimPage([rivera(), NGUYEN]))
    apiMock.getGovClaim.mockImplementation(async ({ id }: { id: string }) =>
      id === "gc-1" ? rivera() : NGUYEN,
    )
    apiMock.rejectGovClaim.mockImplementation(async () => {
      rejected = true
      return {}
    })
    renderWithQuery(
      <>
        <ModerationPage focusId={null} />
        <DialogHost />
      </>,
    )
    await openGovClaims()
    await userEvent.click(screen.getByRole("button", { name: "All" }))
    await waitFor(() => expect(apiMock.listGovClaims).toHaveBeenLastCalledWith({}))
    await within(detailCard()).findByRole("heading", { name: "Maya Rivera" })

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Reject" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Not in the directory")
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject claim" }))

    expect(await within(detailCard()).findByText("No claim selected")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Tom Nguyen" })).not.toBeInTheDocument()
    expect(rowIn(listCard("Gov claims"), "Maya Rivera")).not.toHaveAttribute("aria-current")
  })

  it("still confirms Keep when the queue drops the item before the detail refetch settles", async () => {
    resetShellAfterTest()
    const detailRefetch = deferred<ModerationItemDTO>()
    apiMock.listModeration
      .mockResolvedValueOnce(modPage([COMMENT_REPORT, APPEAL]))
      .mockResolvedValue(modPage([APPEAL]))
    apiMock.getModerationItem
      .mockResolvedValueOnce(modDetail(COMMENT_REPORT))
      .mockReturnValue(detailRefetch.promise)
    apiMock.approveModeration.mockResolvedValue({})
    renderWithQuery(
      <>
        <ModerationPage focusId={null} />
        <DialogHost />
      </>,
    )
    await within(detailCard()).findByRole("heading", { name: "MOD-101" })

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Keep" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }))

    expect(await within(detailCard()).findByText("No item selected")).toBeInTheDocument()
    await act(async () => {
      detailRefetch.resolve(modDetail(COMMENT_REPORT))
    })
    await waitFor(() =>
      expect(useUiStore.getState().toast).toMatchObject({ text: "MOD-101 · kept", tone: "ok" }),
    )
  })

  it("words Keep the same way in the button, the dialog and the toast", async () => {
    resetShellAfterTest()
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT]))
    mockModDetails(COMMENT_REPORT)
    apiMock.approveModeration.mockResolvedValue({})
    renderWithQuery(
      <>
        <ModerationPage focusId={null} />
        <DialogHost />
      </>,
    )
    await within(detailCard()).findByRole("heading", { name: "MOD-101" })

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Keep" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "Keep MOD-101" })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Submit" }))
    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe("MOD-101 · kept"))
  })

  it("names the item in the remove dialogs", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT]))
    mockModDetails(COMMENT_REPORT)
    renderWithQuery(
      <>
        <ModerationPage focusId={null} />
        <DialogHost />
      </>,
    )
    await within(detailCard()).findByRole("heading", { name: "MOD-101" })

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Remove" }))
    expect(
      within(await screen.findByRole("dialog")).getByRole("heading", { name: "Remove MOD-101" }),
    ).toBeInTheDocument()
  })

  it("clears the selection once a gov claim decision drops the claim from the list, never opening another", async () => {
    const refetch = deferred<GovClaimListResponse>()
    const SECOND = claim({ id: "gc-3", name: "Lee Park" })
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims
      .mockResolvedValueOnce(claimPage([RIVERA, SECOND]))
      .mockReturnValue(refetch.promise)
    mockClaimDetails(RIVERA, SECOND)
    apiMock.rejectGovClaim.mockResolvedValue({})
    renderWithQuery(
      <>
        <ModerationPage focusId={null} />
        <DialogHost />
      </>,
    )
    await openGovClaims()
    await within(detailCard()).findByRole("heading", { name: "Maya Rivera" })

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Reject" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Not in the directory")
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject claim" }))

    await waitFor(() => expect(apiMock.rejectGovClaim).toHaveBeenCalled())
    expect(within(detailCard()).queryByRole("heading", { name: "Lee Park" })).not.toBeInTheDocument()
    await act(async () => {
      refetch.resolve(claimPage([SECOND]))
    })
    await waitFor(() =>
      expect(within(listCard("Gov claims")).queryByText("Maya Rivera")).not.toBeInTheDocument(),
    )
    expect(await within(detailCard()).findByText("No claim selected")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Lee Park" })).not.toBeInTheDocument()
  })

  it("still confirms a gov claim approval when the list drops the claim before the detail refetch settles", async () => {
    resetShellAfterTest()
    const detailRefetch = deferred<GovClaimDTO>()
    const SECOND = claim({ id: "gc-3", name: "Lee Park" })
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims
      .mockResolvedValueOnce(claimPage([RIVERA, SECOND]))
      .mockResolvedValue(claimPage([SECOND]))
    apiMock.getGovClaim.mockResolvedValueOnce(RIVERA).mockReturnValue(detailRefetch.promise)
    apiMock.approveGovClaim.mockResolvedValue({})
    renderWithQuery(
      <>
        <ModerationPage focusId={null} />
        <DialogHost />
      </>,
    )
    await openGovClaims()
    await within(detailCard()).findByRole("heading", { name: "Maya Rivera" })

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Approve" }))
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve and provision" }),
    )

    expect(await within(detailCard()).findByText("No claim selected")).toBeInTheDocument()
    await act(async () => {
      detailRefetch.resolve({ ...RIVERA, status: "approved" })
    })
    await waitFor(() =>
      expect(useUiStore.getState().toast).toMatchObject({
        text: "Maya Rivera approved · government role provisioned",
        tone: "ok",
      }),
    )
  })

  it("drops the deep link when the operator switches sections, so Queue opens its first item again", async () => {
    resetShellAfterTest()
    useUiStore.setState({ page: "moderation", focusId: "mod-2" })
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT, APPEAL]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([]))
    mockModDetails(COMMENT_REPORT, APPEAL)
    renderWithQuery(<StoreDrivenModerationPage />)
    await within(detailCard()).findByRole("heading", { name: "MOD-202" })

    await openGovClaims()
    await screen.findByText("No claims here")
    await userEvent.click(screen.getByRole("radio", { name: "Queue" }))

    expect(await within(detailCard()).findByRole("heading", { name: "MOD-101" })).toBeInTheDocument()
    expect(useUiStore.getState().focusId).toBeNull()
  })
})

describe("ModerationPage detail", () => {
  it("opens held images in the lightbox and links held videos", async () => {
    const withMedia = modItem({ id: "mod-5", flag: "MOD-505" })
    apiMock.listModeration.mockResolvedValue(modPage([withMedia]))
    apiMock.getModerationItem.mockResolvedValue({
      ...modDetail(withMedia),
      media: [
        { id: "md-1", kind: "image", url: "https://media.example/full-1.jpg", thumbUrl: "https://media.example/thumb-1.jpg" },
        { id: "md-2", kind: "video", url: "https://media.example/clip.mp4" },
      ],
    } satisfies ModerationItemDTO)
    renderWithQuery(
      <>
        <ModerationPage focusId={null} />
        <LightboxHost />
      </>,
    )
    await within(detailCard()).findByRole("heading", { name: "MOD-505" })

    const video = within(detailCard()).getByRole("link", { name: "Held video 1 of 1" })
    expect(video).toHaveAttribute("href", "https://media.example/clip.mp4")
    expect(video).toHaveAttribute("target", "_blank")

    await userEvent.click(within(detailCard()).getByRole("button", { name: "Held image 1 of 1" }))
    const lightbox = await screen.findByRole("dialog", { name: "Held image 1 of 1" })
    expect(within(lightbox).getByRole("img", { name: "Held image 1 of 1" })).toHaveAttribute(
      "src",
      "https://media.example/full-1.jpg",
    )
  })

  it("keeps each signal on its own row when a new signal arrives first", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT]))
    let signals: ModerationItemDTO["signals"] = [{ label: "Prior flags", val: "3", tone: "warn" }]
    apiMock.getModerationItem.mockImplementation(async () => ({ ...modDetail(COMMENT_REPORT), signals }))
    const { client } = renderWithQuery(<ModerationPage focusId={null} />)
    const before = (await within(detailCard()).findByText("Prior flags")).closest(".umr")

    signals = [{ label: "Burst of reports", val: "12", tone: "bad" }, ...signals]
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["admin", "moderation", "detail", "mod-1"] })
    })
    await within(detailCard()).findByText("Burst of reports")
    expect(within(detailCard()).getByText("Prior flags").closest(".umr")).toBe(before)
  })

  it("shows a not-found state without a retry for an item that no longer exists", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT]))
    apiMock.getModerationItem.mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND, "No moderation item mod-gone", { httpStatus: 404 }),
    )
    renderWithQuery(<ModerationPage focusId="mod-gone" />)
    expect(await within(detailCard()).findByText("Item not found")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("shows a not-found state without a retry for a claim that no longer exists", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([RIVERA]))
    apiMock.getGovClaim.mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND, "No gov claim gc-1", { httpStatus: 404 }),
    )
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()
    expect(await within(detailCard()).findByText("Claim not found")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("opens the subject's profile with the Space key", async () => {
    resetShellAfterTest()
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT]))
    mockModDetails(COMMENT_REPORT)
    renderWithQuery(<ModerationPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "MOD-101" })

    within(detailCard()).getByTitle("Open Subject Person's profile").focus()
    await userEvent.keyboard(" ")
    expect(useUiStore.getState()).toMatchObject({ page: "users", focusId: "u-subject" })
  })
})

describe("ModerationPage keyboard and names", () => {
  it("selects queue rows from the keyboard and marks the selected row as current", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([COMMENT_REPORT, APPEAL]))
    mockModDetails(COMMENT_REPORT, APPEAL)
    renderWithQuery(<ModerationPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "MOD-101" })
    const list = listCard("Queue")
    expect(rowIn(list, "MOD-101")).toHaveAttribute("aria-current", "true")

    rowIn(list, "MOD-202").focus()
    await userEvent.keyboard(" ")
    expect(await within(detailCard()).findByRole("heading", { name: "MOD-202" })).toBeInTheDocument()
    expect(rowIn(list, "MOD-202")).toHaveAttribute("aria-current", "true")
    expect(rowIn(list, "MOD-101")).not.toHaveAttribute("aria-current")
  })

  it("selects gov claim rows from the keyboard", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([RIVERA, NGUYEN]))
    mockClaimDetails(RIVERA, NGUYEN)
    renderWithQuery(<ModerationPage focusId={null} />)
    await openGovClaims()
    await within(detailCard()).findByRole("heading", { name: "Maya Rivera" })

    rowIn(listCard("Gov claims"), "Tom Nguyen").focus()
    await userEvent.keyboard("{Enter}")
    expect(await within(detailCard()).findByRole("heading", { name: "Tom Nguyen" })).toBeInTheDocument()
    expect(rowIn(listCard("Gov claims"), "Tom Nguyen")).toHaveAttribute("aria-current", "true")
  })

  it("names both search boxes", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([]))
    renderWithQuery(<ModerationPage focusId={null} />)
    expect(screen.getByRole("textbox", { name: "Search the moderation queue" })).toBeInTheDocument()
    await openGovClaims()
    expect(screen.getByRole("textbox", { name: "Search gov claims" })).toBeInTheDocument()
  })

  it("moves between sections with the arrow keys like a radio group", async () => {
    apiMock.listModeration.mockResolvedValue(modPage([]))
    apiMock.listGovClaims.mockResolvedValue(claimPage([]))
    renderWithQuery(<ModerationPage focusId={null} />)
    const queue = screen.getByRole("radio", { name: "Queue" })
    const govClaims = screen.getByRole("radio", { name: "Gov claims" })
    expect(queue).toHaveAttribute("tabindex", "0")
    expect(govClaims).toHaveAttribute("tabindex", "-1")

    queue.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(govClaims).toHaveAttribute("aria-checked", "true")
    expect(govClaims).toHaveFocus()
    expect(await screen.findByText("No claims here")).toBeInTheDocument()

    await userEvent.keyboard("{ArrowDown}")
    expect(queue).toHaveAttribute("aria-checked", "true")
    expect(queue).toHaveFocus()
  })
})
