"use client"

import * as React from "react"
import L from "leaflet"

import { withCartoKey } from "@/lib/carto"
import { MAP_SETTLE_MS } from "@/lib/timing"

// Derived from Leaflet's own signature, so no direct @types/geojson dependency is needed.
type LeafletGeoJson = Parameters<typeof L.geoJSON>[0]

// Leaflet touches window at import, so this module must be loaded through next/dynamic with ssr:false.

const TILE = {
  url: withCartoKey("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"),
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
}

const TILE_MAX_ZOOM = 19
// maxZoom caps how far the fit zooms in, so a tiny place still shows its surroundings.
const FIT_OPTIONS: L.FitBoundsOptions = { padding: [12, 12], maxZoom: 13 }
const SHAPE_WEIGHT = 2
const SHAPE_FILL_OPACITY = 0.18

const LAYER_COLOR: Record<string, string> = {
  place: "#5B8C6E",
  county: "#3F7CAC",
  state: "#8A6FB0",
  federal: "#B07A3F",
  tribal: "#B0593F",
}

interface BoundaryMapProps {
  geometry: { type: string; coordinates: unknown }
  /** [west, south, east, north] */
  bbox: [number, number, number, number]
  layer?: string
}

export function BoundaryMap({ geometry, bbox, layer = "place" }: BoundaryMapProps) {
  const elRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<L.Map | null>(null)
  const shapeRef = React.useRef<L.GeoJSON | null>(null)

  React.useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, {
      zoomControl: true,
      attributionControl: true,
      // The map sits inside a scrollable detail panel, so the wheel must scroll the panel.
      scrollWheelZoom: false,
    })
    mapRef.current = map
    L.tileLayer(TILE.url, {
      attribution: TILE.attribution,
      subdomains: TILE.subdomains,
      maxZoom: TILE_MAX_ZOOM,
      detectRetina: true,
    }).addTo(map)

    const resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(elRef.current)
    const settleTimer = setTimeout(() => map.invalidateSize(), MAP_SETTLE_MS)

    return () => {
      resizeObserver.disconnect()
      clearTimeout(settleTimer)
      map.remove()
      mapRef.current = null
      shapeRef.current = null
    }
  }, [])

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
      style: { color, weight: SHAPE_WEIGHT, fillColor: color, fillOpacity: SHAPE_FILL_OPACITY },
    }).addTo(map)
    shapeRef.current = shape

    // bbox is [west, south, east, north]; Leaflet bounds are [[south, west], [north, east]].
    const [west, south, east, north] = bbox
    map.fitBounds(
      [
        [south, west],
        [north, east],
      ],
      FIT_OPTIONS,
    )
  }, [geometry, bbox, layer])

  return <div ref={elRef} className="pi-map-canvas" />
}
