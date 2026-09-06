import type {
  AdminDonationOrgTotalsDTO,
  AdminDonationTotalsByOrgResponse,
  AdminPaymentsEligibilityRowDTO,
  OrgEligibilityCheckDTO,
} from "@civfix/shared"

import type { CsvCell } from "@/lib/csv"
import { moneyMinorToDecimalString } from "@/lib/money"

export const PL2_RENEWAL = { month: 0, day: 15, label: "Form PL-2 renewal" } as const
export const PL4_REPORT = { month: 6, day: 15, label: "Form PL-4 annual report" } as const

const DAY_MS = 24 * 60 * 60 * 1000

function toDate(now: Date | number): Date {
  return now instanceof Date ? new Date(now.getTime()) : new Date(now)
}

export function nextFilingDate(month: number, day: number, now: Date | number = Date.now()): Date {
  const ref = toDate(now)
  const year = ref.getUTCFullYear()
  const thisYear = Date.UTC(year, month, day)
  return new Date(thisYear >= Date.UTC(year, ref.getUTCMonth(), ref.getUTCDate())
    ? thisYear
    : Date.UTC(year + 1, month, day))
}

export function daysUntil(target: Date, now: Date | number = Date.now()): number {
  const ref = toDate(now)
  const today = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate())
  return Math.round((target.getTime() - today) / DAY_MS)
}

export interface FilingReminder {
  id: "pl2" | "pl4"
  label: string
  dueOn: string
  daysRemaining: number
  covers: string
}

export function pl4ReportingYear(now: Date | number = Date.now()): number {
  return nextFilingDate(PL4_REPORT.month, PL4_REPORT.day, now).getUTCFullYear() - 1
}

export function filingReminders(now: Date | number = Date.now()): FilingReminder[] {
  const pl2Due = nextFilingDate(PL2_RENEWAL.month, PL2_RENEWAL.day, now)
  const pl4Due = nextFilingDate(PL4_REPORT.month, PL4_REPORT.day, now)
  return [
    {
      id: "pl2",
      label: PL2_RENEWAL.label,
      dueOn: pl2Due.toISOString().slice(0, 10),
      daysRemaining: daysUntil(pl2Due, now),
      covers: `Registration year ${pl2Due.getUTCFullYear()}`,
    },
    {
      id: "pl4",
      label: PL4_REPORT.label,
      dueOn: pl4Due.toISOString().slice(0, 10),
      daysRemaining: daysUntil(pl4Due, now),
      covers: `Calendar year ${pl4Due.getUTCFullYear() - 1}`,
    },
  ]
}

export interface ReportingPeriod {
  year: number
  from: string
  to: string
  periodEnd: string
  complete: boolean
  label: string
}

export function pl4Period(year: number, now: Date | number = Date.now()): ReportingPeriod {
  const nowMs = now instanceof Date ? now.getTime() : now
  const periodEnd = Date.UTC(year, 11, 31, 23, 59, 59, 999)
  const complete = periodEnd <= nowMs
  return {
    year,
    from: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString(),
    to: new Date(complete ? periodEnd : nowMs).toISOString(),
    periodEnd: new Date(periodEnd).toISOString(),
    complete,
    label: `Calendar year ${year}`,
  }
}

export function pl4PeriodYears(now: Date | number = Date.now(), count = 3): number[] {
  const latest = pl4ReportingYear(now)
  return Array.from({ length: count }, (_, i) => latest - i)
}

export function pl4DefaultYear(now: Date | number = Date.now()): number {
  const ref = now instanceof Date ? new Date(now.getTime()) : new Date(now)
  return Math.min(pl4ReportingYear(now), ref.getUTCFullYear() - 1)
}

export interface Pl4ExportMeta {
  generatedAt: string
  currency: string
  totals: AdminDonationTotalsByOrgResponse["totals"]
}

export function pl4CsvRows(
  rows: readonly AdminDonationOrgTotalsDTO[],
  period: ReportingPeriod,
  meta: Pl4ExportMeta,
): CsvCell[][] {
  const out: CsvCell[][] = [
    ["civfix — CA AG Form PL-4 donation totals"],
    ["Reporting period", period.label],
    ["Period start (UTC)", period.from],
    ["Period end (UTC)", period.periodEnd],
    ["Coverage end (UTC)", period.to],
    [
      "Period complete",
      period.complete
        ? "Yes"
        : "NO — the calendar year is still running. These are interim totals through the coverage end and must not be filed as a full-year report.",
    ],
    ["Generated at", meta.generatedAt],
    ["Donations included", meta.totals.count],
    [
      "Source",
      "Server-computed totals for the whole coverage window; no client-side aggregation over paged rows.",
    ],
    [
      "Period basis",
      "A donation belongs to the period by its CREATION time, in UTC, not in California local time; the first and last charge columns are charge times. Refunds are attributed to the donation's period, so re-exporting a closed year after a later refund yields a smaller net.",
    ],
    [
      "Basis",
      "Succeeded, refunded and partially refunded donations. Amounts are minor units divided by 100. Processing fees are charged by Stripe to the recipient organization and are not visible to civfix.",
    ],
    [],
    [
      "Organization",
      "Organization ID",
      "Currency",
      "Donations",
      "Gross",
      "civfix platform fee",
      "Refunded",
      "Net of civfix fee and refunds",
      "First charge",
      "Last charge",
    ],
  ]
  for (const row of rows) {
    out.push([
      row.orgName,
      row.organizationId,
      meta.currency,
      row.count,
      moneyMinorToDecimalString(row.grossMinor),
      moneyMinorToDecimalString(row.platformFeeMinor),
      moneyMinorToDecimalString(row.refundedMinor),
      moneyMinorToDecimalString(row.netMinor),
      row.firstChargedAt ?? "",
      row.lastChargedAt ?? "",
    ])
  }
  out.push([
    "TOTAL",
    "",
    meta.currency,
    meta.totals.count,
    moneyMinorToDecimalString(meta.totals.grossMinor),
    moneyMinorToDecimalString(meta.totals.platformFeeMinor),
    moneyMinorToDecimalString(meta.totals.refundedMinor),
    moneyMinorToDecimalString(meta.totals.netMinor),
    "",
    "",
  ])
  return out
}

export interface MnosLogEntry {
  organizationId: string
  orgName: string
  orgSlug: string
  check: OrgEligibilityCheckDTO
}

export function mnosCheckLog(
  rows: readonly AdminPaymentsEligibilityRowDTO[],
): MnosLogEntry[] {
  const entries: MnosLogEntry[] = []
  for (const row of rows) {
    for (const check of row.eligibility.checks) {
      if (check.source !== "ca_ag_mnos") continue
      entries.push({
        organizationId: row.organizationId,
        orgName: row.orgName,
        orgSlug: row.orgSlug,
        check,
      })
    }
  }
  return entries.sort((a, b) => {
    const byTime = Date.parse(b.check.checkedAt) - Date.parse(a.check.checkedAt)
    if (byTime !== 0 && !Number.isNaN(byTime)) return byTime
    return a.orgName.localeCompare(b.orgName)
  })
}
