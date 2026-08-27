/**
 * The publishable CARTO basemap api key (mirrors civfix-web's src/lib/carto.ts).
 *
 * Reads NEXT_PUBLIC_CARTO_API_KEY, which is INLINED into the static export at build time (changing it
 * needs a rebuild, not a restart). CARTO watermarks keyless raster tiles, so a configured key removes the
 * watermark - but the key is optional by design: when it is absent `withCartoKey` returns the tile URL
 * untouched and the Leaflet basemap renders exactly as it always has. It is a client-visible value,
 * never a secret.
 */
export const CARTO_API_KEY: string | undefined = process.env.NEXT_PUBLIC_CARTO_API_KEY

/** Append the CARTO api key to one tile-template URL. A missing/blank key leaves the URL unchanged. */
export function withCartoKey(url: string, key: string | undefined = CARTO_API_KEY): string {
  const trimmed = key?.trim()
  return trimmed ? `${url}?key=${encodeURIComponent(trimmed)}` : url
}
