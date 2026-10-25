import { screen, within } from "@testing-library/react"
import { AppError, ErrorCode, type AdminDevOverviewResponse } from "@civfix/contract"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { formatPreciseDateTime } from "@/lib/dates"
import { errorMessage } from "@/lib/error-messages"
import { apiMock } from "@/test/api-mock"
import { NO_HEALTH, NOW, THREE_MIN_AGO, card, field, overview, renderDevPage } from "@/test/dev"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const API_SHA = "0123456789abcdef0123456789abcdef01234567"
const ADMIN_SHA = "fedcba9876543210fedcba9876543210fedcba98"
const BUILDS = "Environment and builds"

const SEAMS_AND_SETTINGS = {
  seams: [
    { name: "storage", mode: "fake" },
    { name: "push", mode: "real" },
    { name: "geo_coder", mode: "fake" },
  ],
  settings: [{ key: "SMS_DAILY_CAP", value: "500" }],
} satisfies Partial<AdminDevOverviewResponse>

function labelsOf(title: string): string[] {
  return within(card(title))
    .queryAllByRole("term")
    .map((term) => term.textContent ?? "")
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("the Overview tab", () => {
  it("T9: shows the four cards and every build value, with commits linked and times relative", async () => {
    vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", ADMIN_SHA)
    apiMock.adminDevOverview.mockResolvedValue(
      overview({
        environment: "prod",
        api: {
          commit: API_SHA,
          releaseRef: "v1.4.0",
          image: "ghcr.io/civfix/api@sha256:abc",
          startedAt: THREE_MIN_AGO,
          contractVersion: "0.67.0",
          nodeVersion: "v22.11.0",
        },
        worker: { image: "ghcr.io/civfix/worker@sha256:def", lastJobCompletedAt: THREE_MIN_AGO },
      }),
    )
    apiMock.adminSystemHealth.mockResolvedValue(NO_HEALTH)
    renderDevPage()

    const builds = await screen.findByRole("heading", { name: BUILDS, level: 3 })
    expect(
      within(screen.getByRole("tabpanel"))
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([BUILDS, "System health", "Services", "Settings"])
    expect(builds).toBeInTheDocument()

    expect(field(BUILDS, "Environment")).toHaveTextContent("Production")
    expect(within(field(BUILDS, "API commit")).getByRole("link", { name: "0123456" })).toHaveAttribute(
      "href",
      `https://github.com/civfix/civfix-backend/commit/${API_SHA}`,
    )
    expect(field(BUILDS, "Release")).toHaveTextContent("v1.4.0")
    expect(field(BUILDS, "API image")).toHaveTextContent("ghcr.io/civfix/api@sha256:abc")
    expect(field(BUILDS, "Contract version")).toHaveTextContent("0.67.0")
    expect(field(BUILDS, "Node version")).toHaveTextContent("v22.11.0")
    expect(field(BUILDS, "Worker image")).toHaveTextContent("ghcr.io/civfix/worker@sha256:def")
    for (const label of ["API started", "Worker last job"]) {
      const time = within(field(BUILDS, label)).getByText("3 min ago")
      expect(time).toHaveAttribute("title", formatPreciseDateTime(THREE_MIN_AGO))
    }
    expect(within(field(BUILDS, "Admin commit")).getByRole("link", { name: "fedcba9" })).toHaveAttribute(
      "href",
      `https://github.com/civfix/civfix-admin/commit/${ADMIN_SHA}`,
    )
  })

  it("T10: reads Not set for every missing build value and links no commit", async () => {
    vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", "")
    apiMock.adminDevOverview.mockResolvedValue(overview())
    apiMock.adminSystemHealth.mockResolvedValue(NO_HEALTH)
    renderDevPage()

    await screen.findByRole("heading", { name: BUILDS, level: 3 })
    for (const label of ["API commit", "Release", "API image", "Worker image", "Worker last job", "Admin commit"]) {
      expect(field(BUILDS, label), label).toHaveTextContent(/^Not set$/)
    }
    expect(
      screen.queryAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/commit/")),
    ).toEqual([])
  })

  it("T11: names each service for people and lists the settings", async () => {
    apiMock.adminDevOverview.mockResolvedValue(overview(SEAMS_AND_SETTINGS))
    apiMock.adminSystemHealth.mockResolvedValue(NO_HEALTH)
    renderDevPage()

    await screen.findByRole("heading", { name: "Services", level: 3 })
    expect(labelsOf("Services")).toEqual(["Storage", "Push", "Geo coder"])
    expect(field("Services", "Storage")).toHaveTextContent(/^Fake$/)
    expect(field("Services", "Push")).toHaveTextContent(/^Real$/)
    expect(field("Services", "Geo coder")).toHaveTextContent(/^Fake$/)
    expect(labelsOf("Settings")).toEqual(["SMS_DAILY_CAP"])
    expect(field("Settings", "SMS_DAILY_CAP")).toHaveTextContent(/^500$/)
  })

  it("T12: shows each health row with its value and a dot in its own status", async () => {
    apiMock.adminDevOverview.mockResolvedValue(overview())
    apiMock.adminSystemHealth.mockResolvedValue({
      services: [
        { name: "API", status: "ok", val: "p95 142ms" },
        { name: "Redis", status: "warn", val: "slow" },
        { name: "Media worker", status: "down", val: "no heartbeat" },
        { name: "Grafana", status: "not_deployed", val: "not running" },
      ],
    })
    renderDevPage()

    const health = await screen.findByRole("list", { name: "System health" })
    const rows = within(health).getAllByRole("listitem")
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("API"),
      expect.stringContaining("Redis"),
      expect.stringContaining("Media worker"),
      expect.stringContaining("Grafana"),
    ])
    expect(rows[0]).toHaveTextContent("p95 142ms")
    expect(rows[1]).toHaveTextContent("slow")
    expect(rows[2]).toHaveTextContent("no heartbeat")
    expect(rows[3]).toHaveTextContent("not running")
    const dots = rows.map((row) => row.querySelector(".dev-dot"))
    for (const dot of dots) expect(dot).not.toBeNull()
    expect(new Set(dots.map((dot) => dot?.className)).size).toBe(4)
  })

  it("T13: shows a health failure in its card and the other three cards' data", async () => {
    const error = new AppError(ErrorCode.INTERNAL, "Health check failed")
    apiMock.adminDevOverview.mockResolvedValue(overview(SEAMS_AND_SETTINGS))
    apiMock.adminSystemHealth.mockRejectedValue(error)
    renderDevPage()

    expect(await within(card("System health")).findByText(errorMessage(error))).toBeInTheDocument()
    expect(field(BUILDS, "Environment")).toHaveTextContent("Staging")
    expect(field("Services", "Push")).toHaveTextContent("Real")
    expect(field("Settings", "SMS_DAILY_CAP")).toHaveTextContent("500")
  })
})
