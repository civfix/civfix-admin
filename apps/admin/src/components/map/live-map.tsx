"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { HomeMapPin } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { useHomeMap } from "@/features/home/use-home"
import { useNav } from "@/store/ui-store"
import { categoryLabel } from "@/lib/category"
import { EVENT_KIND_PIN_KIND, eventKindLabel } from "@/lib/event-kind"
import { reportNeedsAttention, reportStatusView } from "@/lib/report-status"
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

interface LivePin extends MapPin {
  tip: string
  refType: HomeMapPin["refType"]
  refId: string
  eventKind: NonNullable<HomeMapPin["eventKind"]> | null
  status: HomeMapPin["status"]
  flagged: boolean
}

function toMapPin(p: HomeMapPin): LivePin {
  const isEvent = p.refType === "event"
  const needs = !isEvent && reportNeedsAttention(p.status, p.flagged)
  const eventKind = isEvent ? (p.eventKind ?? "cleanup") : null
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
    tip: pinTitle(p),
    place: p.place,
    status: p.status,
    flagged: p.flagged,
  }
}

function statusTone(pin: LivePin): { color: string; label: string } {
  if (pin.eventKind === "other_volunteer") {
    return { color: "var(--moss-700)", label: `${eventKindLabel(pin.eventKind)} event` }
  }
  if (pin.eventKind) return { color: "var(--sun-700)", label: `${eventKindLabel(pin.eventKind)} event` }
  if (pin.flagged) return { color: "var(--bloom-700)", label: "Flagged" }
  const view = reportStatusView(pin.status)
  return { color: view.tone, label: view.label }
}

function pinStateClass(pin: LivePin): string {
  if (pin.refType === "event") return "is-event"
  return pin.draft ? "is-needs" : "is-routed"
}

function ActivePinCard({
  pin,
  onOpen,
  onClose,
}: {
  pin: LivePin
  onOpen: () => void
  onClose: () => void
}) {
  const tone = statusTone(pin)
  return (
    <div className="map-active-card">
      <div className={`mac-pin ${pinStateClass(pin)}`}>
        <Icons.Pin size={15} />
      </div>
      <div className="mac-body">
        <div className="mac-title">{pin.tip}</div>
        <div className="mac-sub">
          <span>{pin.place}</span>
          <span className="sep">·</span>
          <span style={{ color: tone.color, fontWeight: 700 }}>{tone.label}</span>
        </div>
      </div>
      <button className="btn sm primary" onClick={onOpen}>
        Open {pin.refType === "event" ? "event" : "report"} →
      </button>
      <button type="button" className="btn sm ghost" aria-label="Close" onClick={onClose}>
        <Icons.X size={14} />
      </button>
    </div>
  )
}

function MapUnavailableCard({ onRetry }: { onRetry: () => void }) {
  return (
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
      <button className="btn sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

function MapLegend() {
  return (
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
  )
}

export function LiveMap({ tint = "voyager" }: { tint?: MapTint }) {
  const nav = useNav()
  const mapQuery = useHomeMap()
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const pins = React.useMemo(() => mapQuery.data?.pins ?? [], [mapQuery.data])
  const markers = React.useMemo(() => pins.map(toMapPin), [pins])
  const active = markers.find((m) => m.id === activeId) ?? null
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
        <MapLegend />

        {mapQuery.isError && !pins.length && (
          <MapUnavailableCard onRetry={() => mapQuery.refetch()} />
        )}

        <div aria-live="polite">
          {active && (
            <ActivePinCard pin={active} onOpen={openActive} onClose={() => setActiveId(null)} />
          )}
        </div>
      </div>
    </section>
  )
}
