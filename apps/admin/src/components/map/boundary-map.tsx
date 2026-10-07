"use client"

import * as React from "react"
import L from "leaflet"

import { addCartoBasemap, useLeafletMap } from "@/components/map/leaflet-base"

// Derived from Leaflet's own signature, so no direct @types/geojson dependency is needed.
type LeafletGeoJson = Parameters<L.GeoJSON["addData"]>[0]

// Leaflet touches window at import, so this module must be loaded through next/dynamic with ssr:false.

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
  const shapeRef = React.useRef<L.GeoJSON | null>(null)

  const mapRef = useLeafletMap(
    elRef,
    (container) => {
      const map = L.map(container, {
        zoomControl: true,
        attributionControl: true,
        // The map sits inside a scrollable detail panel, so the wheel must scroll the panel.
        scrollWheelZoom: false,
      })
      addCartoBasemap(map, { maxZoom: TILE_MAX_ZOOM })
      shapeRef.current = L.geoJSON().addTo(map)
      return map
    },
    () => {
      shapeRef.current = null
    },
  )

  React.useEffect(() => {
    const map = mapRef.current
    const shape = shapeRef.current
    if (!map || !shape) return
    const color = LAYER_COLOR[layer] ?? LAYER_COLOR.place
    // addData styles each new layer from options.style, so the style is set before the data goes in.
    shape.options.style = { color, weight: SHAPE_WEIGHT, fillColor: color, fillOpacity: SHAPE_FILL_OPACITY }
    // L.GeoJSON accepts a bare GeoJSON geometry object.
    shape.clearLayers().addData(geometry as unknown as LeafletGeoJson)

    // bbox is [west, south, east, north]; Leaflet bounds are [[south, west], [north, east]].
    const [west, south, east, north] = bbox
    map.fitBounds(
      [
        [south, west],
        [north, east],
      ],
      FIT_OPTIONS,
    )
  }, [mapRef, geometry, bbox, layer])

  return <div ref={elRef} className="pi-map-canvas" />
}
