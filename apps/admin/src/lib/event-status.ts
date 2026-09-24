import { EVENT_STATUS_LABELS, type EventStatus } from "@civfix/shared"

/** Pill treatment per event lifecycle status, shared by the Events section and the org events tab. */
export const EVENT_STATUS_VIEW: Record<EventStatus, { cls: string; label: string }> = {
  upcoming: { cls: "status-new", label: EVENT_STATUS_LABELS.upcoming },
  in_progress: { cls: "status-progress", label: EVENT_STATUS_LABELS.in_progress },
  completed: { cls: "status-ok", label: EVENT_STATUS_LABELS.completed },
  cancelled: { cls: "status-flag", label: EVENT_STATUS_LABELS.cancelled },
}

// The client passes a status newer than this build through unvalidated; show it raw in a neutral pill
// rather than crash or pass it off as a known state.
export function eventStatusView(status: EventStatus): { cls: string; label: string } {
  return Object.hasOwn(EVENT_STATUS_VIEW, status)
    ? EVENT_STATUS_VIEW[status]
    : { cls: "priority-low", label: status }
}

export function cancelBlockedFor(status: EventStatus): string | null {
  if (status === "completed") return "This event has already ended and can't be cancelled."
  if (status === "cancelled") return "This event is already cancelled."
  return null
}
