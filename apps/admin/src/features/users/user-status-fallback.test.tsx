import { screen, within } from "@testing-library/react"
import type {
  AdminUserDTO,
  AdminUserListItemDTO,
  AdminUserListResponse,
  OrganizationMemberRole,
  UserReportsResponse,
  UserStatus,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { UsersPage } from "@/features/users/users-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

// The shared client hands back a body that fails its schema as-is, so a status or role added on the
// server after this build reaches the page untyped.
const FUTURE_STATUS = "probation" as UserStatus
const FUTURE_ROLE = "steward" as OrganizationMemberRole

const PAT = {
  id: "u-pat",
  name: "Pat Lee",
  handle: "@patlee",
  city: "Oakland",
  joined: "2026-01-05T00:00:00.000Z",
  avatar: ["#111111", "#222222"],
  avatarUrl: null,
  status: FUTURE_STATUS,
  reports: 0,
  cleanups: 0,
  removals: 0,
  strikes: 0,
  risk: "low",
  lastActive: "2h ago",
  flagged: false,
  flagReason: null,
  deletedAt: null,
} satisfies AdminUserListItemDTO

function detail(
  item: AdminUserListItemDTO,
  organizations: AdminUserDTO["organizations"] = [],
): AdminUserDTO {
  return {
    ...item,
    role: "citizen",
    messages: 0,
    reportVerified: false,
    organizations,
  } satisfies AdminUserDTO
}

function mockUser(user: AdminUserDTO) {
  apiMock.listAdminUsers.mockResolvedValue({
    items: [user],
    nextCursor: null,
    counts: {
      all: 1,
      active: 0,
      suspended: 0,
      flagged: 0,
      deleted: 0,
      banned: 0,
    },
  } satisfies AdminUserListResponse)
  apiMock.getAdminUser.mockResolvedValue(user)
  apiMock.getUserReports.mockResolvedValue({
    items: [],
    nextCursor: null,
  } satisfies UserReportsResponse)
}

function accountsList() {
  return screen.getByRole("heading", { name: "Accounts" }).closest("section") as HTMLElement
}

describe("UsersPage with a status this build does not know", () => {
  it("shows the raw status in the list row and the detail pane instead of blanking the page", async () => {
    mockUser(detail(PAT))
    renderWithQuery(<UsersPage focusId={null} />)

    await screen.findByText("@patlee")
    expect(within(accountsList()).getByText("probation")).toBeInTheDocument()
    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "Pat Lee" })).toBeInTheDocument()
    expect(within(card).getByText("probation")).toBeInTheDocument()
    expect(within(card).queryByRole("button", { name: /Suspend/ })).not.toBeInTheDocument()
    expect(
      within(card).queryByRole("button", { name: /Reactivate|Un-ban/ }),
    ).not.toBeInTheDocument()
  })

  it("shows an organization role this build does not know as its raw value", async () => {
    mockUser(
      detail({ ...PAT, status: "active" }, [
        {
          id: "org-1",
          slug: "river-keepers",
          name: "River Keepers",
          role: FUTURE_ROLE,
        },
      ]),
    )
    renderWithQuery(<UsersPage focusId={null} />)

    const card = detailCard()
    expect(await within(card).findByText("River Keepers")).toBeInTheDocument()
    const pill = within(card).getByText("steward")
    expect(pill).not.toHaveClass("undefined")
  })
})
