import type { ErrorCode } from "@civfix/shared"

import { toAppError } from "@/lib/api"

// fetch() rejects with a TypeError whose wording is the browser's (Chromium, Firefox, WebKit), and it
// means the request never reached the API.
const FETCH_FAILURE = /^(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)$/

const NETWORK_FAILURE = "Could not reach the server. Check your connection and try again."

function isFetchFailure(err: unknown): boolean {
  return err instanceof TypeError && FETCH_FAILURE.test(err.message)
}

/**
 * Precedence: `opts.fields[field][value]` first, because the API's `fields` map (e.g.
 * `{ contactEmail: "unverified" }`) is the only thing that tells two refusals with the same code apart;
 * then `overrides[code]`; then, unless `preferServerMessage` is false, a connection message for a
 * request that never reached the server or the Error's own message; then `fallback`. A thrown non-Error
 * carries no message, so it always gets `fallback`.
 */
export function errorMessage(
  err: unknown,
  overrides: Partial<Record<ErrorCode, string>> = {},
  opts: {
    fallback?: string
    preferServerMessage?: boolean
    fields?: Record<string, Record<string, string>>
  } = {},
): string {
  const { fallback = "Something went wrong. Please try again.", preferServerMessage = true } = opts
  const e = toAppError(err)
  if (opts.fields && e.fields) {
    for (const [field, byValue] of Object.entries(opts.fields)) {
      const value = e.fields[field]
      // The value is server data; only copy the caller wrote may match it, never an inherited member.
      if (value !== undefined && Object.hasOwn(byValue, value)) return byValue[value]!
    }
  }
  const override = overrides[e.code]
  if (override !== undefined) return override
  if (!preferServerMessage || !(err instanceof Error)) return fallback
  if (isFetchFailure(err)) return NETWORK_FAILURE
  return e.message || fallback
}
