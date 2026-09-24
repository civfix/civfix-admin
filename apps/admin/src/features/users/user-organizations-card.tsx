"use client"

import { monogram, type AdminUserDTO } from "@civfix/shared"

import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { ORG_ROLE_LABEL, ORG_ROLE_PILL } from "@/features/orgs/org-members"
import type { NavFn } from "@/features/users/user-display"
import {
  userOrganizationFocus,
  userOrganizationsView,
  type UserOrganization,
} from "@/features/users/user-organizations"

function UserOrganizationRow({ org, nav }: { org: UserOrganization; nav: NavFn }) {
  const open = () => nav("orgs", userOrganizationFocus(org))
  return (
    <div className="qrow static user-org-row">
      <span className="org-logo hue-sky">{monogram(org.name)}</span>
      <div className="body">
        <div className="top">
          <span
            className="title lnk-inline"
            role="button"
            tabIndex={0}
            title="Open organization"
            onClick={open}
            onKeyDown={(e) => {
              if (!isKeyboardActivationKey(e.key)) return
              e.preventDefault()
              open()
            }}
          >
            {org.name}
          </span>
          <span className="ident mono">/{org.slug}</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${ORG_ROLE_PILL[org.role] ?? "priority-low"} tight`}>
          {ORG_ROLE_LABEL[org.role] ?? org.role}
        </span>
      </div>
    </div>
  )
}

export function UserOrganizations({ user, nav }: { user: AdminUserDTO; nav: NavFn }) {
  const { reported, items } = userOrganizationsView(user.organizations)
  if (!reported) return null
  return (
    <div className="sub user-orgs">
      <div className="sub-head">Organizations</div>
      <div className="sub-body">
        {items.length === 0 ? (
          <span className="muted">No organizations</span>
        ) : (
          items.map((org) => <UserOrganizationRow key={org.id} org={org} nav={nav} />)
        )}
      </div>
    </div>
  )
}
