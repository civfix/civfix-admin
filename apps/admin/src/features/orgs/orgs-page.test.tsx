import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import type {
  AdminOrgDTO,
  AdminOrgEventListResponse,
  AdminOrgListResponse,
  AdminOrgMemberListResponse,
  GetAdminOrgResponse,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { OrgsPage } from "@/features/orgs/orgs-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})


const OWNER = { id: "u-owner", name: "Rosa Park", handle: "@rosa", joined: "2025-01-01" }

function makeOrg(overrides: Partial<AdminOrgDTO> = {}): AdminOrgDTO {
  return {
    id: "org-1",
    slug: "river-keepers",
    name: "River Keepers",
    description: "We clean the river.",
    websiteUrl: "https://riverkeepers.org",
    logoUrl: null,
    verifiedStatus: "verified",
    verifiedKind: "nonprofit",
    verifiedAt: "2026-02-01T10:00:00.000Z",
    createdAt: "2026-01-01T10:00:00.000Z",
    deletedAt: null,
    memberCount: 3,
    eventCount: 1,
    owner: OWNER,
    verification: null,
    donationUrl: null,
    suspendedAt: null,
    suspendedReason: null,
    updatedAt: null,
    socialLinks: null,
    logoMediaId: null,
    ...overrides,
  } satisfies AdminOrgDTO
}

const RIVER = makeOrg()
const PARK = makeOrg({
  id: "org-2",
  slug: "park-friends",
  name: "Park Friends",
  verifiedStatus: "pending",
  verifiedKind: null,
  memberCount: 1,
  eventCount: 0,
  owner: null,
})

const COUNTS = { all: 5, verified: 3, pending: 1, suspended: 0 }

function listPage(
  items: AdminOrgDTO[],
  extra: Partial<AdminOrgListResponse> = {},
): AdminOrgListResponse {
  return { items, nextCursor: null, counts: COUNTS, ...extra } satisfies AdminOrgListResponse
}

function mockOrgDetails(...orgs: AdminOrgDTO[]) {
  apiMock.adminGetOrg.mockImplementation(({ id }: { id: string }) => {
    const org = orgs.find((o) => o.id === id)
    return org
      ? Promise.resolve(org satisfies GetAdminOrgResponse)
      : Promise.reject(new Error(`no org ${id}`))
  })
}

async function detailHeading(name: string) {
  return screen.findByRole("heading", { level: 2, name })
}

describe("OrgsPage list states", () => {
  it("shows a loading state while the list is in flight and no detail selected", async () => {
    apiMock.adminListOrgs.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<OrgsPage focusId={null} />)

    expect(await screen.findByRole("status")).toHaveTextContent("Loading organizations...")
    expect(screen.getByText("No organization selected")).toBeInTheDocument()
    expect(apiMock.adminListOrgs).toHaveBeenCalledWith({})
    expect(apiMock.adminGetOrg).not.toHaveBeenCalled()
  })

  it("shows the empty state for the All filter", async () => {
    apiMock.adminListOrgs.mockResolvedValue(
      listPage([], { counts: { all: 0, verified: 0, pending: 0, suspended: 0 } }),
    )
    renderWithQuery(<OrgsPage focusId={null} />)

    expect(await screen.findByText("No organizations")).toBeInTheDocument()
    expect(screen.getByText("No organization matches this filter or search.")).toBeInTheDocument()
    expect(screen.getByText("No organization selected")).toBeInTheDocument()
    expect(screen.getByText("0 awaiting review")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("shows the error message with a retry that refetches", async () => {
    apiMock.adminListOrgs.mockRejectedValue(new Error("Backend is down"))
    renderWithQuery(<OrgsPage focusId={null} />)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("Backend is down")
    expect(screen.getByText("No organization selected")).toBeInTheDocument()

    apiMock.adminListOrgs.mockResolvedValue(listPage([]))
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("No organizations")).toBeInTheDocument()
  })

  it("renders rows with key fields, chip counts and auto-selects the first row", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER, PARK]))
    mockOrgDetails(RIVER, PARK)
    renderWithQuery(<OrgsPage focusId={null} />)

    const riverRow = (await screen.findByText("/river-keepers")).closest(".qrow") as HTMLElement
    expect(riverRow).toHaveTextContent("River Keepers")
    expect(riverRow).toHaveTextContent("3 members")
    expect(riverRow).toHaveTextContent("1 event")
    expect(riverRow).toHaveTextContent("Rosa Park")
    expect(riverRow).toHaveTextContent("Verified")

    const parkRow = screen.getByText("/park-friends").closest(".qrow") as HTMLElement
    expect(parkRow).toHaveTextContent("Park Friends")
    expect(parkRow).toHaveTextContent("1 member")
    expect(parkRow).toHaveTextContent("0 events")
    expect(parkRow).toHaveTextContent("Pending review")

    expect(screen.getByText("2 of 5")).toBeInTheDocument()
    expect(screen.getByText("1 awaiting review")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^All\s*5$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Pending review\s*1$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Verified\s*3$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Rejected$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Unverified$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Suspended\s*0$/ })).toBeInTheDocument()

    await detailHeading("River Keepers")
    expect(apiMock.adminGetOrg).toHaveBeenCalledWith({ id: "org-1" })
    expect(screen.getByText("/river-keepers · Nonprofit")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("link", { name: "civfix.org/orgs/river-keepers" })).toHaveAttribute(
      "href",
      "https://civfix.org/orgs/river-keepers",
    )
    expect(screen.getByRole("link", { name: /View public page/ })).toHaveAttribute(
      "href",
      "https://civfix.org/orgs/river-keepers",
    )
    expect(screen.getByText("We clean the river.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Suspend" })).toBeEnabled()
  })

  it("selecting a row loads and shows that organization's detail", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER, PARK]))
    mockOrgDetails(RIVER, PARK)
    renderWithQuery(<OrgsPage focusId={null} />)

    await detailHeading("River Keepers")
    fireEvent.click(screen.getByText("/park-friends"))

    await detailHeading("Park Friends")
    expect(apiMock.adminGetOrg).toHaveBeenCalledWith({ id: "org-2" })
    expect(screen.getAllByText("/park-friends")).toHaveLength(2)
    expect(screen.getByRole("tab", { name: /^Verification/ })).toHaveTextContent("!")
  })

  it("shows the detail error when the selected organization fails to load", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER]))
    apiMock.adminGetOrg.mockRejectedValue(new Error("Detail exploded"))
    renderWithQuery(<OrgsPage focusId={null} />)

    expect(await screen.findByText("Could not load this organization")).toBeInTheDocument()
    expect(screen.getByText("Detail exploded")).toBeInTheDocument()
  })

  it("shows the detail loading state while the selected organization is in flight", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER]))
    apiMock.adminGetOrg.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<OrgsPage focusId={null} />)

    expect(await screen.findByText("Loading organization...")).toBeInTheDocument()
  })

  it("shows the suspended pill and banner for a suspended organization", async () => {
    const suspended = makeOrg({
      suspendedAt: "2026-03-01T10:00:00.000Z",
      suspendedReason: "Broadcast abuse",
    })
    apiMock.adminListOrgs.mockResolvedValue(listPage([suspended]))
    mockOrgDetails(suspended)
    renderWithQuery(<OrgsPage focusId={null} />)

    await detailHeading("River Keepers")
    expect(screen.getAllByText("Suspended").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Broadcast abuse/)).toBeInTheDocument()
    expect(screen.getByText(/Writes under\s+this organization are refused until it is restored\./)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled()
  })
})

describe("OrgsPage paging, filters and search", () => {
  it("Load more fetches the next page with the cursor and appends its rows", async () => {
    apiMock.adminListOrgs.mockImplementation((params: { cursor?: string }) =>
      Promise.resolve(
        params.cursor === "cur-2"
          ? listPage([PARK], { counts: undefined })
          : listPage([RIVER], { nextCursor: "cur-2" }),
      ),
    )
    mockOrgDetails(RIVER, PARK)
    renderWithQuery(<OrgsPage focusId={null} />)

    fireEvent.click(await screen.findByRole("button", { name: "Load more" }))

    expect(await screen.findByText("/park-friends")).toBeInTheDocument()
    expect(apiMock.adminListOrgs).toHaveBeenCalledWith({ cursor: "cur-2" })
    expect(screen.getByText("/river-keepers")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
    expect(screen.getByText("2 of 5")).toBeInTheDocument()
  })

  it("the Pending review chip queries the verification queue and opens on the Verification tab", async () => {
    apiMock.adminListOrgs.mockImplementation((params: { verified?: string }) =>
      Promise.resolve(params.verified === "pending" ? listPage([PARK]) : listPage([RIVER])),
    )
    mockOrgDetails(RIVER, PARK)
    renderWithQuery(<OrgsPage focusId={null} />)

    await detailHeading("River Keepers")
    fireEvent.click(screen.getByRole("button", { name: /^Pending review/ }))

    expect(await screen.findByRole("heading", { level: 3, name: "Verification queue" })).toBeInTheDocument()
    await waitFor(() => expect(apiMock.adminListOrgs).toHaveBeenCalledWith({ verified: "pending" }))
    expect(await screen.findByText("/park-friends")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /^Verification/ })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })

  it("shows the clear-queue empty state on an empty Pending review filter", async () => {
    apiMock.adminListOrgs.mockImplementation((params: { verified?: string }) =>
      Promise.resolve(params.verified === "pending" ? listPage([]) : listPage([RIVER])),
    )
    mockOrgDetails(RIVER)
    renderWithQuery(<OrgsPage focusId={null} />)

    await detailHeading("River Keepers")
    fireEvent.click(screen.getByRole("button", { name: /^Pending review/ }))

    expect(await screen.findByText("Queue is clear")).toBeInTheDocument()
    expect(screen.getByText("No verification application is waiting for a decision.")).toBeInTheDocument()
  })

  it("maps each chip to its list params", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([]))
    renderWithQuery(<OrgsPage focusId={null} />)
    await screen.findByText("No organizations")

    fireEvent.click(screen.getByRole("button", { name: /^Suspended/ }))
    await waitFor(() => expect(apiMock.adminListOrgs).toHaveBeenCalledWith({ suspended: true }))

    fireEvent.click(screen.getByRole("button", { name: /^Rejected/ }))
    await waitFor(() => expect(apiMock.adminListOrgs).toHaveBeenCalledWith({ verified: "rejected" }))

    fireEvent.click(screen.getByRole("button", { name: /^Verified/ }))
    await waitFor(() => expect(apiMock.adminListOrgs).toHaveBeenCalledWith({ verified: "verified" }))
  })

  it("debounces the search box into a trimmed q param", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([]))
    renderWithQuery(<OrgsPage focusId={null} />)
    await screen.findByText("No organizations")

    fireEvent.change(screen.getByPlaceholderText("Search name or slug…"), {
      target: { value: "  river  " },
    })
    expect(apiMock.adminListOrgs).not.toHaveBeenCalledWith({ q: "river" })
    await waitFor(() => expect(apiMock.adminListOrgs).toHaveBeenCalledWith({ q: "river" }))
  })
})

describe("OrgsPage deep links and detail tabs", () => {
  it("a focusId selects that organization instead of the first row", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER, PARK]))
    mockOrgDetails(RIVER, PARK)
    renderWithQuery(<OrgsPage focusId="org-2" />)

    await detailHeading("Park Friends")
    expect(apiMock.adminGetOrg).toHaveBeenCalledWith({ id: "org-2" })
    expect(apiMock.adminGetOrg).not.toHaveBeenCalledWith({ id: "org-1" })
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true")
  })

  it("a focusId outside the first page still loads its detail on its own", async () => {
    const far = makeOrg({ id: "org-far", slug: "far-away", name: "Far Away Club" })
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER], { nextCursor: "cur-2" }))
    mockOrgDetails(RIVER, far)
    renderWithQuery(<OrgsPage focusId="org-far" />)

    await detailHeading("Far Away Club")
    expect(apiMock.adminGetOrg).toHaveBeenCalledWith({ id: "org-far" })
    expect(apiMock.adminGetOrg).not.toHaveBeenCalledWith({ id: "org-1" })
    expect(screen.queryByText("/far-away")).not.toBeInTheDocument()
    expect(screen.getByText("/river-keepers").closest(".qrow")).not.toHaveClass("selected")
  })

  it("an unknown tab in the focusId falls back to the Profile tab", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER]))
    mockOrgDetails(RIVER)
    renderWithQuery(<OrgsPage focusId="org-1/bogus" />)

    await detailHeading("River Keepers")
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true")
  })

  it("id/members opens the Members tab with the roster", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER]))
    mockOrgDetails(RIVER)
    apiMock.adminListOrgMembers.mockResolvedValue({
      items: [
        { user: OWNER, role: "owner", joinedAt: "2026-01-02T10:00:00.000Z" },
        {
          user: { id: "u-2", name: "Sam Lee", handle: "@sam", joined: "2025-02-01" },
          role: "member",
          joinedAt: "2026-01-03T10:00:00.000Z",
        },
      ],
      nextCursor: null,
    } satisfies AdminOrgMemberListResponse)
    renderWithQuery(<OrgsPage focusId="org-1/members" />)

    await detailHeading("River Keepers")
    expect(screen.getByRole("tab", { name: /^Members/ })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByText("Sam Lee")).toBeInTheDocument()
    expect(apiMock.adminListOrgMembers).toHaveBeenCalledWith({ id: "org-1" })
    expect(screen.getByText("Transfer ownership before removing")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Actions for Sam Lee" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Add member/ })).toBeEnabled()
  })

  it("id/members shows the roster error state", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER]))
    mockOrgDetails(RIVER)
    apiMock.adminListOrgMembers.mockRejectedValue(new Error("Roster down"))
    renderWithQuery(<OrgsPage focusId="org-1/members" />)

    expect(await screen.findByText("Could not load members")).toBeInTheDocument()
    expect(screen.getByText("Roster down")).toBeInTheDocument()
  })

  it("id/verification opens the Verification tab with the application and decision actions", async () => {
    const applied = makeOrg({
      id: "org-3",
      slug: "tree-crew",
      name: "Tree Crew",
      verifiedStatus: "pending",
      verifiedKind: null,
      verification: {
        organizationId: "org-3",
        slug: "tree-crew",
        name: "Tree Crew",
        status: "pending",
        kind: "community",
        einLast4: "1234",
        documentMediaIds: [],
        note: "We plant trees on weekends.",
        submittedBy: OWNER,
        submittedAt: "2026-03-01T10:00:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
      },
    })
    apiMock.adminListOrgs.mockResolvedValue(listPage([applied]))
    mockOrgDetails(applied)
    renderWithQuery(<OrgsPage focusId="org-3/verification" />)

    await detailHeading("Tree Crew")
    expect(screen.getByRole("tab", { name: /^Verification/ })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByText("We plant trees on weekends.")).toBeInTheDocument()
    expect(screen.getByText("Community group")).toBeInTheDocument()
    expect(screen.getByText(/1234$/)).toBeInTheDocument()
    expect(screen.getByText("No evidence uploaded")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Verify as nonprofit" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Verify as government" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Verify as community group" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled()
  })

  it("id/verification for an org that never applied says so", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER]))
    mockOrgDetails(RIVER)
    renderWithQuery(<OrgsPage focusId="org-1/verification" />)

    await detailHeading("River Keepers")
    expect(screen.getByText("This organization has never applied for verification.")).toBeInTheDocument()
    expect(screen.getByText(/This application was already decided\./)).toBeInTheDocument()
  })

  it("id/events opens the Events tab on upcoming events and lists them", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER]))
    mockOrgDetails(RIVER)
    apiMock.adminListOrgEvents.mockResolvedValue({
      items: [
        {
          id: "ev-1",
          status: "upcoming",
          eventKind: "cleanup",
          flagged: false,
          title: "Riverbank sweep",
          place: "Echo Park",
          attendees: 4,
          capacity: 20,
          bags: 0,
          organizer: OWNER,
          date: { rel: "in 2 days", abs: "Oct 1" },
          coords: [34.07, -118.26],
        },
      ],
      nextCursor: null,
    } satisfies AdminOrgEventListResponse)
    renderWithQuery(<OrgsPage focusId="org-1/events" />)

    await detailHeading("River Keepers")
    expect(screen.getByRole("tab", { name: /^Events/ })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByText("Riverbank sweep")).toBeInTheDocument()
    expect(apiMock.adminListOrgEvents).toHaveBeenCalledWith({ id: "org-1", when: "upcoming" })
    expect(screen.getByText("4/20 attending")).toBeInTheDocument()
    expect(screen.getByText("1 hosted in total")).toBeInTheDocument()
  })

  it("id/events shows the empty upcoming state and switches the when filter", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER]))
    mockOrgDetails(RIVER)
    apiMock.adminListOrgEvents.mockResolvedValue({ items: [], nextCursor: null })
    renderWithQuery(<OrgsPage focusId="org-1/events" />)

    expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Past" }))
    expect(await screen.findByText("No events here")).toBeInTheDocument()
    expect(apiMock.adminListOrgEvents).toHaveBeenCalledWith({ id: "org-1", when: "past" })
  })

  it("clicking a tab switches the detail body", async () => {
    apiMock.adminListOrgs.mockResolvedValue(listPage([RIVER]))
    mockOrgDetails(RIVER)
    apiMock.adminListOrgMembers.mockResolvedValue({ items: [], nextCursor: null })
    renderWithQuery(<OrgsPage focusId={null} />)

    await detailHeading("River Keepers")
    fireEvent.click(screen.getByRole("tab", { name: /^Members/ }))

    expect(await screen.findByText("No members")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /^Members/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "false")
  })
})
