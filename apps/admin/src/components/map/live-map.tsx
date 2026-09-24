"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { HomeMapPin } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { useHomeMap } from "@/hooks/use-admin-home"
import { useNav } from "@/store/ui-store"
import { categoryLabel } from "@/lib/category"
import { EVENT_KIND_PIN_KIND, eventKindLabel } from "@/lib/event-kind"
import {
  BUCKET_VIEW,
  reportBucketOf,
  reportNeedsAttention,
  type ReportBucket,
} from "@/lib/report-status"
import type { MapPin, MapTint } from "@/components/map/leaflet-map"

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

// The feed sends an empty title for an untitled report.
function pinTitle(p: HomeMapPin): string {
  if (p.title) return p.title
  return p.category ? `${categoryLabel(p.category)} report` : "Report"
}

export function toMapPin(p: HomeMapPin): MapPin & {
  refType: HomeMapPin["refType"]
  refId: string
  eventKind: NonNullable<HomeMapPin["eventKind"]> | null
  status: HomeMapPin["status"]
  flagged: boolean
  title: string
} {
  const isEvent = p.refType === "event"
  const needs = !isEvent && reportNeedsAttention(p.status, p.flagged)
  const eventKind = isEvent ? (p.eventKind ?? "cleanup") : null
  const title = pinTitle(p)
  return {
    id: `${p.refType}-${p.id}`,
    refType: p.refType,
    refId: p.id,
    eventKind,
    lat: p.lat,
    lng: p.lng,
    category: isEvent ? "event" : p.category,
    draft: needs,
    kind: eventKind ? EVENT_KIND_PIN_KIND[eventKind] : null,
    tip: title,
    place: p.place,
    status: p.status,
    flagged: p.flagged,
    title,
  }
}

type ActivePin = ReturnType<typeof toMapPin>

const BUCKET_TONE: Record<ReportBucket, string> = {
  submitted: "var(--ink-2)",
  in_progress: "var(--lilac-600)",
  completed: "var(--moss-700)",
  removed: "var(--bloom-700)",
}

export function statusTone(m: ActivePin): { color: string; label: string } {
  if (m.eventKind === "other_volunteer") {
    return { color: "var(--moss-700)", label: `${eventKindLabel(m.eventKind)} event` }
  }
  if (m.eventKind) return { color: "var(--sun-700)", label: `${eventKindLabel(m.eventKind)} event` }
  if (m.flagged) return { color: "var(--bloom-700)", label: "Flagged" }
  const bucket = reportBucketOf(m.status)
  return { color: BUCKET_TONE[bucket], label: BUCKET_VIEW[bucket].label }
}

export function LiveMap({ tint = "voyager" }: { tint?: MapTint }) {
  const nav = useNav()
  const q = useHomeMap()
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const pins = React.useMemo(() => q.data?.pins ?? [], [q.data])
  const markers = React.useMemo(() => pins.map(toMapPin), [pins])
  const active = markers.find((m) => m.id === activeId) ?? null
  const tone = active ? statusTone(active) : null
  const reportCount = pins.filter((p) => p.refType === "report").length
  const eventCount = pins.filter((p) => p.refType === "event").length
  const needsAttention = pins.filter(
    (p) => p.refType === "report" && reportNeedsAttention(p.status, p.flagged),
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
          onPinTap={(p) => setActiveId(p.id)}
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

        <div aria-live="polite">
          {active && tone && (
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
              <button
                type="button"
                className="btn sm ghost"
                aria-label="Close"
                onClick={() => setActiveId(null)}
              >
                <Icons.X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
