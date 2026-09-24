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
 * Map a thrown value to friendly, user-actionable copy. Ported from community-web.
 *
 * Callers pass only the codes whose copy is domain-specific via `overrides`; the helper falls back to
 * the server message (when present) or a generic line. The error is normalized with toAppError first,
 * so callers can pass the raw caught value.
 *
 *  - `opts.fields[field][value]` wins first: the API's validation errors carry a `fields` map (e.g.
 *    `{ contactEmail: "unverified" }`), which is the only thing that tells two refusals with the same
 *    error code apart.
 *  - then `overrides[code]`.
 *  - otherwise, when `preferServerMessage` is true (default): a request that never reached the server
 *    reads as a connection problem, and an Error's own message is shown when non-empty, then
 *    `fallback`. A thrown non-Error carries no message, so it gets `fallback`.
 *  - set `preferServerMessage: false` to always use `fallback` for unmapped codes.
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
