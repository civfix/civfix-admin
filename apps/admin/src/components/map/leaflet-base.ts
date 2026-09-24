import * as React from "react"
import L from "leaflet"

import { withCartoKey } from "@/lib/carto"
import { MAP_SETTLE_MS } from "@/lib/timing"

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

const CARTO_TILE_URLS = {
  voyager: withCartoKey("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"),
  positron: withCartoKey("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"),
} as const

export type CartoTint = keyof typeof CARTO_TILE_URLS

function cartoUrl(tint: CartoTint): string {
  return CARTO_TILE_URLS[tint] ?? CARTO_TILE_URLS.voyager
}

export function addCartoBasemap(
  map: L.Map,
  { tint = "voyager", maxZoom }: { tint?: CartoTint; maxZoom: number },
): L.TileLayer {
  return L.tileLayer(cartoUrl(tint), {
    attribution: CARTO_ATTRIBUTION,
    subdomains: "abcd",
    maxZoom,
    detectRetina: true,
  }).addTo(map)
}

// Every tint shares the attribution, subdomains and zoom range, so only the URL template differs;
// setUrl is a no-op when the URL is unchanged.
export function setCartoTint(layer: L.TileLayer, tint: CartoTint): void {
  layer.setUrl(cartoUrl(tint))
}

export function attachResize(map: L.Map, container: HTMLElement): () => void {
  const resizeObserver = new ResizeObserver(() => map.invalidateSize())
  resizeObserver.observe(container)
  const settleTimer = setTimeout(() => map.invalidateSize(), MAP_SETTLE_MS)
  return () => {
    resizeObserver.disconnect()
    clearTimeout(settleTimer)
  }
}

/**
 * Creates the map once on mount with `create`, keeps it sized to its container, and removes it on
 * unmount, after which `onRemove` resets whatever layer state the caller holds for it. Declare the
 * caller's own effects after this hook so they run against the created map.
 */
export function useLeafletMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  create: (container: HTMLDivElement) => L.Map,
  onRemove?: () => void,
): React.RefObject<L.Map | null> {
  const mapRef = React.useRef<L.Map | null>(null)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return
    const map = create(container)
    mapRef.current = map
    const detachResize = attachResize(map, container)

    return () => {
      detachResize()
      map.remove()
      mapRef.current = null
      onRemove?.()
    }
    // Created once; callers' own effects apply later prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  return mapRef
}
