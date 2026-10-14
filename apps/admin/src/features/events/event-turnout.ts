import type { AdminEventDTO } from "@civfix/shared"

const FULL_PERCENT = 100

export function turnoutPercent(attendees: number, capacity: number | null | undefined): number {
  if (!capacity) return 0
  return Math.min(FULL_PERCENT, Math.round((attendees / capacity) * FULL_PERCENT))
}

export function turnoutLabel(status: AdminEventDTO["status"]): string {
  if (status === "cancelled") return "had RSVP’d"
  if (status === "completed") return "attended"
  return "RSVP’d"
}
