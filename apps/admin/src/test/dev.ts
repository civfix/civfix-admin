import { screen, within } from "@testing-library/react"
import { createElement } from "react"
import type {
  AdminDevEnvironment,
  AdminDevJobsResponse,
  AdminDevOverviewResponse,
  AdminDevQueue,
  SystemHealthResponse,
} from "@civfix/contract"
import { afterEach, vi } from "vitest"

import DevRoute from "@/app/dev/page"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"

export const NOW = new Date("2026-10-20T12:00:00.000Z")
export const THREE_MIN_AGO = new Date(NOW.getTime() - 3 * 60_000).toISOString()

export function overview(overrides: Partial<AdminDevOverviewResponse> = {}): AdminDevOverviewResponse {
  return {
    environment: "staging",
    devToolsEnabled: true,
    api: {
      commit: null,
      releaseRef: null,
      image: null,
      startedAt: THREE_MIN_AGO,
      contractVersion: "0.67.0",
      nodeVersion: "v22.11.0",
    },
    worker: { image: null, lastJobCompletedAt: null },
    seams: [],
    settings: [],
    testAccounts: [],
    ...overrides,
  } satisfies AdminDevOverviewResponse
}

export function env(environment: AdminDevEnvironment): void {
  apiMock.adminDevOverview.mockResolvedValue(overview({ environment }))
}

export function queue(overrides: Partial<AdminDevQueue> & { name: string }): AdminDevQueue {
  return {
    owner: "api",
    schedule: null,
    counts: { created: 0, retry: 0, active: 0, failed: 0 },
    failedLast24h: 0,
    oldestPendingSeconds: 0,
    lastCompletedAt: null,
    runnable: false,
    ...overrides,
  } satisfies AdminDevQueue
}

export function jobs(queues: AdminDevQueue[]): AdminDevJobsResponse {
  return { queues } satisfies AdminDevJobsResponse
}

export const NO_HEALTH: SystemHealthResponse = { services: [] }

/** Puts `/dev/<hash>` in the address bar before the page mounts; every test starts with no hash. */
export function openAt(hash: string): void {
  window.history.replaceState(null, "", `/dev/${hash}`)
}

afterEach(() => {
  window.history.replaceState(null, "", "/dev/")
  document.title = ""
  vi.unstubAllEnvs()
})

export function renderDevPage() {
  return renderWithQuery(createElement(DevRoute))
}

export function header(): HTMLElement {
  return screen.getByRole("banner")
}

export function badge(): HTMLElement | null {
  return header().querySelector(".dev-env-badge")
}

export function tab(name: string): HTMLElement {
  return within(screen.getByRole("tablist")).getByRole("tab", { name })
}

export function card(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title, level: 3 }).closest(".card") as HTMLElement
}

/** The row of a key/value card whose label is `label`. */
export function field(title: string, label: string): HTMLElement {
  return within(card(title)).getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement
}

export function jobRow(name: string): HTMLElement {
  return within(screen.getByRole("table", { name: "Queues" }))
    .getByText(name)
    .closest('[role="row"]') as HTMLElement
}

export function jobCells(name: string): string[] {
  return within(jobRow(name))
    .getAllByRole("cell")
    .map((cell) => cell.textContent ?? "")
}
