"use client"

import * as React from "react"
import L from "leaflet"

import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { withCartoKey } from "@/lib/carto"
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

const MAP_TILES = {
  voyager: {
    url: withCartoKey("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"),
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
  positron: {
    url: withCartoKey("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"),
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
} as const

export type MapTint = keyof typeof MAP_TILES

export const MAP_HOME = { center: [39.5, -98.35] as [number, number], zoom: 4 }

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
  routed: "#8A8378",
  needs: "#E5564B",
  event: "#E5AE1C",
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
  const w = active ? 40 : 31
  const h = w * (76 / 64)
  const html =
    `<div class="pi-pin2 ${state}${active ? " is-active" : ""}" style="width:${w}px;height:${h}px">` +
    `<svg viewBox="0 0 64 76" width="${w}" height="${h}">` +
    `<path d="${TEARDROP}" fill="${fill}" stroke="#fff" stroke-width="2.5"/>` +
    `<g transform="translate(20 16)" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="${glyph}"/></g>` +
    `</svg>` +
    `</div>`
  return L.divIcon({
    html,
    className: "pi-pin2-wrap",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
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

const TOOLTIP_OPTIONS: L.TooltipOptions = { direction: "top", offset: [0, -30], className: "pi-map-tip" }

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
  const mapRef = React.useRef<L.Map | null>(null)
  const tileRef = React.useRef<L.TileLayer | null>(null)
  const markersRef = React.useRef<Record<string, L.Marker>>({})
  // What each marker last rendered, so reconcile skips the DivIcon rebuild and DOM teardown, the tooltip
  // rebind and setLatLng when nothing visible changed. Without it one activeId change re-icons every
  // marker instead of just the two whose active state flipped.
  const renderRef = React.useRef<
    Record<string, { key: string; text: string | null; lat: number; lng: number }>
  >({})
  // The latest pin per id: marker handlers are bound once, and a refetch replaces the pin objects.
  const pinsRef = React.useRef<Record<string, MapPin>>({})
  // Keep the latest onPinTap without re-running the create effect.
  const onPinTapRef = React.useRef(onPinTap)
  onPinTapRef.current = onPinTap

  React.useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, {
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
    mapRef.current = map

    const t = MAP_TILES[tint] ?? MAP_TILES.voyager
    tileRef.current = L.tileLayer(t.url, {
      attribution: t.attribution,
      subdomains: t.subdomains,
      maxZoom: 20,
      detectRetina: true,
    }).addTo(map)

    if (interactive) {
      L.control.zoom({ position: "topright" }).addTo(map)
    }

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(elRef.current)
    const t0 = setTimeout(() => map.invalidateSize(), 60)

    return () => {
      ro.disconnect()
      clearTimeout(t0)
      map.remove()
      mapRef.current = null
      markersRef.current = {}
      renderRef.current = {}
      pinsRef.current = {}
    }
    // Created once; the effects below apply later prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [centerLat, centerLng] = center
  React.useEffect(() => {
    mapRef.current?.setView([centerLat, centerLng], zoom)
  }, [centerLat, centerLng, zoom])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (tileRef.current) tileRef.current.remove()
    const t = MAP_TILES[tint] ?? MAP_TILES.voyager
    tileRef.current = L.tileLayer(t.url, {
      attribution: t.attribution,
      subdomains: t.subdomains,
      maxZoom: 20,
      detectRetina: true,
    }).addTo(map)
  }, [tint])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const next: Record<string, MapPin> = {}
    pins.forEach((p) => {
      next[p.id] = p
    })

    Object.keys(markersRef.current).forEach((id) => {
      if (!next[id]) {
        markersRef.current[id]?.remove()
        delete markersRef.current[id]
        delete renderRef.current[id]
        delete pinsRef.current[id]
      }
    })

    pins.forEach((p) => {
      pinsRef.current[p.id] = p
      const existing = markersRef.current[p.id]
      const active = String(p.id) === String(activeId)
      // Everything pinIcon() depends on: an equal key means an identical DivIcon.
      const key = `${p.category}|${p.draft}|${p.kind}|${active}`
      const text = tooltipText(p)
      if (existing) {
        const prev = renderRef.current[p.id]
        if (!prev || prev.key !== key) {
          existing.setIcon(pinIcon(p.category, { active, draft: p.draft, kind: p.kind }))
        }
        if (!prev || prev.text !== text) {
          syncTooltip(existing, text)
          if (interactive) labelMarker(existing, text)
        }
        if (!prev || prev.lat !== p.lat || prev.lng !== p.lng) {
          existing.setLatLng([p.lat, p.lng])
        }
      } else {
        const icon = pinIcon(p.category, { active, draft: p.draft, kind: p.kind })
        const m = L.marker([p.lat, p.lng], { icon, riseOnHover: true, keyboard: interactive }).addTo(map)
        syncTooltip(m, text)
        if (interactive) labelMarker(m, text)
        const tap = () => {
          const latest = pinsRef.current[p.id]
          if (latest) onPinTapRef.current?.(latest)
        }
        m.on("click", tap)
        m.on("keydown", (e: L.LeafletKeyboardEvent) => {
          if (!isKeyboardActivationKey(e.originalEvent.key)) return
          e.originalEvent.preventDefault()
          tap()
        })
        markersRef.current[p.id] = m
      }
      renderRef.current[p.id] = { key, text, lat: p.lat, lng: p.lng }
    })
  }, [pins, activeId, interactive])

  return <div ref={elRef} className="pi-map-canvas" />
}
