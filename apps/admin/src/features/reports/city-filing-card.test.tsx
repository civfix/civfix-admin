import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  type AdminReportDTO,
  type AdminReportFilingRoute,
  type FilingEvidenceDTO,
  type GetFilingResponse,
} from "@civfix/contract"
import { partialMatchKey, type QueryClient, type QueryKey } from "@tanstack/react-query"
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
} from "@/test/filings"
import type { ReportFiling } from "@/features/filings/use-filings"
import { makeTestQueryClient, renderWithQuery } from "@/test/render"
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

// invalidateKeys skips a key that a broader one in the same batch covers (reports.all covers a report's
// detail), so a key counts as invalidated when any invalidated key is a prefix of it.
function expectThreeKeys(keys: unknown[]) {
  for (const key of THREE_KEYS) {
    expect(
      keys.some((k) => Array.isArray(k) && partialMatchKey(key, k as QueryKey)),
      JSON.stringify(key),
    ).toBe(true)
  }
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
