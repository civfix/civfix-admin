import type { OrganizationMemberRole } from "@civfix/shared"

export const ORG_ROLES: readonly OrganizationMemberRole[] = ["owner", "admin", "member"] as const

export const ORG_ROLE_LABEL: Record<OrganizationMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
}

export const ORG_ROLE_PILL: Record<OrganizationMemberRole, string> = {
  owner: "status-new",
  admin: "status-progress",
  member: "priority-low",
}

/**
 * The roles a member can be moved to from their current one. Every role but the current one is a
 * legal target — including `owner`, which is an ownership transfer (DECISIONS §32) — so the menu
 * offers all the others.
 */
export function roleTargets(current: OrganizationMemberRole): OrganizationMemberRole[] {
  return ORG_ROLES.filter((r) => r !== current)
}

/**
 * An org always has exactly one owner, so the owner row cannot be removed: the operator transfers
 * ownership first, which demotes this member to admin, and then removes them.
 */
export function canRemoveMember(role: OrganizationMemberRole): boolean {
  return role !== "owner"
}

export interface RoleChangeCopy {
  title: string
  body: string
  confirmLabel: string
  /** True when the change is an ownership transfer (rendered with the stronger, danger styling). */
  transfer: boolean
}

/**
 * The confirmation copy for a role change. Choosing `owner` is spelled out as a transfer that demotes
 * the current owner to admin, because that side effect is easy to miss and impossible to undo without
 * a second transfer.
 */
export function roleChangeCopy(opts: {
  memberName: string
  from: OrganizationMemberRole
  to: OrganizationMemberRole
  orgName: string
  currentOwnerName?: string | null
}): RoleChangeCopy {
  const { memberName, from, to, orgName, currentOwnerName } = opts
  if (to === "owner") {
    const previous = currentOwnerName ? `${currentOwnerName} becomes an admin` : "the current owner becomes an admin"
    return {
      title: `Transfer ownership of ${orgName} to ${memberName}?`,
      body: `An organization has exactly one owner. ${memberName} becomes the owner and ${previous} in the same change. The reason is written to the audit log.`,
      confirmLabel: "Transfer ownership",
      transfer: true,
    }
  }
  if (from === "owner") {
    return {
      title: `Demote ${memberName} to ${ORG_ROLE_LABEL[to].toLowerCase()}?`,
      body: `${memberName} is the owner of ${orgName}. An organization must keep an owner, so transfer ownership to another member first, then change this role.`,
      confirmLabel: `Make ${ORG_ROLE_LABEL[to].toLowerCase()}`,
      transfer: false,
    }
  }
  return {
    title: `Make ${memberName} ${to === "admin" ? "an admin" : "a member"} of ${orgName}?`,
    body:
      to === "admin"
        ? `${memberName} can edit the organization, manage members and host events under its name. The reason is written to the audit log.`
        : `${memberName} keeps membership but loses admin rights over the organization. The reason is written to the audit log.`,
    confirmLabel: `Make ${ORG_ROLE_LABEL[to].toLowerCase()}`,
    transfer: false,
  }
}
