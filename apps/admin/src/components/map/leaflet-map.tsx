"use client"

import * as React from "react"
import L from "leaflet"

import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { addCartoBasemap, setCartoTint, useLeafletMap, type CartoTint } from "@/components/map/leaflet-base"
import { CATEGORY_GLYPHS } from "@/lib/category"

// Leaflet rather than community-web's MapLibre seam: a deliberate choice for this internal tool.
// Leaflet touches window at import, so this module must be loaded through next/dynamic with ssr:false.

export interface MapPin {
  id: string
  lat: number
  lng: number
  /** Null or omitted falls back to the generic glyph. */
  category?: string | null
  /** Renders the red "needs attention" pin. */
  draft?: boolean
  /** "event" renders the yellow cleanup pin; "event-volunteer" the moss other-volunteer pin. */
  kind?: string | null
  /** Tooltip title. */
  tip?: string
  label?: string
  place?: string
}

export type MapTint = CartoTint

const MAP_HOME = { center: [39.5, -98.35] as [number, number], zoom: 4 }
const BASEMAP_MAX_ZOOM = 20

const PIN_VIEWBOX_WIDTH = 64
const PIN_VIEWBOX_HEIGHT = 76
// Centers the 24-unit glyph (the icon set's grid) in the teardrop's head.
const PIN_GLYPH_OFFSET = "translate(20 16)"
const PIN_WIDTH = 31
const PIN_WIDTH_ACTIVE = 40

// Report pins are gray once routed and red while they still need a routing contact; events take the
// fill of their kind.
const TEARDROP =
  "M32 4 C46 4 58 16 58 30 C58 46 40 60 34 68 C33 69 31 69 30 68 C24 60 6 46 6 30 C6 16 18 4 32 4 Z"
const GLYPHS: Record<string, string> = {
  ...CATEGORY_GLYPHS,
  cleanup:
    "M3 6 L21 6 M19 6 V20 a2 2 0 0 1 -2 2 H7 a2 2 0 0 1 -2 -2 V6 M9 6 V4 a1 1 0 0 1 1 -1 h4 a1 1 0 0 1 1 1 V6 M9 11 V17 M12 11 V17 M15 11 V17",
  event: "M4 7 a1 1 0 0 1 1 -1 h14 a1 1 0 0 1 1 1 v12 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 Z M16 4 v4 M8 4 v4 M4 11 h16",
  "event-volunteer":
    "M12 9 a2 2 0 0 1 3 -1.3 a2 2 0 0 1 0.5 3 L12 14 L8.5 10.7 a2 2 0 0 1 0.5 -3 A2 2 0 0 1 12 9 Z M4 13 v5 a1 1 0 0 0 1 1 h2 v-6 Z M20 13 v5 a1 1 0 0 1 -1 1 h-2 v-6 Z",
}
const PIN_FILL: Record<string, string> = {
  routed: "var(--ink-3)",
  needs: "#E5564B",
  event: "var(--sun-600)",
  "event-volunteer": "#5B8C6E",
}
// Event kinds own their fill and glyph; `draft` never overrides them.
const EVENT_KINDS = new Set(["event", "event-volunteer"])

function pinIcon(
  category: string | null | undefined,
  { active = false, draft = false, kind = null }: { active?: boolean; draft?: boolean; kind?: string | null },
): L.DivIcon {
  const isEvent = kind != null && EVENT_KINDS.has(kind)
  const state = isEvent ? kind : draft ? "needs" : "routed"
  const glyphKey = isEvent ? kind : category || "other"
  // The icon html goes through innerHTML and the category arrives from the API unvalidated, so only a
  // constant own entry of GLYPHS may reach it (an inherited key like "constructor" would not).
  const glyph = Object.hasOwn(GLYPHS, glyphKey) ? GLYPHS[glyphKey]! : CATEGORY_GLYPHS.other
  const fill = PIN_FILL[state] ?? PIN_FILL.routed
  const width = active ? PIN_WIDTH_ACTIVE : PIN_WIDTH
  const height = width * (PIN_VIEWBOX_HEIGHT / PIN_VIEWBOX_WIDTH)
  const html =
    `<div class="pi-pin2 ${state}${active ? " is-active" : ""}" style="width:${width}px;height:${height}px">` +
    `<svg viewBox="0 0 ${PIN_VIEWBOX_WIDTH} ${PIN_VIEWBOX_HEIGHT}" width="${width}" height="${height}">` +
    `<path d="${TEARDROP}" style="fill:${fill};stroke:var(--fg-on-color)" stroke-width="2.5"/>` +
    `<g transform="${PIN_GLYPH_OFFSET}" style="stroke:var(--fg-on-color)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="${glyph}"/></g>` +
    `</svg>` +
    `</div>`
  return L.divIcon({
    html,
    className: "pi-pin2-wrap",
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height],
  })
}

export function tooltipText(pin: MapPin): string | null {
  const title = pin.tip || pin.label
  if (!title) return null
  return pin.place ? `${title} · ${pin.place}` : title
}

// Leaflet writes string tooltip content with innerHTML and pin titles/places are citizen-authored, so
// the content must be a node whose text is set with textContent.
function tooltipNode(text: string): HTMLElement {
  const el = document.createElement("span")
  el.textContent = text
  return el
}

// Lifts the tooltip clear of the pin head, since the marker is anchored at the pin's tip.
const PIN_TOOLTIP_OFFSET: L.PointExpression = [0, -30]
const TOOLTIP_OPTIONS: L.TooltipOptions = {
  direction: "top",
  offset: PIN_TOOLTIP_OFFSET,
  className: "pi-map-tip",
}

// A keyboard marker is a role=button tab stop, and its divIcon has no text of its own to name it.
function labelMarker(marker: L.Marker, text: string | null): void {
  const el = marker.getElement()
  if (!el) return
  if (text) el.setAttribute("aria-label", text)
  else el.removeAttribute("aria-label")
}

function syncTooltip(marker: L.Marker, text: string | null): void {
  if (!text) marker.unbindTooltip()
  else if (marker.getTooltip()) marker.setTooltipContent(tooltipNode(text))
  else marker.bindTooltip(tooltipNode(text), TOOLTIP_OPTIONS)
}

// What each marker last rendered, so a sync skips the DivIcon rebuild and DOM teardown, the tooltip
// rebind and setLatLng when nothing visible changed. Without it one activeId change re-icons every
// marker instead of just the two whose active state flipped.
interface RenderedMarker {
  key: string
  text: string | null
  lat: number
  lng: number
}

interface MarkerSync {
  activeId: string | null
  interactive: boolean
  markers: Record<string, L.Marker>
  rendered: Record<string, RenderedMarker>
  latestPins: Record<string, MapPin>
  onTap: (pin: MapPin) => void
}

function createMarker(
  map: L.Map,
  pin: MapPin,
  icon: L.DivIcon,
  text: string | null,
  sync: MarkerSync,
): L.Marker {
  const marker = L.marker([pin.lat, pin.lng], { icon, riseOnHover: true, keyboard: sync.interactive })
  marker.addTo(map)
  syncTooltip(marker, text)
  if (sync.interactive) labelMarker(marker, text)
  const tap = () => {
    const latest = sync.latestPins[pin.id]
    if (latest) sync.onTap(latest)
  }
  marker.on("click", tap)
  marker.on("keydown", (e: L.LeafletKeyboardEvent) => {
    if (!isKeyboardActivationKey(e.originalEvent.key)) return
    e.originalEvent.preventDefault()
    tap()
  })
  return marker
}

function updateMarker(
  marker: L.Marker,
  prev: RenderedMarker | undefined,
  next: RenderedMarker,
  icon: () => L.DivIcon,
  interactive: boolean,
): void {
  if (!prev || prev.key !== next.key) marker.setIcon(icon())
  if (!prev || prev.text !== next.text) {
    syncTooltip(marker, next.text)
    if (interactive) labelMarker(marker, next.text)
  }
  if (!prev || prev.lat !== next.lat || prev.lng !== next.lng) marker.setLatLng([next.lat, next.lng])
}

function syncMarkers(map: L.Map, pins: MapPin[], sync: MarkerSync): void {
  const { markers, rendered, latestPins } = sync
  const nextIds = new Set(pins.map((p) => p.id))
  for (const id of Object.keys(markers)) {
    if (nextIds.has(id)) continue
    markers[id]?.remove()
    delete markers[id]
    delete rendered[id]
    delete latestPins[id]
  }

  for (const p of pins) {
    latestPins[p.id] = p
    const active = String(p.id) === String(sync.activeId)
    const next: RenderedMarker = {
      // Everything pinIcon() depends on: an equal key means an identical DivIcon.
      key: `${p.category}|${p.draft}|${p.kind}|${active}`,
      text: tooltipText(p),
      lat: p.lat,
      lng: p.lng,
    }
    const icon = () => pinIcon(p.category, { active, draft: p.draft, kind: p.kind })
    const existing = markers[p.id]
    if (existing) updateMarker(existing, rendered[p.id], next, icon, sync.interactive)
    else markers[p.id] = createMarker(map, p, icon(), next.text, sync)
    rendered[p.id] = next
  }
}

export interface LeafletMapProps {
  pins?: MapPin[]
  center?: [number, number]
  zoom?: number
  tint?: MapTint
  activeId?: string | null
  interactive?: boolean
  onPinTap?: (pin: MapPin) => void
}

export function LeafletMap({
  pins = [],
  center = MAP_HOME.center,
  zoom = MAP_HOME.zoom,
  tint = "voyager",
  activeId = null,
  interactive = true,
  onPinTap,
}: LeafletMapProps) {
  const elRef = React.useRef<HTMLDivElement | null>(null)
  const tileRef = React.useRef<L.TileLayer | null>(null)
  const markersRef = React.useRef<Record<string, L.Marker>>({})
  const renderRef = React.useRef<Record<string, RenderedMarker>>({})
  // The latest pin per id: marker handlers are bound once, and a refetch replaces the pin objects.
  const pinsRef = React.useRef<Record<string, MapPin>>({})
  // Keep the latest onPinTap without re-running the create effect.
  const onPinTapRef = React.useRef(onPinTap)
  onPinTapRef.current = onPinTap

  const mapRef = useLeafletMap(
    elRef,
    (container) => {
      const map = L.map(container, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: true,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        boxZoom: false,
        keyboard: false,
        // No `tap`: the legacy option is a no-op in modern Leaflet and gone from @types/leaflet.
      })
      tileRef.current = addCartoBasemap(map, { tint, maxZoom: BASEMAP_MAX_ZOOM })
      if (interactive) {
        L.control.zoom({ position: "topright" }).addTo(map)
      }
      return map
    },
    () => {
      tileRef.current = null
      markersRef.current = {}
      renderRef.current = {}
      pinsRef.current = {}
    },
  )

  const [centerLat, centerLng] = center
  React.useEffect(() => {
    mapRef.current?.setView([centerLat, centerLng], zoom)
  }, [mapRef, centerLat, centerLng, zoom])

  React.useEffect(() => {
    if (tileRef.current) setCartoTint(tileRef.current, tint)
  }, [tint])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    syncMarkers(map, pins, {
      activeId,
      interactive,
      markers: markersRef.current,
      rendered: renderRef.current,
      latestPins: pinsRef.current,
      onTap: (pin) => onPinTapRef.current?.(pin),
    })
  }, [mapRef, pins, activeId, interactive])

  return <div ref={elRef} className="pi-map-canvas" />
}
