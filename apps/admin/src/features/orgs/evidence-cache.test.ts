import { describe, expect, it } from "vitest"

import {
  EVIDENCE_URL_MAX_CACHE_MS,
  evidenceUrlLifetimeMs,
  evidenceUrlRemainingMs,
  isEvidenceUrlExpired,
} from "./evidence-cache"

const NOW = Date.parse("2026-09-06T12:00:00.000Z")

describe("evidence signed-url lifetime", () => {
  it("caches for the remaining window less a safety margin", () => {
    expect(evidenceUrlLifetimeMs("2026-09-06T12:01:00.000Z", NOW)).toBe(55_000)
  })

  it("never outlives the operator-plane ceiling", () => {
    expect(evidenceUrlLifetimeMs("2026-09-06T13:00:00.000Z", NOW)).toBe(EVIDENCE_URL_MAX_CACHE_MS)
  })

  it("treats an expired, missing or unparseable expiry as no cache at all", () => {
    expect(evidenceUrlLifetimeMs("2026-09-06T11:59:00.000Z", NOW)).toBe(0)
    expect(evidenceUrlLifetimeMs(null, NOW)).toBe(0)
    expect(evidenceUrlLifetimeMs(undefined, NOW)).toBe(0)
    expect(evidenceUrlLifetimeMs("not-a-date", NOW)).toBe(0)
  })

  it("reports expiry once the safety margin is consumed", () => {
    expect(isEvidenceUrlExpired("2026-09-06T12:00:04.000Z", NOW)).toBe(true)
    expect(isEvidenceUrlExpired("2026-09-06T12:00:30.000Z", NOW)).toBe(false)
  })

  it("keeps the real remaining lifetime uncapped so the expiry timer never fires early", () => {
    expect(evidenceUrlRemainingMs("2026-09-06T13:00:00.000Z", NOW)).toBe(3_595_000)
    expect(evidenceUrlRemainingMs("2026-09-06T11:00:00.000Z", NOW)).toBe(0)
    expect(isEvidenceUrlExpired("2026-09-06T13:00:00.000Z", NOW)).toBe(false)
  })
})
