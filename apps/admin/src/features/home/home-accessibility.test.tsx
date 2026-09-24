import { waitFor } from "@testing-library/react"
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

const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]"
const HEAD_AND_FOOT = 2
const TILE_CONTROLS = (PREVIEW_TILES + 1) * HEAD_AND_FOOT + PREVIEW_TILES * ROWS_PER_TILE

function controlsOf(tile: HTMLElement): HTMLElement[] {
  return [...tile.querySelectorAll<HTMLElement>(FOCUSABLE)]
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  window.history.replaceState(null, "", "/")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("home tile accessibility", () => {
  it("makes every focusable element in a tile a named native type=button with no focusable or div inside", async () => {
    const container = await renderLoadedHome()

    const tiles = tilesOf(container)
    expect(tiles).toHaveLength(PREVIEW_TILES + 1)
    const controls = tiles.flatMap(controlsOf)
    expect(controls).toHaveLength(TILE_CONTROLS)
    for (const control of controls) {
      expect(control.tagName).toBe("BUTTON")
      expect(control).toHaveAttribute("type", "button")
      expect(control).toHaveAccessibleName()
      expect(control.querySelector(FOCUSABLE)).toBeNull()
      expect(control.querySelector("div")).toBeNull()
    }
  })

  it("sets no role=button and no tabindex on a tile or anything inside it", async () => {
    const container = await renderLoadedHome()

    const tiles = tilesOf(container)
    expect(tiles).toHaveLength(PREVIEW_TILES + 1)
    for (const tile of tiles) {
      for (const el of [tile, ...tile.querySelectorAll("*")]) {
        expect(el).not.toHaveAttribute("role", "button")
        expect(el).not.toHaveAttribute("tabindex")
      }
    }
  })

  it("visits each tile control exactly once, in DOM order, when tabbing through the page", async () => {
    const container = await renderLoadedHome()
    const kb = userEvent.setup()

    const visited: Element[] = []
    for (let i = 0; i < 500; i++) {
      await kb.tab()
      const active = document.activeElement
      if (!active || active === document.body || visited.includes(active)) break
      visited.push(active)
    }

    const tiles = tilesOf(container)
    expect(tiles).toHaveLength(PREVIEW_TILES + 1)
    for (const tile of tiles) {
      const expected = controlsOf(tile)
      expect(expected.length).toBeGreaterThanOrEqual(HEAD_AND_FOOT)
      expect(visited.filter((el) => tile.contains(el))).toEqual(expected)
    }
  })

  it("activates every head, foot and row control exactly once on Enter and on Space", async () => {
    const container = await renderLoadedHome()
    const kb = userEvent.setup()
    const scrollTo = vi.mocked(window.scrollTo)
    const pushState = vi.spyOn(window.history, "pushState")

    async function press(control: HTMLElement, key: string): Promise<string> {
      window.history.replaceState(null, "", "/")
      scrollTo.mockClear()
      pushState.mockClear()
      control.focus()
      expect(control).toHaveFocus()
      await kb.keyboard(key)
      expect(scrollTo).toHaveBeenCalledTimes(1)
      expect(pushState).toHaveBeenCalledTimes(1)
      return window.location.hash
    }

    let activated = 0
    for (const tile of tilesOf(container)) {
      const controls = controlsOf(tile)
      const head = controls[0]!
      const foot = controls[controls.length - 1]!
      const tileHash = await press(head, "{Enter}")
      expect(tileHash).toMatch(/^#\/[a-z]+$/)

      for (const control of controls) {
        const onEnter = await press(control, "{Enter}")
        const onSpace = await press(control, " ")
        expect(onSpace).toBe(onEnter)
        if (control === head || control === foot) expect(onEnter).toBe(tileHash)
        else expect(onEnter.startsWith(`${tileHash}/`)).toBe(true)
        activated++
      }
    }
    expect(activated).toBe(TILE_CONTROLS)
  })
})
