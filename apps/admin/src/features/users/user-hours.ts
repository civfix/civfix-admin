import {
  formatCertificateCode,
  type AdminUserHoursEntryDTO,
  type AdminVoidUserHoursResponse,
} from "@civfix/shared"

import { formatDate } from "@/lib/dates"

type AffectedCertificate = AdminVoidUserHoursResponse["affectedCertificates"][number]

/**
 * The backend's operator CLI (`services/api/scripts/revoke-certificate.ts`). The console never revokes a
 * certificate itself (DECISIONS §58), so the void dialog names the command instead.
 */
export const REVOKE_CERTIFICATE_COMMAND =
  "pnpm --filter @civfix/api db:certificate:revoke <code> --reason ledger_corrected"

export function formatHours(hours: number): string {
  return hours.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function hoursEntryTitle(entry: AdminUserHoursEntryDTO): string {
  if (entry.source === "manual") return "Manual adjustment"
  if (entry.source === "report") return "Report credit (retired)"
  return entry.event?.title ?? "Event credit"
}

/**
 * A service date is a calendar day with no zone. Read as local noon, because `new Date("YYYY-MM-DD")`
 * is UTC midnight and would print the previous day west of Greenwich.
 */
export function formatServiceDate(serviceDate: string): string {
  return formatDate(`${serviceDate}T12:00:00`)
}

export function hoursEntryDate(entry: AdminUserHoursEntryDTO): string {
  if (entry.source === "manual" && entry.serviceDate) return formatServiceDate(entry.serviceDate)
  return formatDate(entry.occurredAt)
}

export function hoursEntryCreditor(entry: AdminUserHoursEntryDTO): string | null {
  const { creditedBy, operator } = entry
  if (!creditedBy) return null
  if (!creditedBy.official) return `Credited by ${creditedBy.name}`
  return operator ? `Credited by CivFix · ${operator.name}` : "Credited by CivFix"
}

export function hoursEntryMeta(entry: AdminUserHoursEntryDTO): string[] {
  const jurisdiction = entry.jurisdiction ? (entry.jurisdiction.name ?? entry.jurisdiction.geoid) : null
  return [hoursEntryDate(entry), jurisdiction, hoursEntryCreditor(entry)].filter(
    (part): part is string => part !== null,
  )
}

/** Rows voided by a migration (the retired report credits) carry neither an operator nor a reason. */
export function hoursEntryVoidDetail(entry: AdminUserHoursEntryDTO): string | null {
  if (!entry.voidedAt) return null
  if (entry.voidedBy && entry.voidReason) return `by ${entry.voidedBy.name}: ${entry.voidReason}`
  if (entry.voidedBy) return `by ${entry.voidedBy.name}`
  return entry.voidReason
}

export function voidedToast(userName: string, hours: number): string {
  return `${userName} · ${formatHours(hours)} h voided`
}

export function affectedCertificateLine(certificate: AffectedCertificate): string {
  return `${formatCertificateCode(certificate.code)} · issued ${formatDate(certificate.issuedAt)}`
}
