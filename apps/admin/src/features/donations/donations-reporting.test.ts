import { describe, expect, it } from "vitest"
import type {
  AdminDonationOrgTotalsDTO,
  AdminPaymentsEligibilityRowDTO,
} from "@civfix/shared"

import {
  filingReminders,
  mnosCheckLog,
  nextFilingDate,
  pl4CsvRows,
  pl4DefaultYear,
  pl4Period,
  pl4PeriodYears,
  pl4ReportingYear,
} from "./donations-reporting"

const SEPT = Date.parse("2026-09-06T12:00:00.000Z")
const MARCH = Date.parse("2026-03-01T00:00:00.000Z")

function orgTotals(over: Partial<AdminDonationOrgTotalsDTO>): AdminDonationOrgTotalsDTO {
  return {
    organizationId: "o1",
    orgName: "Reach Out LA",
    orgSlug: "reach-out-la",
    count: 2,
    grossMinor: 5_000,
    platformFeeMinor: 250,
    refundedMinor: 0,
    netMinor: 4_750,
    firstChargedAt: "2026-05-01T00:00:00.000Z",
    lastChargedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  }
}

describe("CA AG filing reminders", () => {
  it("rolls each filing date forward to its next occurrence", () => {
    expect(nextFilingDate(0, 15, SEPT).toISOString()).toBe("2027-01-15T00:00:00.000Z")
    expect(nextFilingDate(6, 15, SEPT).toISOString()).toBe("2027-07-15T00:00:00.000Z")
    expect(nextFilingDate(6, 15, MARCH).toISOString()).toBe("2026-07-15T00:00:00.000Z")
  })

  it("keeps today's filing date rather than skipping a year", () => {
    expect(nextFilingDate(6, 15, Date.parse("2026-07-15T18:00:00.000Z")).toISOString()).toBe(
      "2026-07-15T00:00:00.000Z",
    )
  })

  it("reports days remaining and the covered period", () => {
    const [pl2, pl4] = filingReminders(SEPT)
    expect(pl2!.dueOn).toBe("2027-01-15")
    expect(pl2!.daysRemaining).toBe(131)
    expect(pl4!.dueOn).toBe("2027-07-15")
    expect(pl4!.covers).toBe("Calendar year 2026")
  })

  it("derives the reporting year from the next July 15", () => {
    expect(pl4ReportingYear(SEPT)).toBe(2026)
    expect(pl4ReportingYear(MARCH)).toBe(2025)
    expect(pl4PeriodYears(SEPT)).toEqual([2026, 2025, 2024])
  })

  it("builds a UTC calendar-year period and closes it once the year is over", () => {
    const period = pl4Period(2025, SEPT)
    expect(period.from).toBe("2025-01-01T00:00:00.000Z")
    expect(period.to).toBe("2025-12-31T23:59:59.999Z")
    expect(period.periodEnd).toBe("2025-12-31T23:59:59.999Z")
    expect(period.complete).toBe(true)
    expect(period.label).toBe("Calendar year 2025")
  })

  it("clamps a still-running year to today and marks it incomplete", () => {
    const period = pl4Period(2026, SEPT)
    expect(period.to).toBe("2026-09-06T12:00:00.000Z")
    expect(period.periodEnd).toBe("2026-12-31T23:59:59.999Z")
    expect(period.complete).toBe(false)
  })

  it("defaults the export to the most recent COMPLETED calendar year", () => {
    expect(pl4DefaultYear(SEPT)).toBe(2025)
    expect(pl4DefaultYear(MARCH)).toBe(2025)
    expect(pl4Period(pl4DefaultYear(SEPT), SEPT).complete).toBe(true)
    expect(pl4Period(pl4DefaultYear(MARCH), MARCH).complete).toBe(true)
  })
})

describe("PL-4 CSV shaping", () => {
  const csv = pl4CsvRows([orgTotals({})], pl4Period(2025, SEPT), {
    generatedAt: "2026-09-06T12:00:00.000Z",
    currency: "USD",
    totals: {
      count: 2,
      grossMinor: 5_000,
      platformFeeMinor: 250,
      refundedMinor: 0,
      netMinor: 4_750,
    },
  })

  it("leads with a provenance block naming the period, its completeness and the source", () => {
    expect(csv[0]).toEqual(["civfix — CA AG Form PL-4 donation totals"])
    expect(csv[1]).toEqual(["Reporting period", "Calendar year 2025"])
    expect(csv[4]).toEqual(["Coverage end (UTC)", "2025-12-31T23:59:59.999Z"])
    expect(csv[5]).toEqual(["Period complete", "Yes"])
    expect(csv[7]).toEqual(["Donations included", 2])
    expect(csv[8]![1]).toContain("Server-computed")
    expect(JSON.stringify(csv)).not.toContain("PARTIAL")
  })

  it("states the timestamp the period is selected on and how refunds are attributed", () => {
    const basis = String(csv[9]![1])
    expect(basis).toContain("CREATION time")
    expect(basis).toContain("UTC")
    expect(basis).toContain("Refunds")
  })

  it("refuses to present a still-running year as a filed full year", () => {
    const interim = pl4CsvRows([orgTotals({})], pl4Period(2026, SEPT), {
      generatedAt: "2026-09-06T12:00:00.000Z",
      currency: "USD",
      totals: {
        count: 2,
        grossMinor: 5_000,
        platformFeeMinor: 250,
        refundedMinor: 0,
        netMinor: 4_750,
      },
    })
    expect(interim[4]).toEqual(["Coverage end (UTC)", "2026-09-06T12:00:00.000Z"])
    expect(String(interim[5]![1])).toContain("NO —")
    expect(String(interim[5]![1])).toContain("must not be filed")
  })

  it("writes decimal money, never minor units, and stamps the platform currency", () => {
    const body = csv[13]!
    expect(body[0]).toBe("Reach Out LA")
    expect(body[1]).toBe("o1")
    expect(body[2]).toBe("USD")
    expect(body[3]).toBe(2)
    expect(body[4]).toBe("50.00")
    expect(body[5]).toBe("2.50")
    expect(body[7]).toBe("47.50")
    expect(body[8]).toBe("2026-05-01T00:00:00.000Z")
  })

  it("closes with the server totals, not a re-sum of the listed rows", () => {
    const total = csv[csv.length - 1]!
    expect(total[0]).toBe("TOTAL")
    expect(total[3]).toBe(2)
    expect(total[4]).toBe("50.00")
    expect(total[7]).toBe("47.50")
  })

  it("carries an empty period as a header-only document", () => {
    const empty = pl4CsvRows([], pl4Period(2024, SEPT), {
      generatedAt: "2026-09-06T12:00:00.000Z",
      currency: "EUR",
      totals: {
        count: 0,
        grossMinor: 0,
        platformFeeMinor: 0,
        refundedMinor: 0,
        netMinor: 0,
      },
    })
    const total = empty[empty.length - 1]!
    expect(total[0]).toBe("TOTAL")
    expect(total[2]).toBe("EUR")
    expect(total[4]).toBe("0.00")
  })
})

describe("MNOS check log", () => {
  function row(over: Partial<AdminPaymentsEligibilityRowDTO>): AdminPaymentsEligibilityRowDTO {
    return {
      organizationId: "o1",
      orgName: "Reach Out LA",
      orgSlug: "reach-out-la",
      paymentsState: "ready",
      donationsEnabled: true,
      eligibility: { verdict: "eligible", reasons: [], checks: [] },
      ...over,
    }
  }

  it("keeps only CA AG MNOS evidence, newest first", () => {
    const entries = mnosCheckLog([
      row({
        eligibility: {
          verdict: "eligible",
          reasons: [],
          checks: [
            {
              source: "irs_pub78",
              sourceRevisionDate: "2026-08-01",
              matched: true,
              verdictContribution: "supports",
              checkedAt: "2026-09-05T00:00:00.000Z",
            },
            {
              source: "ca_ag_mnos",
              sourceRevisionDate: "2026-08-05",
              matched: false,
              verdictContribution: "neutral",
              checkedAt: "2026-09-02T00:00:00.000Z",
            },
          ],
        },
      }),
      row({
        organizationId: "o2",
        orgName: "Tree Fund",
        orgSlug: "tree-fund",
        eligibility: {
          verdict: "grace",
          reasons: [],
          checks: [
            {
              source: "ca_ag_mnos",
              sourceRevisionDate: "2026-09-02",
              matched: true,
              verdictContribution: "disqualifies",
              checkedAt: "2026-09-04T00:00:00.000Z",
            },
          ],
        },
      }),
    ])
    expect(entries.map((e) => e.orgName)).toEqual(["Tree Fund", "Reach Out LA"])
    expect(entries.every((e) => e.check.source === "ca_ag_mnos")).toBe(true)
  })
})
