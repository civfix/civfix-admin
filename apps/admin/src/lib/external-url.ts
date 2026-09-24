import { isSafeHttpsUrl } from "@civfix/shared"

// Stored org and claim links are operator-clickable, so they must also clear the shared safe-link
// gate (no IP literal, punycode, userinfo or overlong url); anything else is shown as plain text.
export function isHttpsUrl(value: string | null | undefined): value is string {
  return isWebUrl(value) && isSafeHttpsUrl(value)
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
