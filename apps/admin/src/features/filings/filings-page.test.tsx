import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { AdminFilingDTO, FilingSettingsDTO, ListFilingsResponse } from "@civfix/contract"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { DialogHost } from "@/components/shared/dialog"
import { formatDateTime } from "@/lib/dates"
import { apiMock } from "@/test/api-mock"
import { filingRow } from "@/test/filings"
import { renderWithQuery } from "@/test/render"
import { useUiStore } from "@/store/ui-store"
import { FilingsPage } from "@/features/filings/filings-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const PAUSED_BANNER = "Automatic filing is paused. Approved reports wait in Queued."
const OFF_BANNER =
  "Automatic filing is off in this environment. Portal filings go to Needs a human."
const COUNTS = { needs_human: 4, in_progress: 2 }
const RUNNING: FilingSettingsDTO = { paused: false, automaticFiling: true }

function page(items: AdminFilingDTO[], nextCursor: string | null = null): ListFilingsResponse {
  return { items, nextCursor, counts: COUNTS }
}

function rows(n: number, from = 1): AdminFilingDTO[] {
  return Array.from({ length: n }, (_, i) =>
    filingRow({
      id: `f-${from + i}`,
      reportId: `r-${from + i}`,
      reportTitle: `Report ${from + i}`,
    }),
  )
}

function renderPage(settings: FilingSettingsDTO = RUNNING) {
  apiMock.getFilingSettings.mockResolvedValue(settings)
  return renderWithQuery(
    <>
      <FilingsPage focusId={null} />
      <DialogHost />
    </>,
  )
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  window.history.replaceState(null, "", "/")
})

describe("FilingsPage", () => {
  it("T33: lists Needs a human first, with the counts on the first two tabs", async () => {
    apiMock.listFilings.mockResolvedValue(page([]))
    renderPage()
    await waitFor(() => expect(apiMock.listFilings).toHaveBeenCalledWith({ group: "needs_human" }))
    await screen.findByText("Nothing needs a human")
    const tabs = screen.getAllByRole("tab")
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Needs a human4",
      "In progress2",
      "Filed",
      "Cancelled",
    ])
    expect(tabs[0]).toHaveAttribute("aria-selected", "true")
  })

  it("T34: asks for the In progress group", async () => {
    apiMock.listFilings.mockResolvedValue(page([]))
    renderPage()
    await userEvent.click(screen.getByRole("tab", { name: /In progress/ }))
    await waitFor(() => expect(apiMock.listFilings).toHaveBeenCalledWith({ group: "in_progress" }))
  })

  it("T35: pages 50 rows at a time in server order", async () => {
    apiMock.listFilings
      .mockResolvedValueOnce(page(rows(50), "c1"))
      .mockResolvedValueOnce(page(rows(3, 51), null))
    renderPage()
    await screen.findByText("Report 50")
    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    await waitFor(() =>
      expect(apiMock.listFilings).toHaveBeenLastCalledWith({ group: "needs_human", cursor: "c1" }),
    )
    await screen.findByText("Report 53")
    expect(screen.getAllByText(/^Report \d+$/).map((el) => el.textContent)).toEqual(
      Array.from({ length: 53 }, (_, i) => `Report ${i + 1}`),
    )
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("T36: shows each row's report, jurisdiction, channel, reason or request number and update time", async () => {
    const human = filingRow({
      id: "f-h",
      reportTitle: "Couch on 5th",
      referenceCode: "CF-0001",
      jurisdictionName: "Los Angeles",
      channel: "portal",
      status: "needs_human",
      reason: "captcha",
      updatedAt: "2026-10-21T09:30:00.000Z",
    })
    const filed = filingRow({
      id: "f-f",
      reportTitle: "Graffiti on Main",
      referenceCode: "CF-0002",
      jurisdictionName: "Pasadena",
      channel: "email",
      status: "submitted",
      caseId: "1-2345678901",
      updatedAt: "2026-10-22T14:00:00.000Z",
    })
    apiMock.listFilings.mockResolvedValue(page([human, filed]))
    renderPage()

    const humanRow = (await screen.findByText("Couch on 5th")).closest<HTMLElement>(
      "[role=button]",
    )!
    for (const text of ["CF-0001", "Los Angeles", "Portal", "The city site showed a CAPTCHA"]) {
      expect(within(humanRow).getByText(text)).toBeInTheDocument()
    }
    expect(within(humanRow).getByText(formatDateTime(human.updatedAt))).toBeInTheDocument()

    const filedRow = screen.getByText("Graffiti on Main").closest<HTMLElement>("[role=button]")!
    for (const text of ["CF-0002", "Pasadena", "Email", "1-2345678901"]) {
      expect(within(filedRow).getByText(text)).toBeInTheDocument()
    }
    expect(within(filedRow).getByText(formatDateTime(filed.updatedAt))).toBeInTheDocument()
  })

  it("T37: opens the report of a clicked row", async () => {
    apiMock.listFilings.mockResolvedValue(page(rows(1)))
    renderPage()
    await userEvent.click(await screen.findByText("Report 1"))
    expect(useUiStore.getState().page).toBe("reports")
    expect(useUiStore.getState().focusId).toBe("r-1")
  })

  it("T38: words an empty page on each tab", async () => {
    apiMock.listFilings.mockResolvedValue(page([]))
    renderPage()
    expect(await screen.findByText("Nothing needs a human")).toBeInTheDocument()
    for (const [tab, empty] of [
      ["In progress", "Nothing in progress"],
      ["Filed", "Nothing filed yet"],
      ["Cancelled", "Nothing cancelled"],
    ] as const) {
      await userEvent.click(screen.getByRole("tab", { name: new RegExp(`^${tab}`) }))
      expect(await screen.findByText(empty)).toBeInTheDocument()
    }
  })

  it("T39: shows the loading state, then the error state with a retry", async () => {
    apiMock.listFilings.mockReturnValue(new Promise(() => {}))
    const loading = renderPage()
    expect(screen.getByText("Loading filings...")).toBeInTheDocument()
    loading.unmount()

    apiMock.listFilings.mockReset()
    apiMock.listFilings.mockRejectedValue(new Error("filings backend unreachable"))
    renderPage()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("filings backend unreachable")
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(apiMock.listFilings).toHaveBeenCalledTimes(2))
  })

  it("T40: pauses automatic filing only once the operator confirms", async () => {
    apiMock.listFilings.mockResolvedValue(page([]))
    apiMock.setFilingSettings.mockResolvedValue({ paused: true, automaticFiling: true })
    renderPage(RUNNING)
    const pause = await screen.findByRole("button", { name: "Pause automatic filing" })
    expect(screen.queryByText(PAUSED_BANNER)).not.toBeInTheDocument()
    expect(screen.queryByText(OFF_BANNER)).not.toBeInTheDocument()

    await userEvent.click(pause)
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }),
    )
    expect(apiMock.setFilingSettings).not.toHaveBeenCalled()

    await userEvent.click(pause)
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Pause filing" }))
    await waitFor(() => expect(apiMock.setFilingSettings).toHaveBeenCalledWith({ paused: true }))
  })

  it("T41: shows the paused banner and resumes without a confirm", async () => {
    apiMock.listFilings.mockResolvedValue(page([]))
    apiMock.setFilingSettings.mockResolvedValue(RUNNING)
    renderPage({ paused: true, automaticFiling: true })
    expect(await screen.findByText(PAUSED_BANNER)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Resume automatic filing" }))
    await waitFor(() => expect(apiMock.setFilingSettings).toHaveBeenCalledWith({ paused: false }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("T42: shows the off banner when automatic filing is off", async () => {
    apiMock.listFilings.mockResolvedValue(page([]))
    renderPage({ paused: false, automaticFiling: false })
    expect(await screen.findByText(OFF_BANNER)).toBeInTheDocument()
  })
})
