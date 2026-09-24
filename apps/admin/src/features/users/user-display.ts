import { USER_STATUS_LABELS, type UserStatus } from "@civfix/shared"

import type { useNav } from "@/store/ui-store"

export type NavFn = ReturnType<typeof useNav>

interface StatusView {
  cls: string
  label: string
}

const STATUS_VIEW: Record<UserStatus, StatusView> = {
  active: { cls: "status-ok", label: USER_STATUS_LABELS.active },
  suspended: { cls: "status-flag", label: USER_STATUS_LABELS.suspended },
  review: { cls: "status-progress", label: USER_STATUS_LABELS.review },
  banned: { cls: "status-flag", label: USER_STATUS_LABELS.banned },
}

// The client passes a status newer than this build through unvalidated; show it raw rather than crash.
export function userStatusView(status: UserStatus): StatusView {
  return STATUS_VIEW[status] ?? { cls: "priority-low", label: status }
}

// The API sends a lone dash for a profile field the user never filled in.
const API_MISSING_FIELD = "-"

export function isMissing(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim()
  return trimmed === "" || trimmed === API_MISSING_FIELD
}
