"use client"

import type { AdminUserDTO, SetUserStatusRequest } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { confirmDialog } from "@/components/shared/dialog"
import { useFlagUser, useSetUserReportVerified, useSetUserStatus } from "@/features/users/use-users"
import { userStatusActions } from "@/features/users/user-status-actions"

type ConfirmOptions = Parameters<typeof confirmDialog>[0]

// Called by the detail pane rather than the bar, so a pending mutation keeps its busy state while the
// account itself refetches or briefly fails to load.
export function useUserAccountMutations() {
  return {
    flag: useFlagUser(),
    setStatus: useSetUserStatus(),
    setReportVerified: useSetUserReportVerified(),
  }
}

type UserAccountMutations = ReturnType<typeof useUserAccountMutations>

export function UserActionsBar({
  user,
  mutations,
}: {
  user: AdminUserDTO
  mutations: UserAccountMutations
}) {
  const { flag, setStatus, setReportVerified } = mutations
  const allowed = userStatusActions(user)
  const deleted = !!user.deletedAt
  const isReportVerified = !!user.reportVerified
  const reactivateVerb = user.status === "banned" ? "Un-ban" : "Reactivate"

  const onFlag = () => {
    flag.mutate({ request: { id: user.id }, name: user.name, wasFlagged: user.flagged })
  }

  const onToggleReportVerified = () => {
    setReportVerified.mutate({ request: { id: user.id, value: !isReportVerified }, name: user.name })
  }

  const confirmThenSetStatus = async (status: SetUserStatusRequest["status"], dialog: ConfirmOptions) => {
    const ok = await confirmDialog(dialog)
    if (!ok) return
    setStatus.mutate({ request: { id: user.id, status }, name: user.name })
  }

  const onBan = () =>
    confirmThenSetStatus("banned", {
      title: "Ban user",
      body: `Ban ${user.name}? This revokes all of their sessions.`,
      danger: true,
      confirmLabel: "Ban",
    })

  const onSuspend = () =>
    confirmThenSetStatus("suspended", {
      title: "Suspend user",
      body: `Suspend ${user.name}? They keep their account but can't post.`,
      danger: true,
      confirmLabel: "Suspend",
    })

  const onReactivate = () =>
    confirmThenSetStatus("active", {
      title: `${reactivateVerb} user`,
      body: `${reactivateVerb} ${user.name}? This restores their access.`,
      confirmLabel: reactivateVerb,
    })

  return (
    <div className="user-actions">
      {deleted && (
        <span className="rep-actions-label">
          Account self-deleted, so status actions are disabled. Per-content removal stays available.
        </span>
      )}
      <div className="spacer" />
      <button
        className={`btn ${user.flagged ? "flag-on" : ""}`}
        disabled={flag.isPending || !allowed.flag}
        onClick={onFlag}
      >
        <Icons.Flag size={13} /> {user.flagged ? "Flagged" : "Flag account"}
      </button>
      <button
        className="btn"
        disabled={setReportVerified.isPending || !allowed.verifyReports}
        onClick={onToggleReportVerified}
        title={
          isReportVerified
            ? "Remove the report-verified mark (their reports stop auto-forwarding)"
            : "Mark report-verified (their reports auto-forward to their jurisdiction)"
        }
      >
        <Icons.Check size={13} /> {isReportVerified ? "Unverify report" : "Verify report"}
      </button>
      {allowed.reactivate && (
        <button className="btn" disabled={setStatus.isPending} onClick={onReactivate}>
          <Icons.Check size={13} /> {reactivateVerb}
        </button>
      )}
      {allowed.suspend && (
        <button className="btn" disabled={setStatus.isPending} onClick={onSuspend}>
          <Icons.Lock size={13} /> Suspend
        </button>
      )}
      <button
        className="btn danger"
        disabled={setStatus.isPending || !allowed.ban}
        onClick={onBan}
      >
        <Icons.Trash size={13} /> {user.status === "banned" ? "Banned" : "Ban account"}
      </button>
    </div>
  )
}
