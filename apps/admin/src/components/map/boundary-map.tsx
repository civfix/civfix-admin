"use client"

import * as React from "react"
import L from "leaflet"

import { withCartoKey } from "@/lib/carto"

// Derived from Leaflet's own signature, so no direct @types/geojson dependency is needed.
type LeafletGeoJson = Parameters<typeof L.geoJSON>[0]

// Leaflet touches window at import, so this module must be loaded through next/dynamic with ssr:false.

const TILE = {
  url: withCartoKey("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"),
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
}

const LAYER_COLOR: Record<string, string> = {
  place: "#5B8C6E",
  county: "#3F7CAC",
  state: "#8A6FB0",
  federal: "#B07A3F",
  tribal: "#B0593F",
}

export interface BoundaryMapProps {
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
