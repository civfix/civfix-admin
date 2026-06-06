"use client"

import * as React from "react"
import L from "leaflet"

/**
 * The civfix universal map (ported from the design's map.jsx PinItMap). Real OpenStreetMap data via
 * Leaflet + CARTO raster tiles - a deliberate design-fidelity choice for this internal tool (it matches
 * the prototype exactly and does NOT use MapLibre/pmtiles like community-web).
 *
 * This module imports Leaflet at the top level, so it MUST only ever be loaded on the client. It is
 * imported via next/dynamic with `ssr:false` from live-map.tsx (and any future minimap). Leaflet's CSS
 * is imported globally in src/app/globals.css.
 */

export interface MapPin {
  /** Stable marker id. */
  id: string
  lat: number
  lng: number
  /** Report category for the glyph; null/omitted falls back to a generic pin. */
  category?: string | null
  /** When true, renders the red "needs attention" pin. */
  draft?: boolean
  /** "event" renders the yellow event pin. */
  kind?: string | null
  /** Tooltip title. */
  tip?: string
  label?: string
  place?: string
}

const MAP_TILES = {
  voyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
  positron: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
} as const

export type MapTint = keyof typeof MAP_TILES

export const MAP_HOME = { center: [39.5, -98.35] as [number, number], zoom: 4 }

// Brand pin as a Leaflet divIcon. Routed jurisdictions render gray with a glyph; jurisdictions that
// still need a routing contact render red; events render yellow. (Ported from map.jsx.)
const TEARDROP =
  "M32 4 C46 4 58 16 58 30 C58 46 40 60 34 68 C33 69 31 69 30 68 C24 60 6 46 6 30 C6 16 18 4 32 4 Z"
const GLYPHS: Record<string, string> = {
  trash:
    "M9 6 L9 5 a1.5 1.5 0 0 1 1.5 -1.5 h3 a1.5 1.5 0 0 1 1.5 1.5 v1 M5 6 h14 M6 6 l1 12 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 l1 -12 M10 11 v5 M14 11 v5",
  hazard: "M12 4 L2 20 H22 L12 4 Z M12 10 v4 M12 17 v0.5",
  graffiti: "M4 14 v3 a2 2 0 0 0 2 2 h2 v-3 M4 14 l9 -9 a2.83 2.83 0 0 1 4 4 l-9 9 H4 v-4 Z",
  cleanup:
    "M3 6 L21 6 M19 6 V20 a2 2 0 0 1 -2 2 H7 a2 2 0 0 1 -2 -2 V6 M9 6 V4 a1 1 0 0 1 1 -1 h4 a1 1 0 0 1 1 1 V6 M9 11 V17 M12 11 V17 M15 11 V17",
  recycling: "M12 4 L8 11 H16 L12 4 Z M5 13 L3 17 L7 19 M19 13 L21 17 L17 19 M8 20 H16",
  water: "M12 3 C7 8 4 12 4 15 a8 8 0 0 0 16 0 c0 -3 -3 -7 -8 -12 Z",
  event: "M4 7 a1 1 0 0 1 1 -1 h14 a1 1 0 0 1 1 1 v12 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 Z M16 4 v4 M8 4 v4 M4 11 h16",
}
const PIN_FILL: Record<string, string> = { routed: "#8A8378", needs: "#E5564B", event: "#E5AE1C" }

function pinIcon(
  category: string | null | undefined,
  { active = false, draft = false, kind = null }: { active?: boolean; draft?: boolean; kind?: string | null },
): L.DivIcon {
  const state = kind === "event" ? "event" : draft ? "needs" : "routed"
  const glyph = GLYPHS[kind === "event" ? "event" : category || "trash"] || GLYPHS.trash
  const fill = PIN_FILL[state]
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

export interface LeafletMapProps {
  pins?: MapPin[]
  center?: [number, number]
  zoom?: number
  tint?: MapTint
  activeId?: string | null
  interactive?: boolean
  onPinTap?: (pin: MapPin) => void
}

/**
 * Imperative Leaflet wrapper. Creates the map once, swaps the tile layer on tint change, and
 * reconciles markers when `pins` / `activeId` change. Mirrors map.jsx PinItMap behavior.
 */
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
  // Keep the latest onPinTap without re-running the create effect.
  const onPinTapRef = React.useRef(onPinTap)
  onPinTapRef.current = onPinTap

  // Create the map once.
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
      // Note: Leaflet's legacy `tap` option was dropped from @types/leaflet (and is a no-op in modern
      // Leaflet), so it is intentionally omitted here; touch tap is handled natively.
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
    }
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap tiles when tint changes.
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

  // Reconcile markers.
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
      }
    })

    pins.forEach((p) => {
      const existing = markersRef.current[p.id]
      const icon = pinIcon(p.category, {
        active: String(p.id) === String(activeId),
        draft: p.draft,
        kind: p.kind,
      })
      if (existing) {
        existing.setLatLng([p.lat, p.lng])
        existing.setIcon(icon)
      } else {
        const m = L.marker([p.lat, p.lng], { icon, riseOnHover: true }).addTo(map)
        const tip = p.tip || p.label
        if (tip) {
          m.bindTooltip(tip + (p.place ? ` - ${p.place}` : ""), {
            direction: "top",
            offset: [0, -30],
            className: "pi-map-tip",
          })
        }
        m.on("click", () => onPinTapRef.current?.(p))
        markersRef.current[p.id] = m
      }
    })
  }, [pins, activeId])

  return <div ref={elRef} className="pi-map-canvas" />
}
