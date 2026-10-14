import { screen } from "@testing-library/react"
import type { AdminOrgDTO, AdminOrgListResponse, GetAdminOrgResponse } from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { queueRowOf } from "@/test/panes"
import { OrgsPage } from "@/features/orgs/orgs-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const UNKNOWN_STATUS = "under_appeal" as AdminOrgDTO["verifiedStatus"]

const ORG = {
  id: "org-1",
  slug: "river-keepers",
  name: "River Keepers",
  description: "We clean the river.",
  websiteUrl: null,
  logoUrl: null,
  verifiedStatus: UNKNOWN_STATUS,
  verifiedKind: null,
  verifiedAt: null,
  createdAt: "2026-01-01T10:00:00.000Z",
  deletedAt: null,
  memberCount: 1,
  eventCount: 0,
  owner: null,
  verification: null,
  donationUrl: null,
  suspendedAt: null,
  suspendedReason: null,
  updatedAt: null,
  socialLinks: null,
  logoMediaId: null,
} satisfies AdminOrgDTO

describe("org verification status the build does not know", () => {
  it("renders the raw status in the list row and the detail pane", async () => {
    apiMock.adminListOrgs.mockResolvedValue({
      items: [ORG],
      nextCursor: null,
      counts: { all: 1, verified: 0, pending: 0, suspended: 0 },
    } satisfies AdminOrgListResponse)
    apiMock.adminGetOrg.mockResolvedValue(ORG satisfies GetAdminOrgResponse)
    renderWithQuery(<OrgsPage focusId={null} />)

    const row = queueRowOf(await screen.findByText("/river-keepers"))
    expect(row).toHaveTextContent("under_appeal")
    expect(await screen.findByRole("heading", { level: 2, name: "River Keepers" })).toBeInTheDocument()
    expect(screen.getAllByText("under_appeal").length).toBeGreaterThan(1)
  })
})
