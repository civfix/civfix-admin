"use client"

import type { ModerationItemDTO } from "@civfix/shared"

import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { initials } from "@/lib/display"
import { useNav } from "@/store/ui-store"

type ModerationUser = ModerationItemDTO["user"]

const CONTEXT_AVATAR_BACKGROUND = "linear-gradient(135deg, var(--sky), var(--moss))"

function UserContextHead({ user }: { user: ModerationUser }) {
  return (
    <div className="user-head">
      <span className="user-av" style={{ background: CONTEXT_AVATAR_BACKGROUND }}>
        {initials(user.name)}
      </span>
      <div>
        <div className="user-name">{user.name}</div>
        <div className="user-handle mono">{user.handle}</div>
      </div>
    </div>
  )
}

function UserContextLink({ user }: { user: ModerationUser }) {
  const nav = useNav()
  const userId = user.id
  if (!userId) return <UserContextHead user={user} />
  return (
    <div
      className="row-link"
      role="button"
      tabIndex={0}
      title={`Open ${user.name}'s profile`}
      onClick={() => nav("users", userId)}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        nav("users", userId)
      }}
    >
      <UserContextHead user={user} />
    </div>
  )
}

export function UserContextCard({ user }: { user: ModerationUser }) {
  return (
    <div className="sub">
      <div className="sub-head">User context</div>
      <div className="sub-body">
        <UserContextLink user={user} />
        <div className="user-meta-rows">
          <div className="umr">
            <span>Joined</span>
            <span className="mono">{user.joined}</span>
          </div>
          <div className="umr">
            <span>Prior reports</span>
            <span>{user.priorReports}</span>
          </div>
          <div className="umr">
            <span>Prior removals</span>
            <span>{user.priorRemovals}</span>
          </div>
          <div className="umr">
            <span>Strikes</span>
            <span>{user.strikes}</span>
          </div>
          <div className="umr">
            <span>Device</span>
            <span className="mono">{user.device}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
