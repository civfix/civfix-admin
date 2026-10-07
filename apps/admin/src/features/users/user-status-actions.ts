import type { AdminUserDTO } from "@civfix/shared"

export interface UserStatusActions {
  flag: boolean
  verifyReports: boolean
  reactivate: boolean
  suspend: boolean
  ban: boolean
}

/**
 * Which account actions the operator may take. A self-deleted account is a tombstone, so every account
 * action is off for it; per-content removal stays available elsewhere.
 */
export function userStatusActions(user: Pick<AdminUserDTO, "status" | "deletedAt">): UserStatusActions {
  const live = !user.deletedAt
  return {
    flag: live,
    verifyReports: live,
    reactivate: live && (user.status === "banned" || user.status === "suspended"),
    suspend: live && user.status === "active",
    ban: live && user.status !== "banned",
  }
}
