"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { HomeMapPin } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { useHomeMap } from "@/hooks/use-admin-home"
import { useNav } from "@/store/ui-store"
import { EVENT_KIND_PIN_KIND } from "@/lib/event-kind"
import type { MapPin, MapTint } from "@/components/map/leaflet-map"


const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

const WAITING_REPORT_STATUSES = new Set(["submitted", "held", "published"])

function toMapPin(p: HomeMapPin): MapPin & {
  refType: HomeMapPin["refType"]
  refId: string
  status: HomeMapPin["status"]
  flagged: boolean
  title: string
} {
  const isEvent = p.refType === "event"
  const needs = !isEvent && (p.flagged || WAITING_REPORT_STATUSES.has(p.status))
  return {
    id: `${p.refType}-${p.id}`,
    refType: p.refType,
    refId: p.id,
    lat: p.lat,
    lng: p.lng,
    category: isEvent ? "event" : p.category,
    draft: needs,
    kind: isEvent ? EVENT_KIND_PIN_KIND[p.eventKind ?? "cleanup"] : null,
    tip: p.title,
    place: p.place,
    status: p.status,
    flagged: p.flagged,
    title: p.title,
  }
}

type ActivePin = ReturnType<typeof toMapPin>

function statusTone(m: ActivePin): { color: string; label: string } {
  if (m.refType === "event") return { color: "var(--sun-700)", label: "Cleanup event" }
  if (m.flagged) return { color: "var(--bloom-700)", label: "Flagged" }
  if (WAITING_REPORT_STATUSES.has(m.status)) return { color: "var(--ink-2)", label: "Submitted" }
  if (m.status === "in_progress" || m.status === "acknowledged")
    return { color: "var(--lilac-600)", label: "In progress" }
  return { color: "var(--moss-700)", label: "Completed" }
}

export function LiveMap({ tint = "voyager" }: { tint?: MapTint }) {
  const nav = useNav()
  const q = useHomeMap()
  const [active, setActive] = React.useState<ActivePin | null>(null)

  const pins = React.useMemo(() => q.data?.pins ?? [], [q.data])
  const markers = React.useMemo(() => pins.map(toMapPin), [pins])
  const reportCount = pins.filter((p) => p.refType === "report").length
  const eventCount = pins.filter((p) => p.refType === "event").length
  const needsAttention = pins.filter(
    (p) => p.refType === "report" && (p.flagged || WAITING_REPORT_STATUSES.has(p.status)),
  ).length

  const openActive = () => {
    if (!active) return
    nav(active.refType === "event" ? "events" : "reports", active.refId)
  }

  return (
    <section className="card live-map-card">
      <div className="card-head">
        <h3>Live map</h3>
        <span className="meta">
          {reportCount} reports · {eventCount} events (recent)
        </span>
        <div className="spacer" />
        <button className="head-action" onClick={() => nav("reports")}>
          <span className="ha-dot" style={{ background: "var(--bloom)" }} />
          {needsAttention} need attention
        </button>
      </div>
      <div className="live-map">
        <LeafletMap
          pins={markers}
          tint={tint}
          activeId={active ? active.id : null}
          onPinTap={(p) => setActive(p as ActivePin)}
        />
        <div className="map-legend">
          <span className="swatch">
            <span className="dot pin-needs" />
            Needs attention
          </span>
          <span className="swatch">
            <span className="dot pin-routed" />
            Handled
          </span>
          <span className="swatch">
            <span className="dot pin-events" />
            Events
          </span>
        </div>

        {q.isError && !pins.length && (
          <div className="map-active-card" role="alert">
            <div className="mac-pin is-needs">
              <Icons.AlertTriangle size={15} />
            </div>
            <div className="mac-body">
              <div className="mac-title">Map unavailable</div>
              <div className="mac-sub">
                <span>Could not load the live feed.</span>
              </div>
            </div>
            <button className="btn sm" onClick={() => q.refetch()}>
              Retry
            </button>
          </div>
        )}

        {active &&
          (() => {
            const tone = statusTone(active)
            return (
              <div className="map-active-card">
                <div
                  className={`mac-pin ${
                    active.refType === "event" ? "is-event" : active.draft ? "is-needs" : "is-routed"
                  }`}
                >
                  <Icons.Pin size={15} />
                </div>
                <div className="mac-body">
                  <div className="mac-title">{active.title}</div>
                  <div className="mac-sub">
                    <span>{active.place}</span>
                    <span className="sep">·</span>
                    <span style={{ color: tone.color, fontWeight: 700 }}>{tone.label}</span>
                  </div>
                </div>
                <button className="btn sm primary" onClick={openActive}>
                  Open {active.refType === "event" ? "event" : "report"} →
                </button>
              </div>
            )
          })()}
      </div>
    </section>
  )
}
