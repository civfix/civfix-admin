import type {
  AdminOrgDTO,
  AdminOrgMemberDTO,
  AdminUserListItemDTO,
  GetAdminOrgResponse,
} from "@civfix/shared"

import { apiMock } from "@/test/api-mock"

export const OWNER = { id: "u-owner", name: "Rosa Park", handle: "@rosa", joined: "2025-01-01" }
export const SAM = { id: "u-sam", name: "Sam Lee", handle: "@sam", joined: "2025-02-01" }

export function makeOrg(overrides: Partial<AdminOrgDTO> = {}): AdminOrgDTO {
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

export function pendingApplication(org: Pick<AdminOrgDTO, "id" | "slug" | "name">) {
  return {
    organizationId: org.id,
    slug: org.slug,
    name: org.name,
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
  } satisfies NonNullable<AdminOrgDTO["verification"]>
}

export function member(
  user: AdminOrgMemberDTO["user"],
  role: AdminOrgMemberDTO["role"],
): AdminOrgMemberDTO {
  return { user, role, joinedAt: "2026-01-02T10:00:00.000Z" }
}

export function mockOrgDetails(...orgs: AdminOrgDTO[]) {
  apiMock.adminGetOrg.mockImplementation(({ id }: { id: string }) => {
    const org = orgs.find((o) => o.id === id)
    return org
      ? Promise.resolve(org satisfies GetAdminOrgResponse)
      : Promise.reject(new Error(`no org ${id}`))
  })
}

export function userListItem(
  over: Partial<AdminUserListItemDTO> & { id: string; name: string },
): AdminUserListItemDTO {
  return {
    handle: "@handle",
    city: "Oakland",
    joined: "2026-01-05T00:00:00.000Z",
    avatar: ["#111111", "#222222"],
    avatarUrl: null,
    status: "active",
    reports: 0,
    cleanups: 0,
    removals: 0,
    strikes: 0,
    risk: "low",
    lastActive: "2h ago",
    flagged: false,
    flagReason: null,
    deletedAt: null,
    ...over,
  }
}
