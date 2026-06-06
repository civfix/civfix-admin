import type { ErrorCode } from "@civfix/shared"

import { toAppError } from "@/lib/api"

/**
 * Map a thrown value to friendly, user-actionable copy. Ported from community-web.
 *
 * Callers pass only the codes whose copy is domain-specific via `overrides`; the helper falls back to
 * the server message (when present) or a generic line. The error is normalized with toAppError first,
 * so callers can pass the raw caught value.
 *
 *  - `overrides[code]` wins when present.
 *  - otherwise, when `preferServerMessage` is true (default), the server-provided message is shown when
 *    non-empty, then `fallback`.
 *  - set `preferServerMessage: false` to always use `fallback` for unmapped codes.
 */
export function errorMessage(
  err: unknown,
  overrides: Partial<Record<ErrorCode, string>> = {},
  opts: { fallback?: string; preferServerMessage?: boolean } = {},
): string {
  const { fallback = "Something went wrong. Please try again.", preferServerMessage = true } = opts
  const e = toAppError(err)
  const override = overrides[e.code]
  if (override !== undefined) return override
  if (preferServerMessage) return e.message || fallback
  return fallback
}
