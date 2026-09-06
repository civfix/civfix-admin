export const EVIDENCE_URL_MAX_CACHE_MS = 5 * 60_000
const EVIDENCE_URL_SAFETY_MS = 5_000

export function evidenceUrlLifetimeMs(
  expiresAt: string | null | undefined,
  now: Date | number = Date.now(),
): number {
  return Math.min(evidenceUrlRemainingMs(expiresAt, now), EVIDENCE_URL_MAX_CACHE_MS)
}

export function evidenceUrlRemainingMs(
  expiresAt: string | null | undefined,
  now: Date | number = Date.now(),
): number {
  if (expiresAt === null || expiresAt === undefined) return 0
  const expiry = Date.parse(expiresAt)
  if (Number.isNaN(expiry)) return 0
  const nowMs = now instanceof Date ? now.getTime() : now
  const remaining = expiry - nowMs - EVIDENCE_URL_SAFETY_MS
  return remaining > 0 ? remaining : 0
}

export function isEvidenceUrlExpired(
  expiresAt: string | null | undefined,
  now: Date | number = Date.now(),
): boolean {
  return evidenceUrlRemainingMs(expiresAt, now) === 0
}
