import { EMPTY_VALUE } from "./empty-value"

const MONTH_DAY_PARTS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
const DATE_PARTS: Intl.DateTimeFormatOptions = { ...MONTH_DAY_PARTS, year: "numeric" }
const DATE_TIME_PARTS: Intl.DateTimeFormatOptions = {
  ...DATE_PARTS,
  hour: "numeric",
  minute: "2-digit",
}
const PRECISE_DATE_TIME_PARTS: Intl.DateTimeFormatOptions = {
  ...DATE_TIME_PARTS,
  second: "2-digit",
}

// An unparseable value is shown as sent rather than hidden, so an operator still sees what arrived.
function formatWith(
  value: string | null | undefined,
  format: (date: Date) => string,
): string {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date)
}

export function formatMonthDay(value: string | null | undefined): string {
  return formatWith(value, (date) => date.toLocaleDateString(undefined, MONTH_DAY_PARTS))
}

export function formatDate(value: string | null | undefined): string {
  return formatWith(value, (date) => date.toLocaleDateString(undefined, DATE_PARTS))
}

export function formatDateTime(value: string | null | undefined): string {
  return formatWith(value, (date) => date.toLocaleString(undefined, DATE_TIME_PARTS))
}

// Chat and mail timestamps keep seconds: operators order and match individual messages by them.
export function formatPreciseDateTime(value: string | null | undefined): string {
  return formatWith(value, (date) => date.toLocaleString(undefined, PRECISE_DATE_TIME_PARTS))
}
