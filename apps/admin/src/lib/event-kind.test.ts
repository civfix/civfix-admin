import { EVENT_KIND_LABELS, type EventKind } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { Icons } from "@/components/icons"

import { EVENT_KIND_PIN_KIND, eventKindLabel, eventKindView } from "./event-kind"

describe("event kind presentation", () => {
  it.each([
    ["cleanup", Icons.Calendar],
    ["other_volunteer", Icons.Users],
  ] as const)("gives %s its own label and icon", (kind, icon) => {
    expect(eventKindView(kind)).toEqual({ icon, label: EVENT_KIND_LABELS[kind] })
    expect(eventKindLabel(kind)).toBe(EVENT_KIND_LABELS[kind])
  })

  it("shows a kind this build does not know as a cleanup", () => {
    const unknown = "tree_planting" as EventKind
    expect(eventKindView(unknown)).toEqual(eventKindView("cleanup"))
    expect(eventKindLabel(unknown)).toBe(EVENT_KIND_LABELS.cleanup)
  })

  it("maps each kind to its map pin", () => {
    expect(EVENT_KIND_PIN_KIND).toEqual({ cleanup: "event", other_volunteer: "event-volunteer" })
  })
})
