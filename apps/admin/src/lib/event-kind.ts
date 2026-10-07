import { Icons, type IconComponent } from "@/components/icons"
import { EVENT_KIND_LABELS, type EventKind } from "@civfix/shared"

// The one source of an event kind's label, icon and pin for the events list, event detail and live
// map, so they never disagree.

const EVENT_KIND_VIEW: Record<EventKind, { icon: IconComponent; label: string }> = {
  cleanup: { icon: Icons.Calendar, label: EVENT_KIND_LABELS.cleanup },
  other_volunteer: { icon: Icons.Users, label: EVENT_KIND_LABELS.other_volunteer },
}

// An unknown kind from a newer server falls back to Cleanup rather than rendering blank.
export function eventKindLabel(kind: EventKind): string {
  return EVENT_KIND_LABELS[kind] ?? EVENT_KIND_LABELS.cleanup
}

export function eventKindView(kind: EventKind): { icon: IconComponent; label: string } {
  return EVENT_KIND_VIEW[kind] ?? EVENT_KIND_VIEW.cleanup
}

export const EVENT_KIND_PIN_KIND: Record<EventKind, "event" | "event-volunteer"> = {
  cleanup: "event",
  other_volunteer: "event-volunteer",
}
