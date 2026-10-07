import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import type {
  AdminEventListResponse,
  AdminReportListResponse,
  AdminUserListResponse,
  DiscoveryListResponse,
  HomeSummaryResponse,
  InboundEmailListItemDTO,
  InboxListResponse,
  MailListResponse,
  MailThreadListItemDTO,
  ModerationListResponse,
} from "@civfix/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { HomePage } from "@/features/home/home-page"

// SOURCE is computed when src/lib/source.ts is first evaluated, so the build-time commit must be in
// the environment before the page module loads.
const COMMIT = vi.hoisted(() => {
  const sha = "ABCDEF0123456789ABCDEF0123456789ABCDEF01"
  vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", sha)
  return sha
})

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

vi.mock("@/components/map/live-map", () => ({
  LiveMap: () => <div>live map</div>,
}))

const never = () => new Promise<never>(() => {})

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const summary = {
  discovery: { queue: 12, reportsWaiting: 30, overSla: 4 },
  reports: { flagged: 5, inProgress: 8, completed: 21 },
  events: { upcoming: 3, live: 1, attending: 44 },
  mail: { unread: 1, needsAction: 2 },
  users: { flagged: 6, highRisk: 1, suspended: 0 },
  analytics: {
    pinsThisMonth: 42,
    resolvedPct: 61,
    coveragePct: 77,
    cleanups: 9,
    eventsThisMonth: 4,
    newUsers: 15,
    pinsByWeek: [1, 4, 2, 6],
  },
  livePins24h: 7,
  moderationQueue: 11,
  inboxUnread: 3,
} satisfies HomeSummaryResponse

const actor = { id: "u-9", name: "Dana Reyes", handle: "dana", joined: "2025-01-01" }

const discoveryPage = {
  items: [
    {
      id: "d-1",
      geoid: "0644000",
      place: "Los Angeles",
      layer: "place",
      category: "trash",
      catLabel: "Trash",
      pop: 3898747,
      reports: 17,
      perCategoryCounts: { trash: 17 },
      lastReport: "2026-09-20",
      age: "3d",
      overSla: true,
      priority: "high",
      contactState: { routed: [], missing: ["trash"] },
      notes: [],
    },
    {
      id: "d-2",
      geoid: "0600001",
      place: "Tiny Town",
      layer: "place",
      category: "graffiti",
      catLabel: "Graffiti",
      pop: 0,
      reports: 2,
      perCategoryCounts: { graffiti: 2 },
      lastReport: "2026-09-21",
      age: "1d",
      overSla: false,
      priority: "low",
      contactState: { routed: [], missing: ["graffiti"] },
      notes: [],
    },
  ],
  nextCursor: "next",
} satisfies DiscoveryListResponse

const reportsPage = {
  items: [
    {
      id: "r-1",
      category: "hazard",
      status: "in_progress",
      flagged: false,
      title: "Broken streetlight",
      place: "Echo Park",
      reporter: actor,
      confirmations: 2,
      submitted: { rel: "2h", abs: "Sep 23, 10:00" },
      coords: [34.07, -118.26],
      address: "1 Main St",
      hasPhoto: false,
      thumbnailUrl: null,
    },
  ],
  nextCursor: null,
  counts: { all: 1, submitted: 0, in_progress: 1, completed: 0, flagged: 0 },
} satisfies AdminReportListResponse

const eventsPage = {
  items: [
    {
      id: "e-1",
      status: "upcoming",
      eventKind: "cleanup",
      flagged: false,
      title: "Beach cleanup",
      place: "Venice",
      attendees: 14,
      capacity: 30,
      bags: 0,
      organizer: actor,
      date: { rel: "in 2d", abs: "Sep 25" },
      coords: [33.98, -118.47],
    },
  ],
  nextCursor: null,
  counts: { all: 1, upcoming: 1, in_progress: 0, completed: 0, flagged: 0 },
} satisfies AdminEventListResponse

const outreachThread = {
  id: "m-1",
  dir: "out",
  from: "routing@civfix.org",
  to: "works@la.gov",
  org: "LA Public Works",
  subject: "Pothole on Main",
  preview: "Hello",
  ts: minutesAgo(5),
  unread: false,
  status: "sent",
  jurisdictionGeoid: "0644000",
  reportId: null,
} satisfies MailThreadListItemDTO

const mailPage = { items: [outreachThread], nextCursor: null } satisfies MailListResponse

const inboundEmail = {
  id: "in-1",
  from: "",
  recipient: "hello@civfix.org",
  localPart: "hello",
  subject: "",
  preview: "",
  ts: minutesAgo(9),
  status: "unread",
  unread: true,
  hasAttachments: false,
} satisfies InboundEmailListItemDTO

const inboxPage = { items: [inboundEmail], nextCursor: null } satisfies InboxListResponse

const usersPage = {
  items: [
    {
      id: "u-1",
      name: "Sam Rivera",
      handle: "sam",
      city: "Pasadena",
      joined: "2025-02-02",
      avatar: null,
      status: "review",
      reports: 3,
      cleanups: 0,
      removals: 1,
      strikes: 1,
      risk: "high",
      lastActive: "1h",
      flagged: true,
      flagReason: "Spam pattern",
    },
  ],
  nextCursor: null,
} satisfies AdminUserListResponse

const moderationPage = {
  items: [
    {
      id: "mod-1",
      flag: "flag",
      reporter: "Pat",
      category: null,
      reason: "Harassment",
      age: "20m",
      priority: "med",
      kind: "user_report",
      subjectType: "comment",
      subjectId: "c-1",
      destinationKind: null,
      destinationId: null,
      reporterId: null,
    },
  ],
  nextCursor: null,
} satisfies ModerationListResponse

function mockAllLoaded() {
  apiMock.adminHomeSummary.mockResolvedValue(summary)
  apiMock.listDiscovery.mockResolvedValue(discoveryPage)
  apiMock.listAdminReports.mockResolvedValue(reportsPage)
  apiMock.listAdminEvents.mockResolvedValue(eventsPage)
  apiMock.listMail.mockResolvedValue(mailPage)
  apiMock.listInbox.mockResolvedValue(inboxPage)
  apiMock.listAdminUsers.mockResolvedValue(usersPage)
  apiMock.listModeration.mockResolvedValue(moderationPage)
}

/** The tile a section head button belongs to (the head button and the tile body share one container). */
function tileOf(headName: RegExp): HTMLElement {
  const head = screen.getByRole("button", { name: headName })
  const tile = head.closest("div")
  if (!tile) throw new Error("tile container not found")
  return tile
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  window.history.replaceState(null, "", "/")
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("HomePage", () => {
  it("shows the summary loading state and every preview tile's own loading state, with the launcher and footer", () => {
    apiMock.adminHomeSummary.mockImplementation(never)
    apiMock.listDiscovery.mockImplementation(never)
    apiMock.listAdminReports.mockImplementation(never)
    apiMock.listAdminEvents.mockImplementation(never)
    apiMock.listMail.mockImplementation(never)
    apiMock.listInbox.mockImplementation(never)
    apiMock.listAdminUsers.mockImplementation(never)
    apiMock.listModeration.mockImplementation(never)

    renderWithQuery(<HomePage focusId={null} />)

    expect(screen.getByText("Loading summary...")).toBeInTheDocument()
    expect(screen.getAllByText("Loading...")).toHaveLength(6)
    expect(screen.getByRole("button", { name: /^Reports$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Jurisdictions$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Moderation$/ })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Host platform" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Organizations/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Host messaging/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Signup pages/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Source code \(AGPL-3\.0\)/ })).toBeInTheDocument()
  })

  it("keeps every preview tile when the summary fails and shows one retryable summary error", async () => {
    mockAllLoaded()
    apiMock.adminHomeSummary.mockRejectedValue(new Error("summary exploded"))

    renderWithQuery(<HomePage focusId={null} />)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load the dashboard summary")
    expect(alert).toHaveTextContent("summary exploded")
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    expect(await within(tileOf(/^Jurisdictions$/)).findByText("Los Angeles")).toBeInTheDocument()
    expect(await within(tileOf(/^Reports$/)).findByText("Broken streetlight")).toBeInTheDocument()
    expect(await within(tileOf(/^Mail$/)).findByText("LA Public Works")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Analytics$/ })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Host platform" })).toBeInTheDocument()

    apiMock.adminHomeSummary.mockResolvedValue(summary)
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(
      await screen.findByRole("button", { name: /^Jurisdictions\s*12 jurisdictions in queue$/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Analytics$/ })).toBeInTheDocument()
    expect(apiMock.adminHomeSummary).toHaveBeenCalledTimes(2)
  })

  it("renders the summary tiles with their lead counts from the summary", async () => {
    mockAllLoaded()
    renderWithQuery(<HomePage focusId={null} />)

    expect(
      await screen.findByRole("button", { name: /^Jurisdictions\s*12 jurisdictions in queue$/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Reports\s*5 reports flagged$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Events\s*3 upcoming events$/ })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /^Mail\s*1 unread outreach message$/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Users\s*6 accounts flagged$/ })).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: /^Moderation\s*11 queued \W user reports, held media, clusters and appeals$/,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Jurisdictions with reports waiting on routing setup/),
    ).toBeInTheDocument()

    const analytics = tileOf(/^Analytics$/)
    expect(within(analytics).getByText("42")).toBeInTheDocument()
    expect(within(analytics).getByText("pins this month")).toBeInTheDocument()
    expect(within(analytics).getByText("61%")).toBeInTheDocument()
    expect(within(analytics).getByText("Resolved")).toBeInTheDocument()
    expect(within(analytics).getByText("77%")).toBeInTheDocument()
    expect(within(analytics).getByText("Coverage")).toBeInTheDocument()
    expect(within(analytics).getByText("New users")).toBeInTheDocument()
    expect(within(analytics).getByText("15")).toBeInTheDocument()
    expect(
      within(analytics).getByRole("button", { name: /^9 Cleanups\s*See analytics$/ }),
    ).toBeInTheDocument()
    expect(within(analytics).queryByText("No data yet")).not.toBeInTheDocument()
    expect(
      within(analytics).getByRole("img", { name: "Pins per week, last 4 weeks: 1, 4, 2, 6" }),
    ).toBeInTheDocument()
  })

  it("renders up to two preview rows per tile and the remaining count", async () => {
    mockAllLoaded()
    renderWithQuery(<HomePage focusId={null} />)

    const discovery = await waitFor(() => {
      const tile = tileOf(/^Jurisdictions/)
      within(tile).getByText("Los Angeles")
      return tile
    })
    expect(within(discovery).getByText("17 reports · pop 3.9M")).toBeInTheDocument()
    expect(within(discovery).getByText("3d")).toBeInTheDocument()
    expect(within(discovery).getByText("Tiny Town")).toBeInTheDocument()
    expect(within(discovery).getByText("2 reports")).toBeInTheDocument()
    expect(within(discovery).getByRole("button", { name: /and 10 more cities\s*Open/ })).toBeInTheDocument()

    const reports = tileOf(/^Reports/)
    expect(await within(reports).findByText("Broken streetlight")).toBeInTheDocument()
    expect(within(reports).getByText("Echo Park · In progress")).toBeInTheDocument()
    expect(within(reports).getByText("2h")).toBeInTheDocument()

    const events = tileOf(/^Events/)
    expect(await within(events).findByText("Beach cleanup")).toBeInTheDocument()
    expect(within(events).getByText("Venice · 14 attending")).toBeInTheDocument()
    expect(within(events).getByText("in 2d")).toBeInTheDocument()

    const mail = tileOf(/^Mail/)
    expect(await within(mail).findByText("LA Public Works")).toBeInTheDocument()
    expect(within(mail).getByText("Pothole on Main")).toBeInTheDocument()
    expect(within(mail).getByText("5m")).toBeInTheDocument()
    expect(within(mail).getByText("hello@civfix.org")).toBeInTheDocument()
    expect(within(mail).getByText("(no subject)")).toBeInTheDocument()
    expect(within(mail).getByText("9m")).toBeInTheDocument()

    const users = tileOf(/^Users/)
    expect(await within(users).findByText("Sam Rivera")).toBeInTheDocument()
    expect(within(users).getByText("SR")).toBeInTheDocument()
    expect(within(users).getByText("Spam pattern")).toBeInTheDocument()

    const moderation = tileOf(/^Moderation/)
    expect(await within(moderation).findByText("Reported comment")).toBeInTheDocument()
    expect(within(moderation).getByText("Harassment · Pat")).toBeInTheDocument()

    expect(apiMock.listDiscovery).toHaveBeenCalledWith({ limit: 3 })
    expect(apiMock.listAdminReports).toHaveBeenCalledWith({ limit: 3 })
    expect(apiMock.listAdminEvents).toHaveBeenCalledWith({ limit: 3 })
    expect(apiMock.listMail).toHaveBeenCalledWith({ limit: 3 })
    expect(apiMock.listInbox).toHaveBeenCalledWith({ status: "all", limit: 3 })
    expect(apiMock.listAdminUsers).toHaveBeenCalledWith({ limit: 3 })
    expect(apiMock.listModeration).toHaveBeenCalledWith({ limit: 3 })
  })

  it("shows a per-tile loading state and a per-tile error without taking down the other tiles", async () => {
    mockAllLoaded()
    apiMock.listAdminReports.mockImplementation(never)
    apiMock.listAdminUsers.mockRejectedValue(new Error("users unavailable"))

    renderWithQuery(<HomePage focusId={null} />)

    const users = await waitFor(() => {
      const tile = tileOf(/^Users/)
      within(tile).getByRole("alert")
      return tile
    })
    expect(within(users).getByRole("alert")).toHaveTextContent("Could not load this")
    expect(within(users).getByRole("alert")).toHaveTextContent("users unavailable")
    expect(screen.getAllByRole("alert")).toHaveLength(1)

    const reports = tileOf(/^Reports/)
    expect(within(reports).getByRole("status")).toHaveTextContent("Loading...")

    expect(await within(tileOf(/^Events/)).findByText("Beach cleanup")).toBeInTheDocument()

    apiMock.listAdminUsers.mockResolvedValue(usersPage)
    fireEvent.click(within(users).getByRole("button", { name: "Try again" }))
    expect(await within(tileOf(/^Users/)).findByText("Sam Rivera")).toBeInTheDocument()
  })

  it("keeps the outreach rows and shows a retryable inbox error when only the inbox half fails", async () => {
    mockAllLoaded()
    apiMock.listInbox.mockRejectedValue(new Error("inbox down"))

    renderWithQuery(<HomePage focusId={null} />)

    const mail = await waitFor(() => {
      const tile = tileOf(/^Mail/)
      within(tile).getByRole("alert")
      return tile
    })
    const alert = within(mail).getByRole("alert")
    expect(alert).toHaveTextContent("Could not load the inbox")
    expect(alert).toHaveTextContent("inbox down")
    expect(within(mail).getByText("LA Public Works")).toBeInTheDocument()

    apiMock.listInbox.mockResolvedValue(inboxPage)
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await within(tileOf(/^Mail/)).findByText("hello@civfix.org")).toBeInTheDocument()
    expect(within(tileOf(/^Mail/)).queryByRole("alert")).not.toBeInTheDocument()
    expect(apiMock.listMail).toHaveBeenCalledTimes(1)
  })

  it("keeps the inbox rows and shows a retryable outreach error when only the outreach half fails", async () => {
    mockAllLoaded()
    apiMock.listMail.mockRejectedValue(new Error("outreach down"))

    renderWithQuery(<HomePage focusId={null} />)

    const mail = await waitFor(() => {
      const tile = tileOf(/^Mail/)
      within(tile).getByRole("alert")
      return tile
    })
    expect(within(mail).getByRole("alert")).toHaveTextContent("Could not load outreach mail")
    expect(within(mail).getByRole("alert")).toHaveTextContent("outreach down")
    expect(within(mail).getByText("hello@civfix.org")).toBeInTheDocument()
  })

  it("merges outreach and inbound mail newest first with relative ages", async () => {
    mockAllLoaded()
    apiMock.listMail.mockResolvedValue({
      items: [
        { ...outreachThread, id: "m-1", org: "Older outreach", ts: minutesAgo(120) },
        { ...outreachThread, id: "m-2", org: "Oldest outreach", ts: minutesAgo(180) },
      ],
      nextCursor: null,
    } satisfies MailListResponse)
    apiMock.listInbox.mockResolvedValue({
      items: [{ ...inboundEmail, id: "in-1", from: "resident@example.com", ts: minutesAgo(60) }],
      nextCursor: null,
    } satisfies InboxListResponse)

    renderWithQuery(<HomePage focusId={null} />)

    const mail = await waitFor(() => {
      const tile = tileOf(/^Mail/)
      within(tile).getByText("resident@example.com")
      return tile
    })
    const rows = within(mail)
      .getAllByRole("button")
      .filter((b) => b.classList.contains("slr"))
    expect(rows.map((r) => r.querySelector(".slr-title")?.textContent)).toEqual([
      "resident@example.com",
      "Older outreach",
    ])
    expect(rows.map((r) => r.querySelector(".slr-age")?.textContent)).toEqual(["1h", "2h"])
    expect(within(mail).queryByText("Oldest outreach")).not.toBeInTheDocument()
    expect(within(mail).queryByText(/T\d\d:\d\d/)).not.toBeInTheDocument()
  })

  it("shows an empty line in every preview tile when the lists come back empty", async () => {
    mockAllLoaded()
    const empty = { items: [], nextCursor: null }
    apiMock.listDiscovery.mockResolvedValue(empty satisfies DiscoveryListResponse)
    apiMock.listAdminReports.mockResolvedValue({ ...empty, counts: reportsPage.counts })
    apiMock.listAdminEvents.mockResolvedValue({ ...empty, counts: eventsPage.counts })
    apiMock.listMail.mockResolvedValue(empty satisfies MailListResponse)
    apiMock.listInbox.mockResolvedValue(empty satisfies InboxListResponse)
    apiMock.listAdminUsers.mockResolvedValue(empty satisfies AdminUserListResponse)
    apiMock.listModeration.mockResolvedValue(empty satisfies ModerationListResponse)

    renderWithQuery(<HomePage focusId={null} />)

    await waitFor(() => expect(screen.getAllByText("Nothing here right now.")).toHaveLength(6))
    expect(screen.queryByText(/more cities/)).not.toBeInTheDocument()
  })

  it("leads the moderation tile with a label and shows an empty spark when the summary has no counts", async () => {
    mockAllLoaded()
    const { moderationQueue: _queue, inboxUnread: _unread, ...rest } = summary
    apiMock.adminHomeSummary.mockResolvedValue({
      ...rest,
      analytics: { ...summary.analytics, pinsByWeek: [0, 0, 0] },
    } satisfies HomeSummaryResponse)

    renderWithQuery(<HomePage focusId={null} />)

    expect(
      await screen.findByRole("button", {
        name: /^Moderation\s*user reports, held media, clusters and appeals$/,
      }),
    ).toBeInTheDocument()
    expect(within(tileOf(/^Analytics$/)).getByText("No data yet")).toBeInTheDocument()
  })

  it("opens the matching section with the row's focus when a preview row is clicked", async () => {
    mockAllLoaded()
    renderWithQuery(<HomePage focusId={null} />)

    fireEvent.click(await screen.findByRole("button", { name: /Los Angeles/ }))
    expect(window.location.hash).toBe("#/discovery/0644000")

    fireEvent.click(await screen.findByRole("button", { name: /hello@civfix\.org/ }))
    expect(window.location.hash).toBe("#/mail/inbox%3Ain-1")

    fireEvent.click(screen.getByRole("button", { name: /^Reports\s*5 reports flagged$/ }))
    expect(window.location.hash).toBe("#/reports")

    fireEvent.click(screen.getByRole("button", { name: /Signup pages/ }))
    expect(window.location.hash).toBe("#/pages")
  })

  it("links the footer source to the repository at the build commit", () => {
    apiMock.adminHomeSummary.mockImplementation(never)
    apiMock.listDiscovery.mockImplementation(never)
    apiMock.listAdminReports.mockImplementation(never)
    apiMock.listAdminEvents.mockImplementation(never)
    apiMock.listMail.mockImplementation(never)
    apiMock.listInbox.mockImplementation(never)
    apiMock.listAdminUsers.mockImplementation(never)
    apiMock.listModeration.mockImplementation(never)

    renderWithQuery(<HomePage focusId={null} />)

    const link = screen.getByRole("link", { name: /Source code \(AGPL-3\.0\)/ })
    expect(link).toHaveAttribute(
      "href",
      `https://github.com/civfix/civfix-admin/tree/${COMMIT.toLowerCase()}`,
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noreferrer noopener")
    expect(screen.getByText(COMMIT.toLowerCase().slice(0, 7))).toBeInTheDocument()
  })
})
