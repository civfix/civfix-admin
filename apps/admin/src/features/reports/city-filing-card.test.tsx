import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  AppError,
  ErrorCode,
  type AdminReportDTO,
  type AdminReportFilingRoute,
  type FilingEvidenceDTO,
  type GetFilingResponse,
} from "@civfix/contract"
import type { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import type * as LightboxModule from "@/components/shared/lightbox"
import { DialogHost } from "@/components/shared/dialog"
import { openLightbox } from "@/components/shared/lightbox"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { startFakeTimersWithUser } from "@/test/fake-timers"
import {
  FILING_ID,
  REPORT_ID,
  filingDTO,
  getFilingResponse,
  reportDetail,
  type ReportFiling,
} from "@/test/filings"
import { makeTestQueryClient, renderWithQuery } from "@/test/render"
import { spyToasts } from "@/test/toasts"
import { ReportDetail } from "@/features/reports/report-detail"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

vi.mock("@/components/map/leaflet-map", () => ({
  LeafletMap: () => <div data-testid="leaflet-map" />,
}))

vi.mock("@/components/shared/lightbox", async (importOriginal) => ({
  ...(await importOriginal<typeof LightboxModule>()),
  openLightbox: vi.fn(),
}))

afterEach(() => {
  vi.mocked(openLightbox).mockReset()
})

const ACTIONS = [
  "Approve and file",
  "File",
  "File again",
  "Retry",
  "Cancel filing",
  "Record manual filing",
  "Copy report text",
] as const

const SCREENSHOT: FilingEvidenceDTO = {
  id: "e-1",
  kind: "screenshot",
  label: "Form filled",
  url: "https://r2.example/form.png?sig=1",
  createdAt: "2026-10-20T11:00:00.000Z",
}
const SCRIPT: FilingEvidenceDTO = {
  id: "e-2",
  kind: "script",
  label: "Script",
  url: "https://r2.example/script.ts?sig=1",
  createdAt: "2026-10-20T11:00:00.000Z",
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function mockReport(report: AdminReportDTO) {
  apiMock.getAdminReport.mockResolvedValue(report)
  apiMock.adminReportMessages.mockResolvedValue({ items: [], nextCursor: null })
  if (report.filing) apiMock.getFiling.mockResolvedValue(getFilingResponse(report.filing))
}

function renderDetail(report: AdminReportDTO, client: QueryClient = makeTestQueryClient()) {
  mockReport(report)
  return renderWithQuery(
    <>
      <ReportDetail reportId={report.id} onRemoved={() => {}} />
      <DialogHost />
    </>,
    client,
  )
}

function card(): HTMLElement {
  const head = screen.getByText("City filing")
  const sub = head.closest<HTMLElement>(".sub")
  if (!sub) throw new Error("City filing card is not rendered")
  return sub
}

async function findCard(): Promise<HTMLElement> {
  await screen.findByText("City filing")
  return card()
}

function invalidatedKeys(client: QueryClient) {
  const spy = vi.spyOn(client, "invalidateQueries")
  return () => spy.mock.calls.map(([filters]) => filters?.queryKey)
}

const THREE_KEYS = [queryKeys.reports.detail(REPORT_ID), queryKeys.filings.all, queryKeys.home.all]

function expectThreeKeys(keys: unknown[]) {
  expect(keys).toEqual(expect.arrayContaining(THREE_KEYS))
}

function withFiling(filing: Partial<ReportFiling>, over: Partial<AdminReportDTO> = {}) {
  return reportDetail({ verificationVerdict: "approved", filing: filingDTO(filing), ...over })
}

const ROUTE_LINES = /^(Portal · .+|Email · .+|Manual route|No route — needs a human)$/

describe("CityFilingCard", () => {
  it("T5: heads the card City filing with the verdict pill and the reporter line, and drops Send to jurisdiction", async () => {
    renderDetail(reportDetail({ verificationVerdict: null }))
    const c = await findCard()
    expect(within(c).getByText("Not yet reviewed")).toBeInTheDocument()
    expect(within(c).getByText(/Reporter:/)).toBeInTheDocument()
    expect(screen.queryByText(/Send to jurisdiction/)).not.toBeInTheDocument()
  })

  it.each<[string, AdminReportFilingRoute | null, string]>([
    ["portal", { channel: "portal", target: "myla311.lacity.gov" }, "Portal · myla311.lacity.gov"],
    ["email", { channel: "email", target: "311@lacity.org" }, "Email · 311@lacity.org"],
    ["manual", { channel: "manual", target: null }, "Manual route"],
    ["none", null, "No route — needs a human"],
  ])("T6: shows the %s route line", async (_name, filingRoute, line) => {
    renderDetail(reportDetail({ filingRoute }))
    const c = await findCard()
    expect(within(c).getByText(line)).toBeInTheDocument()
  })

  it("T6: shows no route line when the field is absent", async () => {
    renderDetail(reportDetail())
    const c = await findCard()
    expect(within(c).queryByText(ROUTE_LINES)).not.toBeInTheDocument()
  })

  it("T7: shows a filed request with its number, a Copy button and a link to the city site", async () => {
    renderDetail(
      withFiling({
        status: "submitted",
        caseId: "1-2345678901",
        caseUrl: "https://myla311.lacity.gov/s/x",
      }),
    )
    const c = await findCard()
    expect(within(c).getByText("Filed")).toBeInTheDocument()
    expect(within(c).getByText("1-2345678901")).toBeInTheDocument()
    expect(within(c).getByRole("button", { name: "Copy" })).toBeInTheDocument()
    const link = within(c).getByRole("link", { name: "Open on city site" })
    expect(link).toHaveAttribute("href", "https://myla311.lacity.gov/s/x")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
  })

  it("T8: shows a linked filing", async () => {
    renderDetail(withFiling({ status: "linked_existing", caseId: "1-111" }))
    const c = await findCard()
    expect(within(c).getByText("Linked")).toBeInTheDocument()
    expect(within(c).getByText("Linked to existing city request")).toBeInTheDocument()
  })

  it("T9: shows why a filing needs a human, its detail under it and the attempts", async () => {
    renderDetail(
      withFiling({
        status: "needs_human",
        reason: "captcha",
        reasonDetail: "Blocked at step 3",
        attempts: 2,
      }),
    )
    const c = await findCard()
    expect(within(c).getByText("Needs a human")).toBeInTheDocument()
    const reason = within(c).getByText("The city site showed a CAPTCHA")
    const detail = within(c).getByText("Blocked at step 3")
    expect(reason.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(c).getByText("Attempts: 2")).toBeInTheDocument()
  })

  it("T10: offers no city-site link without a case URL", async () => {
    renderDetail(withFiling({ status: "submitted", caseId: "1-2345678901", caseUrl: null }))
    const c = await findCard()
    expect(within(c).getByText("Filed")).toBeInTheDocument()
    expect(within(c).queryByRole("link", { name: "Open on city site" })).not.toBeInTheDocument()
  })

  it("T11: shows the report's filing until getFiling loads, then its screenshots, script link and version", async () => {
    const report = withFiling({ status: "needs_human", reason: "captcha" })
    const pending = deferred<GetFilingResponse>()
    renderDetail(report)
    apiMock.getFiling.mockReturnValue(pending.promise)
    const c = await findCard()
    expect(within(c).getByText("Needs a human")).toBeInTheDocument()
    expect(within(c).queryByRole("img", { name: "Form filled" })).not.toBeInTheDocument()

    await act(async () => {
      pending.resolve(
        getFilingResponse({ ...report.filing!, scriptVersion: "a1b2c3d4e5f6" }, [SCREENSHOT, SCRIPT]),
      )
    })
    expect(await within(c).findByRole("img", { name: "Form filled" })).toBeInTheDocument()
    const script = within(c).getByRole("link", { name: "View script" })
    expect(script).toHaveAttribute("href", SCRIPT.url)
    expect(script).toHaveAttribute("target", "_blank")
    expect(within(c).getByText("script a1b2c3d4e5f6")).toBeInTheDocument()
  })

  it("T12: fetches the filing each time the card mounts", async () => {
    const client = makeTestQueryClient()
    const report = withFiling({ status: "submitted", caseId: "1-111" })
    const first = renderDetail(report, client)
    await findCard()
    await waitFor(() => expect(apiMock.getFiling).toHaveBeenCalledTimes(1))
    first.unmount()

    renderDetail(report, client)
    await findCard()
    await waitFor(() => expect(apiMock.getFiling).toHaveBeenCalledTimes(2))
    expect(apiMock.getFiling).toHaveBeenNthCalledWith(1, { id: FILING_ID })
    expect(apiMock.getFiling).toHaveBeenNthCalledWith(2, { id: FILING_ID })
  })

  it("T13: opens a screenshot in the lightbox with a refresh that refetches the filing", async () => {
    const report = withFiling({ status: "needs_human", reason: "captcha" })
    renderDetail(report)
    apiMock.getFiling.mockResolvedValue(getFilingResponse(report.filing!, [SCREENSHOT, SCRIPT]))
    const c = await findCard()
    await userEvent.click(await within(c).findByRole("img", { name: "Form filled" }))

    expect(openLightbox).toHaveBeenCalledWith(
      [{ id: SCREENSHOT.id, url: SCREENSHOT.url, alt: "Form filled" }],
      0,
      expect.any(Function),
    )
    const calls = apiMock.getFiling.mock.calls.length
    const refresh = vi.mocked(openLightbox).mock.calls[0]![2]!
    act(() => refresh())
    await waitFor(() => expect(apiMock.getFiling).toHaveBeenCalledTimes(calls + 1))
  })

  it("T14: shows no script version when the filing has none", async () => {
    renderDetail(withFiling({ status: "submitted", caseId: "1-111", scriptVersion: null }))
    const c = await findCard()
    await waitFor(() => expect(apiMock.getFiling).toHaveBeenCalled())
    expect(within(c).queryByText(/^script /)).not.toBeInTheDocument()
  })

  it("T15: polls a queued filing every 5 seconds and stops once it is filed, refreshing the three keys", async () => {
    startFakeTimersWithUser()
    const report = withFiling({ status: "queued" })
    const client = makeTestQueryClient()
    const keys = invalidatedKeys(client)
    renderDetail(report, client)
    apiMock.getFiling
      .mockResolvedValueOnce(getFilingResponse(report.filing!))
      .mockResolvedValue(getFilingResponse({ ...report.filing!, status: "submitted", caseId: "1-111" }))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(apiMock.getFiling).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(4_900))
    expect(apiMock.getFiling).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(100))
    expect(apiMock.getFiling).toHaveBeenCalledTimes(2)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expectThreeKeys(keys())

    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(apiMock.getFiling).toHaveBeenCalledTimes(2)
  })

  it("T16: does not poll a filing that needs a human", async () => {
    startFakeTimersWithUser()
    renderDetail(withFiling({ status: "needs_human", reason: "captcha" }))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(apiMock.getFiling).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(apiMock.getFiling).toHaveBeenCalledTimes(1)
  })

  it.each<[string, AdminReportDTO["verificationVerdict"], boolean]>([
    ["unreviewed", null, true],
    ["rejected", "rejected", true],
    ["approved", "approved", false],
  ])("T17: an %s report offers Approve and file: %s", async (_name, verdict, offered) => {
    renderDetail(reportDetail({ verificationVerdict: verdict }))
    const c = await findCard()
    expect(within(c).queryByRole("button", { name: "Approve and file" }) !== null).toBe(offered)
  })

  it.each<[string, AdminReportFilingRoute | null, string]>([
    ["email", { channel: "email", target: "311@lacity.org" }, "Email · 311@lacity.org"],
    ["no", null, "No route — needs a human"],
  ])("T18: names the %s route in the Approve and file confirm, then approves and refreshes", async (_n, filingRoute, line) => {
    const client = makeTestQueryClient()
    const keys = invalidatedKeys(client)
    renderDetail(reportDetail({ filingRoute }), client)
    apiMock.setReportVerdict.mockResolvedValue({ ok: true })
    const c = await findCard()
    await userEvent.click(within(c).getByRole("button", { name: "Approve and file" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent(line)

    await userEvent.click(within(dialog).getByRole("button", { name: "Approve and file" }))
    await waitFor(() =>
      expect(apiMock.setReportVerdict).toHaveBeenCalledWith({ id: REPORT_ID, verdict: "approved" }),
    )
    await waitFor(() => expectThreeKeys(keys()))
    expect(apiMock.routeReport).not.toHaveBeenCalled()
  })

  const STATES: [string, AdminReportDTO, (typeof ACTIONS)[number][]][] = [
    ["verdict approved, no filing", reportDetail({ verificationVerdict: "approved", filing: null }), ["File"]],
    ["verdict null, no filing", reportDetail({ verificationVerdict: null, filing: null }), ["Approve and file"]],
    ["queued", withFiling({ status: "queued" }), ["Cancel filing", "Record manual filing", "Copy report text"]],
    ["running", withFiling({ status: "running" }), ["Copy report text"]],
    [
      "needs_human no_route",
      withFiling({ status: "needs_human", reason: "no_route" }),
      ["Retry", "Cancel filing", "Record manual filing", "Copy report text"],
    ],
    [
      "needs_human city_needs_info",
      withFiling({ status: "needs_human", reason: "city_needs_info", caseId: "1-111" }),
      ["Record manual filing", "Copy report text"],
    ],
    ["submitted, city open", withFiling({ status: "submitted", caseId: "1-111" }), ["Copy report text"]],
    [
      "submitted, city closed",
      withFiling({ status: "submitted", caseId: "1-111", cityClosedAt: "2026-10-22T00:00:00.000Z" }),
      ["File again", "Copy report text"],
    ],
    [
      "linked_existing, city closed",
      withFiling({ status: "linked_existing", caseId: "1-111", cityClosedAt: "2026-10-22T00:00:00.000Z" }),
      ["File again", "Copy report text"],
    ],
    ["cancelled", withFiling({ status: "cancelled" }), ["File again", "Copy report text"]],
    [
      "cancelled on a rejected report",
      withFiling({ status: "cancelled" }, { verificationVerdict: "rejected", status: "rejected" }),
      ["Approve and file", "Copy report text"],
    ],
    [
      "city closed on a report whose status is rejected",
      withFiling(
        { status: "submitted", caseId: "1-111", cityClosedAt: "2026-10-22T00:00:00.000Z" },
        { status: "rejected" },
      ),
      ["Copy report text"],
    ],
  ]

  it.each(STATES)("T19: offers exactly the allowed actions: %s", async (_name, report, offered) => {
    renderDetail(report)
    const c = await findCard()
    if (report.filing) await waitFor(() => expect(apiMock.getFiling).toHaveBeenCalled())
    for (const action of ACTIONS) {
      const present = within(c).queryByRole("button", { name: action }) !== null
      expect(present, action).toBe(offered.includes(action))
    }
  })

  it("T20: files with the note, then without one, under the schema's note limit", async () => {
    const client = makeTestQueryClient()
    const keys = invalidatedKeys(client)
    renderDetail(reportDetail({ verificationVerdict: "approved" }), client)
    apiMock.fileReport.mockResolvedValue({ filing: filingDTO() })
    const user = userEvent.setup()
    const c = await findCard()

    await user.click(within(c).getByRole("button", { name: "File" }))
    const note = within(c).getByRole("textbox", { name: "Note for the city" })
    expect(note).toHaveAttribute("maxlength", "500")
    await user.type(note, "Call first")
    await user.click(within(c).getByRole("button", { name: "File" }))
    await waitFor(() => expect(apiMock.fileReport).toHaveBeenCalledWith({ id: REPORT_ID, note: "Call first" }))
    await waitFor(() => expectThreeKeys(keys()))

    await user.click(await within(c).findByRole("button", { name: "File" }))
    await user.click(within(c).getByRole("button", { name: "File" }))
    await waitFor(() => expect(apiMock.fileReport).toHaveBeenCalledTimes(2))
    expect(apiMock.fileReport.mock.calls[1]![0]).toEqual({ id: REPORT_ID })
  })

  it("T21: says why File was refused on a conflict", async () => {
    renderDetail(reportDetail({ verificationVerdict: "approved" }))
    apiMock.fileReport.mockRejectedValue(new AppError(ErrorCode.CONFLICT, "Report has an open filing"))
    const user = userEvent.setup()
    const c = await findCard()
    await user.click(within(c).getByRole("button", { name: "File" }))
    await user.click(within(c).getByRole("button", { name: "File" }))
    expect(
      await within(c).findByText("This report already has an active or open filing"),
    ).toBeInTheDocument()
  })

  it.each([
    ["Retry", "needs_human", "retryFiling"],
    ["Cancel filing", "queued", "cancelFiling"],
  ] as const)("T22: %s calls the API with the filing id and refreshes", async (button, status, method) => {
    const client = makeTestQueryClient()
    const keys = invalidatedKeys(client)
    const report = withFiling({ status, reason: status === "needs_human" ? "captcha" : null })
    renderDetail(report, client)
    apiMock[method].mockResolvedValue({ filing: filingDTO({ status: "queued" }) })
    const c = await findCard()
    await userEvent.click(within(c).getByRole("button", { name: button }))
    await waitFor(() => expect(apiMock[method]).toHaveBeenCalledWith({ id: FILING_ID }))
    await waitFor(() => expectThreeKeys(keys()))
  })

  async function openManualForm(report: AdminReportDTO) {
    renderDetail(report)
    const user = userEvent.setup()
    const c = await findCard()
    await user.click(within(c).getByRole("button", { name: "Record manual filing" }))
    const form = within(c).getByRole("group", { name: "Record manual filing" })
    return { user, form }
  }

  it("T23: records a manual filing without an empty note and refreshes", async () => {
    const client = makeTestQueryClient()
    const keys = invalidatedKeys(client)
    renderDetail(withFiling({ status: "needs_human", reason: "captcha" }), client)
    apiMock.recordManualFiling.mockResolvedValue({ filing: filingDTO({ status: "submitted" }) })
    const user = userEvent.setup()
    const c = await findCard()
    await user.click(within(c).getByRole("button", { name: "Record manual filing" }))
    const form = within(within(c).getByRole("group", { name: "Record manual filing" }))
    await user.type(form.getByRole("textbox", { name: "Request number" }), "1-2345678901")
    await user.type(form.getByRole("textbox", { name: "Link on the city site" }), "https://myla311.lacity.gov/s/")
    await user.click(form.getByRole("button", { name: "Record" }))

    await waitFor(() => expect(apiMock.recordManualFiling).toHaveBeenCalledTimes(1))
    const input = apiMock.recordManualFiling.mock.calls[0]![0]
    expect(input).toEqual({ id: FILING_ID, caseId: "1-2345678901", caseUrl: "https://myla311.lacity.gov/s/" })
    expect(input).not.toHaveProperty("note")
    await waitFor(() => expectThreeKeys(keys()))
  })

  it.each([
    ["an empty number", "", ""],
    ["a number starting with a dash", "-bad", ""],
    ["a 65-character number", "1".repeat(65), ""],
    ["an http link", "1-111", "http://x.org"],
  ])("T24: sends nothing for %s and shows a field error", async (_name, number, link) => {
    const { user, form } = await openManualForm(withFiling({ status: "needs_human", reason: "captcha" }))
    const f = within(form)
    if (number) await user.type(f.getByRole("textbox", { name: "Request number" }), number)
    if (link) await user.type(f.getByRole("textbox", { name: "Link on the city site" }), link)
    await user.click(f.getByRole("button", { name: "Record" }))
    expect(await f.findByRole("alert")).toBeInTheDocument()
    expect(apiMock.recordManualFiling).not.toHaveBeenCalled()
  })

  it("T25: shows a server error inside the form and keeps it open", async () => {
    const { user, form } = await openManualForm(withFiling({ status: "queued" }))
    apiMock.recordManualFiling.mockRejectedValue(new AppError(ErrorCode.CONFLICT, "Filing is running"))
    const f = within(form)
    await user.type(f.getByRole("textbox", { name: "Request number" }), "1-2345678901")
    await user.click(f.getByRole("button", { name: "Record" }))
    expect(await f.findByText("Filing is running")).toBeInTheDocument()
    expect(f.getByRole("textbox", { name: "Request number" })).toBeInTheDocument()
  })

  it("T26: pre-fills the request number when the city asked for more information", async () => {
    const { form } = await openManualForm(
      withFiling({ status: "needs_human", reason: "city_needs_info", caseId: "1-111" }),
    )
    expect(within(form).getByRole("textbox", { name: "Request number" })).toHaveValue("1-111")
  })

  describe("T27: copying", () => {
    const report = withFiling({ status: "submitted", caseId: "1-2345678901" })

    function stubClipboard(clipboard: { writeText: (text: string) => Promise<void> } | undefined) {
      Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true })
    }

    afterEach(() => stubClipboard(undefined))

    it("copies the report text and the request number", async () => {
      const writeText = vi.fn(() => Promise.resolve())
      stubClipboard({ writeText })
      const toasts = spyToasts()
      renderDetail(report)
      const c = await findCard()

      fireEvent.click(within(c).getByRole("button", { name: "Copy report text" }))
      expect(writeText).toHaveBeenCalledWith(report.filing!.ticketText)
      await waitFor(() => expect(toasts).toHaveBeenCalledWith("Report text copied"))

      fireEvent.click(within(c).getByRole("button", { name: "Copy" }))
      expect(writeText).toHaveBeenLastCalledWith("1-2345678901")
    })

    it("toasts an error and copies nothing without a clipboard", async () => {
      stubClipboard(undefined)
      const toasts = spyToasts()
      renderDetail(report)
      const c = await findCard()
      fireEvent.click(within(c).getByRole("button", { name: "Copy report text" }))
      expect(toasts).toHaveBeenCalledWith(expect.any(String), "error")
      expect(toasts).not.toHaveBeenCalledWith("Report text copied")
    })
  })

  it("T43: shows the filing area's error while the rest of the card renders, and retries", async () => {
    const report = withFiling({ status: "needs_human", reason: "captcha" })
    renderDetail(report)
    apiMock.getFiling.mockRejectedValue(new Error("filings backend unreachable"))
    const c = await findCard()
    const alert = await within(c).findByRole("alert")
    expect(alert).toHaveTextContent("filings backend unreachable")
    expect(within(c).getByText("Approved")).toBeInTheDocument()
    expect(within(c).getByRole("button", { name: /Reject/ })).toBeInTheDocument()

    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(apiMock.getFiling).toHaveBeenCalledTimes(2))
  })
})
