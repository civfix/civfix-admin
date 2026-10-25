import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppError, ErrorCode, type AdminDevEnvironment } from "@civfix/contract"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { apiMock } from "@/test/api-mock"
import { NO_HEALTH, badge, env, header, jobs, openAt, queue, renderDevPage, tab } from "@/test/dev"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const TAB_NAMES = ["Overview", "Jobs", "Flags", "Test tools", "Audit"]

async function badgeOf(environment: AdminDevEnvironment): Promise<{ text: string; className: string }> {
  env(environment)
  apiMock.adminSystemHealth.mockResolvedValue(NO_HEALTH)
  const { unmount } = renderDevPage()
  await waitFor(() => expect(badge()).not.toBeNull())
  const el = badge() as HTMLElement
  const result = { text: el.textContent ?? "", className: el.className }
  unmount()
  return result
}

describe("the developer page header", () => {
  it("T2: shows the header, Back to admin and the five tabs, with no badge while loading", () => {
    apiMock.adminDevOverview.mockReturnValue(new Promise(() => {}))
    apiMock.adminSystemHealth.mockReturnValue(new Promise(() => {}))
    renderDevPage()

    expect(within(header()).getByRole("heading", { name: "civfix developer", level: 1 })).toBeInTheDocument()
    expect(within(header()).getByRole("link", { name: "Back to admin" })).toHaveAttribute("href", "/")
    expect(within(screen.getByRole("tablist")).getAllByRole("tab").map((t) => t.textContent)).toEqual(TAB_NAMES)
    expect(tab("Overview")).toHaveAttribute("aria-selected", "true")
    for (const name of TAB_NAMES.slice(1)) expect(tab(name)).toHaveAttribute("aria-selected", "false")
    expect(badge()).toBeNull()
  })

  it("T3: badges Production and titles the tab with it", async () => {
    expect(await badgeOf("prod")).toMatchObject({ text: "Production" })
    expect(document.title).toBe("Developer · Production")
  })

  it.each([
    ["staging", "Staging"],
    ["local", "Local"],
    ["unknown", "Unknown"],
  ] as const)("T4: badges %s as %s and titles the tab with it", async (environment, label) => {
    expect(await badgeOf(environment)).toMatchObject({ text: label })
    expect(document.title).toBe(`Developer · ${label}`)
  })

  it("T4: tones Production and Staging apart, and Local and Unknown alike in a third tone", async () => {
    const prod = (await badgeOf("prod")).className
    const staging = (await badgeOf("staging")).className
    const local = (await badgeOf("local")).className
    const unknown = (await badgeOf("unknown")).className

    expect(prod).not.toBe(staging)
    expect(local).toBe(unknown)
    expect(local).not.toBe(prod)
    expect(local).not.toBe(staging)
  })

  it("T5: badges Unknown when the overview fails, shows its message, and Jobs still works", async () => {
    const error = new AppError(ErrorCode.INTERNAL, "Overview is down")
    apiMock.adminDevOverview.mockRejectedValue(error)
    apiMock.adminSystemHealth.mockResolvedValue(NO_HEALTH)
    apiMock.adminDevJobs.mockResolvedValue(jobs([queue({ name: "inbound.sweep" })]))
    renderDevPage()

    await waitFor(() => expect(badge()).toHaveTextContent("Unknown"))
    expect(document.title).toBe("Developer · Unknown")
    expect(screen.getByRole("tabpanel")).toHaveTextContent(errorMessage(error))

    await userEvent.click(tab("Jobs"))
    expect(await screen.findByRole("table", { name: "Queues" })).toHaveTextContent("inbound.sweep")
  })
})

describe("the developer page tabs", () => {
  it("T6: #jobs opens Jobs with its table", async () => {
    env("staging")
    apiMock.adminDevJobs.mockResolvedValue(jobs([queue({ name: "inbound.sweep" })]))
    openAt("#jobs")
    renderDevPage()

    expect(tab("Jobs")).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByRole("table", { name: "Queues" })).toBeInTheDocument()
  })

  it("T6: #audit opens Audit with its log", async () => {
    env("staging")
    apiMock.listAudit.mockResolvedValue({ items: [], nextCursor: null })
    apiMock.adminActivity.mockResolvedValue({ items: [], nextCursor: null })
    openAt("#audit")
    renderDevPage()

    expect(tab("Audit")).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByRole("heading", { name: "Audit log", level: 3 })).toBeInTheDocument()
  })

  it.each([
    ["#flags", "Flags"],
    ["#test-tools", "Test tools"],
  ])("T6: %s opens %s, which is coming soon", (hash, name) => {
    env("staging")
    openAt(hash)
    renderDevPage()

    expect(tab(name)).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Coming soon.")
  })

  it("T6: an unknown hash opens Overview", () => {
    apiMock.adminDevOverview.mockReturnValue(new Promise(() => {}))
    apiMock.adminSystemHealth.mockReturnValue(new Promise(() => {}))
    openAt("#nope")
    renderDevPage()

    expect(tab("Overview")).toHaveAttribute("aria-selected", "true")
  })

  it("T7: a click writes the tab to the hash, and a hash change selects its tab", async () => {
    env("staging")
    apiMock.adminSystemHealth.mockResolvedValue(NO_HEALTH)
    apiMock.adminDevJobs.mockResolvedValue(jobs([]))
    renderDevPage()

    await userEvent.click(tab("Test tools"))
    expect(window.location.hash).toBe("#test-tools")
    expect(tab("Test tools")).toHaveAttribute("aria-selected", "true")

    act(() => {
      window.location.hash = "#jobs"
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })
    await waitFor(() => expect(tab("Jobs")).toHaveAttribute("aria-selected", "true"))
    expect(tab("Test tools")).toHaveAttribute("aria-selected", "false")
  })
})
