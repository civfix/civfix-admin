import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppError, ErrorCode, type AdminDevEnvironment, type AdminDevQueue } from "@civfix/contract"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { formatPreciseDateTime } from "@/lib/dates"
import { errorMessage } from "@/lib/error-messages"
import { useUiStore } from "@/store/ui-store"
import { apiMock } from "@/test/api-mock"
import {
  NO_HEALTH,
  NOW,
  THREE_MIN_AGO,
  badge,
  card,
  env,
  jobCells,
  jobRow,
  jobs,
  openAt,
  queue,
  renderDevPage,
  tab,
} from "@/test/dev"
import { startFakeTimersWithUser } from "@/test/fake-timers"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const INBOUND = queue({
  name: "inbound.sweep",
  owner: "api",
  schedule: "*/5 * * * *",
  counts: { created: 1, retry: 2, active: 3, failed: 4 },
  failedLast24h: 5,
  oldestPendingSeconds: 200,
  lastCompletedAt: THREE_MIN_AGO,
  runnable: true,
})
const RETENTION = queue({ name: "retention.sweep", owner: "worker" })

const FAILED = 6
const FAILED_24H = 7
const OLDEST = 8
const LAST_COMPLETED = 9

const BADGE_LABEL: Record<AdminDevEnvironment, string> = {
  prod: "Production",
  staging: "Staging",
  local: "Local",
  unknown: "Unknown",
}

afterEach(() => {
  vi.useRealTimers()
  useUiStore.setState({ toast: null })
})

async function openJobs(environment: AdminDevEnvironment, queues: AdminDevQueue[] = [INBOUND, RETENTION]) {
  env(environment)
  apiMock.adminSystemHealth.mockResolvedValue(NO_HEALTH)
  apiMock.adminDevJobs.mockResolvedValue(jobs(queues))
  openAt("#jobs")
  renderDevPage()
  await screen.findByRole("table", { name: "Queues" })
  await waitFor(() => expect(badge()).toHaveTextContent(BADGE_LABEL[environment]))
}

async function runNow(name: string): Promise<HTMLElement> {
  await userEvent.click(within(jobRow(name)).getByRole("button", { name: "Run now" }))
  return screen.findByRole("dialog")
}

async function confirmRun(): Promise<void> {
  const dialog = await runNow("inbound.sweep")
  await userEvent.click(within(dialog).getByRole("button", { name: "Run" }))
}

function pageToast(): HTMLElement {
  return document.querySelector(".toast-wrap") as HTMLElement
}

function dangerCells(name: string): number[] {
  return within(jobRow(name))
    .getAllByRole("cell")
    .flatMap((cell, index) => (cell.classList.contains("dev-danger") ? [index] : []))
}

describe("the Jobs tab table", () => {
  it("T14: shows each queue's row, flags failures and waits in danger, and offers Run now only where runnable", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
    await openJobs("staging")

    const headers = within(screen.getByRole("table", { name: "Queues" })).getAllByRole("columnheader")
    expect(headers[FAILED]).toHaveTextContent(/failed/i)
    expect(headers[FAILED_24H]).toHaveTextContent(/failed/i)

    expect(jobCells("inbound.sweep")).toEqual([
      "inbound.sweep",
      "api",
      "*/5 * * * *",
      "1",
      "2",
      "3",
      "4",
      "5",
      "3m 20s",
      "3 min ago",
      "Run now",
    ])
    const lastCompleted = within(jobRow("inbound.sweep")).getAllByRole("cell")[LAST_COMPLETED]!
    expect(within(lastCompleted).getByText("3 min ago")).toHaveAttribute(
      "title",
      formatPreciseDateTime(THREE_MIN_AGO),
    )
    expect(dangerCells("inbound.sweep")).toEqual([FAILED, FAILED_24H, OLDEST])

    expect(jobCells("retention.sweep")).toEqual([
      "retention.sweep",
      "worker",
      "Not set",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0s",
      "None in 2 days",
      "",
    ])
    expect(within(jobRow("retention.sweep")).queryByRole("button", { name: "Run now" })).toBeNull()
    expect(dangerCells("retention.sweep")).toEqual([])
  })

  it("T15: shows a wait over an hour in hours and minutes", async () => {
    await openJobs("staging", [queue({ name: "media.checks", oldestPendingSeconds: 7500 })])

    expect(jobCells("media.checks")[OLDEST]).toBe("2h 5m")
  })

  it("T16: refreshes every 30 seconds while Jobs is open, and stops once it closes", async () => {
    const user = startFakeTimersWithUser()
    vi.setSystemTime(NOW)
    await openJobs("staging")
    expect(apiMock.adminDevJobs).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(apiMock.adminDevJobs).toHaveBeenCalledTimes(2)

    await user.click(tab("Overview"))
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(apiMock.adminDevJobs).toHaveBeenCalledTimes(2)
  })

  it("T22: shows a jobs failure in the tab while the badge and Overview keep working", async () => {
    const error = new AppError(ErrorCode.INTERNAL, "Jobs query timed out")
    env("staging")
    apiMock.adminSystemHealth.mockResolvedValue(NO_HEALTH)
    apiMock.adminDevJobs.mockRejectedValue(error)
    openAt("#jobs")
    renderDevPage()

    expect(await within(screen.getByRole("tabpanel")).findByText(errorMessage(error))).toBeInTheDocument()
    await waitFor(() => expect(badge()).toHaveTextContent("Staging"))

    await userEvent.click(tab("Overview"))
    expect(await screen.findByRole("heading", { name: "Environment and builds", level: 3 })).toBeInTheDocument()
    expect(card("Services")).toBeInTheDocument()
  })
})

describe("Run now", () => {
  it("T17: asks before running, with a plain Run off production, and Cancel runs nothing", async () => {
    await openJobs("staging")

    const dialog = await runNow("inbound.sweep")
    expect(within(dialog).getByRole("heading", { name: "Run inbound.sweep now?" })).toBeInTheDocument()
    const confirm = within(dialog).getByRole("button", { name: "Run" })
    expect(confirm).not.toHaveClass("danger")

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(apiMock.adminDevRunJob).not.toHaveBeenCalled()
  })

  it("T18: says Run on production in the danger style on production", async () => {
    await openJobs("prod")

    const dialog = await runNow("inbound.sweep")
    const confirm = within(dialog).getByRole("button", { name: "Run on production" })
    expect(confirm).toHaveClass("btn", "danger")
  })

  it.each([
    [true, "Run queued"],
    [false, "A run is already waiting"],
  ])("T19/T20: enqueued %s toasts %s and refreshes the queues", async (enqueued, message) => {
    await openJobs("staging")
    apiMock.adminDevRunJob.mockResolvedValue({ enqueued })

    await confirmRun()

    await waitFor(() => expect(pageToast()).toHaveTextContent(message))
    expect(apiMock.adminDevRunJob).toHaveBeenCalledTimes(1)
    expect(apiMock.adminDevRunJob).toHaveBeenCalledWith({ name: "inbound.sweep" })
    await waitFor(() => expect(apiMock.adminDevJobs).toHaveBeenCalledTimes(2))
  })

  it("T21: toasts a refused run on the page, never on the admin shell", async () => {
    const error = new AppError(ErrorCode.NOT_FOUND, "No such queue")
    await openJobs("staging")
    apiMock.adminDevRunJob.mockRejectedValue(error)

    await confirmRun()

    await waitFor(() => expect(pageToast()).toHaveTextContent(errorMessage(error)))
    expect(screen.getByRole("table", { name: "Queues" })).toBeInTheDocument()
    expect(useUiStore.getState().toast).toBeNull()
  })
})
