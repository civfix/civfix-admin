import {
  ErrorCode,
  MAX_EVENT_HOURS,
  MIN_EVENT_HOURS,
  SERVICE_DATE_MIN,
  formatCertificateCode,
  type AdminCreditUserHoursRequest,
  type AdminUserDTO,
  type AdminUserHoursEntryDTO,
  type AdminVoidUserHoursResponse,
} from "@civfix/shared"

import { toAppError } from "@/lib/api"
import { formatDate } from "@/lib/dates"
import { errorMessage } from "@/lib/error-messages"

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

export type CreditKind = AdminCreditUserHoursRequest["kind"]

/** An event as the credit form shows it: `when` is the list row's absolute date label. */
export interface PickedEvent {
  id: string
  title: string
  place: string
  when: string
}

/**
 * The credit form's state. The event and the service date are both kept while the operator switches
 * kinds, so toggling back does not lose a pick; only the fields of the chosen kind are validated and sent.
 */
export interface CreditHoursDraft {
  kind: CreditKind
  event: PickedEvent | null
  hours: string
  serviceDate: string
  reason: string
}

export type CreditHoursField = "event" | "hours" | "serviceDate" | "reason"
export type CreditHoursErrors = Partial<Record<CreditHoursField | "form", string>>

/**
 * The service date bound for a manual credit, as the operator's own calendar reads it. The server
 * checks the same bound against the platform's time zone and reports a disagreement on `serviceDate`.
 */
export function todayLocalIsoDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function hoursDraftError(hours: string): string | null {
  const text = hours.trim()
  if (text === "") return "Enter the hours to credit."
  const value = Number(text)
  if (!Number.isFinite(value) || value < MIN_EVENT_HOURS || value > MAX_EVENT_HOURS) {
    return `Enter between ${MIN_EVENT_HOURS} and ${MAX_EVENT_HOURS} hours.`
  }
  return null
}

export function serviceDateDraftError(serviceDate: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return "Pick the date of service."
  if (serviceDate > today) return "The date of service can't be in the future."
  if (serviceDate < SERVICE_DATE_MIN) {
    return `The date of service must be on or after ${formatServiceDate(SERVICE_DATE_MIN)}.`
  }
  return null
}

export function creditDraftErrors(draft: CreditHoursDraft, today: string): CreditHoursErrors {
  const errors: CreditHoursErrors = {}
  if (draft.kind === "event" && draft.event === null) errors.event = "Pick the event to credit."
  const hours = hoursDraftError(draft.hours)
  if (hours) errors.hours = hours
  if (draft.kind === "manual") {
    const date = serviceDateDraftError(draft.serviceDate, today)
    if (date) errors.serviceDate = date
  }
  if (draft.reason.trim() === "") errors.reason = "A reason is required."
  return errors
}

/** The exact union member for the draft's kind, or null while the draft has any error. */
export function buildCreditRequest(
  userId: string,
  draft: CreditHoursDraft,
  today: string,
): AdminCreditUserHoursRequest | null {
  if (Object.keys(creditDraftErrors(draft, today)).length > 0) return null
  const hours = Number(draft.hours.trim())
  const reason = draft.reason.trim()
  if (draft.kind === "manual") {
    return { id: userId, kind: "manual", hours, serviceDate: draft.serviceDate, reason }
  }
  if (draft.event === null) return null
  return { id: userId, kind: "event", eventId: draft.event.id, hours, reason }
}

/** The server refuses both targets (DECISIONS §58); the form says so up front instead. */
export function creditBlockedReason(user: Pick<AdminUserDTO, "deletedAt" | "role">): string | null {
  if (user.deletedAt) return "Hours can't be credited to a deleted account."
  if (user.role === "operator") return "Hours can't be credited to an operator account."
  return null
}

export function creditConfirmTitle(
  userName: string,
  request: AdminCreditUserHoursRequest,
  eventTitle: string | null,
): string {
  const hours = formatHours(request.hours)
  if (request.kind === "event") return `Credit ${hours} h to ${userName} for ${eventTitle ?? "this event"}?`
  return `Credit ${hours} h to ${userName} as a manual adjustment for ${formatServiceDate(request.serviceDate)}?`
}

export function creditConfirmBody(userName: string, kind: CreditKind): string {
  const effect =
    kind === "event"
      ? "The hours count as if the host had logged them: on the event, in the organization's totals and on the leaderboard."
      : "A manual adjustment counts toward the neighbor's total but toward no jurisdiction's leaderboard."
  return `${effect} ${userName} is notified and sees CivFix as the creditor. Your reason stays on the admin side.`
}

export function creditedToast(userName: string, hours: number): string {
  return `${userName} · +${formatHours(hours)} h`
}

function sentence(message: string): string {
  return message.charAt(0).toUpperCase() + message.slice(1)
}

const CREDIT_FIELD_BY_KEY = new Map<string, CreditHoursField>([
  ["eventId", "event"],
  ["hours", "hours"],
  ["serviceDate", "serviceDate"],
  ["reason", "reason"],
])

/**
 * Every failed credit renders in the form: a VALIDATION error's `fields` land under the matching field
 * (the event window cap arrives on `hours`, a future date in the server's time zone on `serviceDate`),
 * and anything else — a live entry already on the event, the daily cap, a refused target, a field this
 * form has no input for — on the form, so no refusal is left unshown.
 */
export function creditServerErrors(err: unknown): CreditHoursErrors {
  const e = toAppError(err)
  const out: CreditHoursErrors = {}
  let unmapped = e.code !== ErrorCode.VALIDATION || !e.fields
  for (const [key, message] of Object.entries(e.fields ?? {})) {
    const field = CREDIT_FIELD_BY_KEY.get(key)
    if (field) out[field] = sentence(message)
    else unmapped = true
  }
  if (!unmapped && Object.keys(out).length > 0) return out
  return {
    ...out,
    form: errorMessage(
      err,
      {
        [ErrorCode.VALIDATION]: "The server refused these values. Check each field and try again.",
        [ErrorCode.RATE_LIMITED]: "Too many credits in a short time. Wait a minute and try again.",
      },
      { fallback: "The hours could not be credited. Please try again." },
    ),
  }
}
