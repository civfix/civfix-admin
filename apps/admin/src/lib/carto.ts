/**
 * A publishable key, never a secret, inlined at build time. CARTO watermarks keyless raster tiles, but
 * the key is optional: without it the basemap still renders.
 */
export const CARTO_API_KEY: string | undefined = process.env.NEXT_PUBLIC_CARTO_API_KEY

export function withCartoKey(url: string, key: string | undefined = CARTO_API_KEY): string {
  const trimmed = key?.trim()
  return trimmed ? `${url}?key=${encodeURIComponent(trimmed)}` : url
}
