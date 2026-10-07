"use client"

import * as React from "react"
import type { AdminUserListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { UserAvatar } from "@/features/users/user-avatar"
import { isMissing, userStatusView } from "@/features/users/user-display"

export const UserRow = React.memo(function UserRow({
  user,
  selected,
  onSelect,
}: {
  user: AdminUserListItemDTO
  selected: boolean
  onSelect: (id: string) => void
}) {
  const statusView = userStatusView(user.status)
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(user.id)}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onSelect(user.id)
      }}
    >
      <UserAvatar user={user} />
      <div className="body">
        <div className="top">
          <span className="title">{user.name}</span>
          {user.flagged && (
            <span className="rep-flag-dot" role="img" aria-label="Flagged" title="Flagged">
              <Icons.Flag size={10} />
            </span>
          )}
          <span className="ident">{isMissing(user.handle) ? EMPTY_VALUE : user.handle}</span>
        </div>
        <div className="sub">
          {!isMissing(user.city) && (
            <>
              <span>{user.city}</span>
              <span className="sep">·</span>
            </>
          )}
          <span className="strong">
            {user.reports} {user.reports === 1 ? "report" : "reports"}
          </span>
          <span className="sep">·</span>
          <span>
            {user.cleanups} {user.cleanups === 1 ? "cleanup" : "cleanups"}
          </span>
        </div>
      </div>
      <div className="trailing">
        {user.deletedAt && (
          <span className="pill status-flag tight" title="Self-deleted (tombstoned) account">
            Deleted
          </span>
        )}
        <span className={`pill ${statusView.cls} tight`}>{statusView.label}</span>
      </div>
    </div>
  )
})
