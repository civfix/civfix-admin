import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AdminEventListItemDTO,
  AdminEventListResponse,
  AdminReportListItemDTO,
  AdminReportListResponse,
  AdminUserListItemDTO,
  AdminUserListResponse,
  DiscoveryListResponse,
  DiscoveryTaskDTO,
  HomeSummaryResponse,
  InboxListResponse,
  MailListResponse,
  ModerationListItemDTO,
  ModerationListResponse,
} from "@civfix/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { HomePage } from "@/features/home/home-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

// The live map loads Leaflet through next/dynamic; it is outside the tiles under test.
vi.mock("@/components/map/live-map", () => ({
  LiveMap: () => <div>live map</div>,
}))

const summary = {
  discovery: { queue: 4, reportsWaiting: 9, overSla: 1 },
  reports: { flagged: 2, inProgress: 3, completed: 5 },
  events: { upcoming: 2, live: 0, attending: 12 },
  mail: { unread: 2, needsAction: 1 },
  users: { flagged: 2, highRisk: 1, suspended: 0 },
  analytics: {
    pinsThisMonth: 20,
    resolvedPct: 50,
    coveragePct: 70,
    cleanups: 3,
    eventsThisMonth: 2,
    newUsers: 6,
    pinsByWeek: [1, 3, 2],
  },
  livePins24h: 4,
  moderationQueue: 2,
  inboxUnread: 1,
} satisfies HomeSummaryResponse

const actor = { id: "u-9", name: "Dana Reyes", handle: "dana", joined: "2025-01-01" }

function discoveryTask(n: number): DiscoveryTaskDTO {
  return {
    id: `d-${n}`,
    geoid: `06000${n}`,
    place: `Place ${n}`,
    layer: "place",
    category: "trash",
    catLabel: "Trash",
    pop: 1200,
    reports: 3,
    perCategoryCounts: { trash: 3 },
    lastReport: "2026-09-20",
    age: "2d",
    overSla: false,
    priority: "low",
    contactState: { routed: [], missing: ["trash"] },
    notes: [],
  }
}

function report(n: number): AdminReportListItemDTO {
  return {
    id: `r-${n}`,
    category: "graffiti",
    status: "submitted",
    flagged: false,
    title: `Report ${n}`,
    place: "Echo Park",
    reporter: actor,
    confirmations: 0,
    submitted: { rel: "1h", abs: "Sep 23, 10:00" },
    coords: [34.07, -118.26],
    address: "1 Main St",
    hasPhoto: false,
    thumbnailUrl: null,
  }
}

function event(n: number): AdminEventListItemDTO {
  return {
    id: `e-${n}`,
    status: "upcoming",
    eventKind: "cleanup",
    flagged: false,
    title: `Event ${n}`,
    place: "Venice",
    attendees: 5,
    capacity: null,
    bags: 0,
    organizer: actor,
    date: { rel: "in 2d", abs: "Sep 25" },
    coords: [33.98, -118.47],
  }
}

function user(n: number): AdminUserListItemDTO {
  return {
    id: `u-${n}`,
    name: `User ${n}`,
    handle: `user${n}`,
    city: "Pasadena",
    joined: "2025-02-02",
    avatar: null,
    status: "active",
    reports: 1,
    cleanups: 0,
    removals: 0,
    strikes: 0,
    risk: "low",
    lastActive: "1h",
    flagged: false,
    flagReason: null,
  }
}

function moderationItem(n: number): ModerationListItemDTO {
  return {
    id: `mod-${n}`,
    flag: "flag",
    reporter: "Pat",
    category: null,
    reason: "Spam",
    age: "20m",
    priority: "low",
    kind: "image",
    subjectId: `s-${n}`,
    destinationKind: null,
    destinationId: null,
    reporterId: null,
  }
}

const mailPage = {
  items: [
    {
      id: "m-1",
      dir: "out",
      from: "routing@civfix.org",
      to: "works@la.gov",
      org: "LA Public Works",
      subject: "Pothole on Main",
      preview: "Hello",
      ts: "5m",
      unread: false,
      status: "sent",
      jurisdictionGeoid: null,
      reportId: null,
    },
  ],
  nextCursor: null,
} satisfies MailListResponse

const inboxPage = {
  items: [
    {
      id: "in-1",
      from: "resident@example.com",
      recipient: "hello@civfix.org",
      localPart: "hello",
      subject: "Question",
      preview: "",
      ts: "9m",
      status: "unread",
      unread: true,
      hasAttachments: false,
    },
  ],
  nextCursor: null,
} satisfies InboxListResponse

function mockPopulatedHome() {
  apiMock.adminHomeSummary.mockResolvedValue(summary)
  apiMock.listDiscovery.mockResolvedValue({
    items: [discoveryTask(1), discoveryTask(2)],
    nextCursor: null,
  } satisfies DiscoveryListResponse)
  apiMock.listAdminReports.mockResolvedValue({
    items: [report(1), report(2)],
    nextCursor: null,
    counts: { all: 2, submitted: 2, in_progress: 0, completed: 0, flagged: 0 },
  } satisfies AdminReportListResponse)
  apiMock.listAdminEvents.mockResolvedValue({
    items: [event(1), event(2)],
    nextCursor: null,
    counts: { all: 2, upcoming: 2, in_progress: 0, completed: 0, flagged: 0 },
  } satisfies AdminEventListResponse)
  apiMock.listMail.mockResolvedValue(mailPage)
  apiMock.listInbox.mockResolvedValue(inboxPage)
  apiMock.listAdminUsers.mockResolvedValue({
    items: [user(1), user(2)],
    nextCursor: null,
  } satisfies AdminUserListResponse)
  apiMock.listModeration.mockResolvedValue({
    items: [moderationItem(1), moderationItem(2)],
    nextCursor: null,
  } satisfies ModerationListResponse)
}

const PREVIEW_TILES = 6
const ROWS_PER_TILE = 2

async function renderLoadedHome(): Promise<HTMLElement> {
  mockPopulatedHome()
  const { container } = renderWithQuery(<HomePage focusId={null} />)
  await waitFor(() =>
    expect(container.querySelectorAll(".slr")).toHaveLength(PREVIEW_TILES * ROWS_PER_TILE),
  )
  return container
}

function tilesOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".stile")]
}

/**
 * React keeps each host element's current props on an expando property. Reading it is the only way a
 * rendered DOM can show that no custom key handler was attached to a control.
 */
function reactPropsOf(el: Element): Record<string, unknown> {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"))
  return key ? ((el as unknown as Record<string, Record<string, unknown>>)[key] ?? {}) : {}
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  window.history.replaceState(null, "", "/")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("home tile accessibility structure", () => {
  it("renders every section tile with a native head and foot button as sibling controls", async () => {
    const container = await renderLoadedHome()

    const tiles = tilesOf(container)
    expect(tiles).toHaveLength(PREVIEW_TILES + 1)
    for (const tile of tiles) {
      const children = [...tile.children]
      const head = children[0]
      const foot = children[children.length - 1]

      expect(head?.tagName).toBe("BUTTON")
      expect(head).toHaveAttribute("type", "button")
      expect(head).toHaveClass("stile-head")

      expect(foot?.tagName).toBe("BUTTON")
      expect(foot).toHaveAttribute("type", "button")
      expect(foot).toHaveClass("stile-foot", "opens")

      expect(tile.tagName).not.toBe("BUTTON")
      expect(tile).not.toHaveAttribute("role")
      expect(tile.querySelectorAll(".stile-head")).toHaveLength(1)
      expect(tile.querySelectorAll(".stile-foot")).toHaveLength(1)
    }
  })

  it("renders every preview row as a native type=button with the slr class", async () => {
    const container = await renderLoadedHome()

    const rows = [...container.querySelectorAll(".slr")]
    expect(rows).toHaveLength(PREVIEW_TILES * ROWS_PER_TILE)
    for (const row of rows) {
      expect(row.tagName).toBe("BUTTON")
      expect(row).toHaveAttribute("type", "button")
      expect(row).toHaveClass("slr")
      expect(row.closest(".stile-list")).not.toBeNull()
      expect(row.parentElement?.closest("button")).toBeNull()
    }
  })

  it("uses only native buttons as the tile controls", async () => {
    const container = await renderLoadedHome()

    for (const tile of tilesOf(container)) {
      for (const button of tile.querySelectorAll("button")) {
        expect(
          ["stile-head", "stile-foot", "slr"].some((cls) => button.classList.contains(cls)),
        ).toBe(true)
      }
    }
  })

  it("sets no role=button, tabindex or custom key handler anywhere inside a tile", async () => {
    const container = await renderLoadedHome()

    for (const tile of tilesOf(container)) {
      // Guards against a vacuous pass if React ever stops exposing props on the element.
      expect(reactPropsOf(tile.querySelector(".stile-head")!)).toHaveProperty("onClick")
      expect(tile.querySelectorAll('[role="button"]')).toHaveLength(0)
      expect(tile.querySelectorAll("[tabindex]")).toHaveLength(0)
      for (const el of [tile, ...tile.querySelectorAll("*")]) {
        const props = reactPropsOf(el)
        expect(props).not.toHaveProperty("onKeyDown")
        expect(props).not.toHaveProperty("onKeyUp")
        expect(props).not.toHaveProperty("onKeyPress")
        expect(props).not.toHaveProperty("tabIndex")
        expect(props).not.toHaveProperty("role")
      }
    }
  })

  it("puts no div and no nested interactive element inside any tile button", async () => {
    const container = await renderLoadedHome()

    const buttons = tilesOf(container).flatMap((tile) => [...tile.querySelectorAll("button")])
    expect(buttons).toHaveLength((PREVIEW_TILES + 1) * 2 + PREVIEW_TILES * ROWS_PER_TILE)
    for (const button of buttons) {
      expect(button.querySelector("div")).toBeNull()
      expect(button.querySelector("button, a, input, select, textarea, [tabindex], [role]")).toBeNull()
    }
  })

  it("activates tile controls from the keyboard through native button behavior", async () => {
    const container = await renderLoadedHome()
    const kb = userEvent.setup()

    const row = screen.getByRole("button", { name: /Place 1/ })
    row.focus()
    await kb.keyboard("{Enter}")
    expect(window.location.hash).toBe("#/discovery/060001")

    const reportsHead = tilesOf(container)
      .map((tile) => tile.querySelector<HTMLButtonElement>(".stile-head"))
      .find((head) => head?.textContent?.startsWith("Reports"))
    reportsHead?.focus()
    await kb.keyboard(" ")
    expect(window.location.hash).toBe("#/reports")
  })
})
