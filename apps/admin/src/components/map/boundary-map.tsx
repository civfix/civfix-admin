"use client"

import * as React from "react"
import L from "leaflet"

/** The GeoJSON object type L.geoJSON accepts, derived from Leaflet's own signature (avoids a direct @types/geojson import). */
type LeafletGeoJson = Parameters<typeof L.geoJSON>[0]

/**
 * A small Leaflet map that draws ONE jurisdiction's boundary polygon and fits to it — the directory's
 * "is this in the right place?" verification view. CARTO Voyager raster basemap (same tiles as the
 * marker map.tsx); the polygon is the server-simplified GeoJSON from GET /admin/jurisdictions/:geoid/
 * geometry. Like leaflet-map.tsx this imports Leaflet at the top level, so it MUST be loaded client-only
 * via next/dynamic (ssr:false). Leaflet's CSS is imported globally in globals.css.
 */

const TILE = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
}

/** Boundary fill/stroke by jurisdiction layer, so a city reads differently from a county/federal land. */
const LAYER_COLOR: Record<string, string> = {
  place: "#5B8C6E",
  county: "#3F7CAC",
  state: "#8A6FB0",
  federal: "#B07A3F",
  tribal: "#B0593F",
}

export interface BoundaryMapProps {
  /** GeoJSON Polygon/MultiPolygon geometry. */
  geometry: { type: string; coordinates: unknown }
  /** [west, south, east, north] for fit-bounds. */
  bbox: [number, number, number, number]
  /** Jurisdiction layer, drives the boundary color. */
  layer?: string
}

export function BoundaryMap({ geometry, bbox, layer = "place" }: BoundaryMapProps) {
  const elRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<L.Map | null>(null)
  const shapeRef = React.useRef<L.GeoJSON | null>(null)

  // Create the map once.
  React.useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false, // require an explicit zoom (it sits inside a scrollable detail panel)
    })
    mapRef.current = map
    L.tileLayer(TILE.url, {
      attribution: TILE.attribution,
      subdomains: TILE.subdomains,
      maxZoom: 19,
      detectRetina: true,
    }).addTo(map)

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(elRef.current)
    const t0 = setTimeout(() => map.invalidateSize(), 60)

    return () => {
      ro.disconnect()
      clearTimeout(t0)
      map.remove()
      mapRef.current = null
      shapeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw / redraw the boundary and fit to its bbox whenever the geometry changes.
  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (shapeRef.current) {
      shapeRef.current.remove()
      shapeRef.current = null
    }
    const color = LAYER_COLOR[layer] ?? LAYER_COLOR.place
    // L.geoJSON accepts a bare GeoJSON geometry object.
    const shape = L.geoJSON(geometry as unknown as LeafletGeoJson, {
      style: { color, weight: 2, fillColor: color, fillOpacity: 0.18 },
    }).addTo(map)
    shapeRef.current = shape

    // bbox is [west, south, east, north]; Leaflet bounds are [[south, west], [north, east]].
    const [west, south, east, north] = bbox
    map.fitBounds(
      [
        [south, west],
        [north, east],
      ],
      { padding: [12, 12], maxZoom: 13 },
    )
  }, [geometry, bbox, layer])

  return <div ref={elRef} className="pi-map-canvas" />
}
