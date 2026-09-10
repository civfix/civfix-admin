import type { AdminUserDTO, OrganizationMemberRole } from "@civfix/shared"

import { orgFocus } from "@/features/orgs/org-focus"

export type UserOrganization = NonNullable<AdminUserDTO["organizations"]>[number]

const ROLE_RANK: Record<OrganizationMemberRole, number> = { owner: 0, admin: 1, member: 2 }

export function sortUserOrganizations(
  organizations: AdminUserDTO["organizations"],
): UserOrganization[] {
  return [...(organizations ?? [])].sort(
    (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.name.localeCompare(b.name),
  )
}

export function userOrganizationFocus(org: Pick<UserOrganization, "id">): string {
  return orgFocus(org.id)
}
