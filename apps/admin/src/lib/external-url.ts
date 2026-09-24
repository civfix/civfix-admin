export function isHttpsUrl(value: string | null | undefined): value is string {
  if (value === null || value === undefined) return false
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Absolute http(s) only. Server-signed links (mail attachments) are http in local dev, where the API
 * serves its own `/_local-storage` URLs, so this is the scheme gate for them rather than https-only.
 */
export function isWebUrl(value: string | null | undefined): value is string {
  if (value === null || value === undefined) return false
  try {
    const { protocol } = new URL(value)
    return protocol === "https:" || protocol === "http:"
  } catch {
    return false
  }
}
