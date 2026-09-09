import type { EventStatus } from "@civfix/shared"

/** Pill treatment per event lifecycle status, shared by the Events section and the org events tab. */
export const EVENT_STATUS_VIEW: Record<EventStatus, { cls: string; label: string }> = {
  upcoming: { cls: "status-new", label: "Upcoming" },
  in_progress: { cls: "status-progress", label: "In progress" },
  completed: { cls: "status-ok", label: "Completed" },
  cancelled: { cls: "status-flag", label: "Cancelled" },
}

export function eventStatusView(status: EventStatus): { cls: string; label: string } {
  return EVENT_STATUS_VIEW[status] ?? EVENT_STATUS_VIEW.upcoming
}
