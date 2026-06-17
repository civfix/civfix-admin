import { Icons, type IconComponent } from "@/components/icons"
import { EVENT_KIND_LABELS, type EventKind } from "@civfix/shared"

/**
 * Canonical event-kind -> display reconciliation for the admin (mirrors the lib/report-status.ts
 * bucketing style). An event is either a Cleanup or an Other Volunteer event; this is the SINGLE source
 * the events list, the event detail, and the live map all read from for the kind label / icon / pin
 * treatment, so they never disagree. The labels themselves are the contract's EVENT_KIND_LABELS — we add
 * the admin-side visual treatment (icon + map pin fill) on top.
 *
 * Cleanup keeps the existing gold "calendar" treatment; Other Volunteer gets a distinct hands/heart glyph
 * + a moss tint so the two are distinguishable at a glance on the map and in the queue.
 */

/** Pill / row treatment per event kind: leading icon + label (label is the contract's EVENT_KIND_LABELS). */
export const EVENT_KIND_VIEW: Record<EventKind, { icon: IconComponent; label: string }> = {
  cleanup: { icon: Icons.Calendar, label: EVENT_KIND_LABELS.cleanup },
  other_volunteer: { icon: Icons.Users, label: EVENT_KIND_LABELS.other_volunteer },
}

/** The display label for an event kind (falls back to Cleanup for any unknown/new kind). */
export function eventKindLabel(kind: EventKind): string {
  return EVENT_KIND_LABELS[kind] ?? EVENT_KIND_LABELS.cleanup
}

/** The icon + label treatment for an event kind (falls back to the Cleanup treatment). */
export function eventKindView(kind: EventKind): { icon: IconComponent; label: string } {
  return EVENT_KIND_VIEW[kind] ?? EVENT_KIND_VIEW.cleanup
}

/**
 * The leaflet-map pin descriptor for an event kind. The map keys its fill/glyph off a `kind` string
 * ("event" historically); these two new kinds let the live map / minimap diverge cleanup vs other.
 * Kept here (not in leaflet-map.tsx) so the kind->pin mapping lives beside the kind->label mapping.
 */
export const EVENT_KIND_PIN_KIND: Record<EventKind, "event" | "event-volunteer"> = {
  cleanup: "event",
  other_volunteer: "event-volunteer",
}
