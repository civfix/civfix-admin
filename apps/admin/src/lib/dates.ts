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

// Date#toLocale*String with options builds a fresh Intl.DateTimeFormat on every call (about 18x the
// cost of reusing one), and these run once per row on every list render.
const MONTH_DAY_FORMAT = new Intl.DateTimeFormat(undefined, MONTH_DAY_PARTS)
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, DATE_PARTS)
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, DATE_TIME_PARTS)
const PRECISE_DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, PRECISE_DATE_TIME_PARTS)

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
  return formatWith(value, (date) => MONTH_DAY_FORMAT.format(date))
}

export function formatDate(value: string | null | undefined): string {
  return formatWith(value, (date) => DATE_FORMAT.format(date))
}

export function formatDateTime(value: string | null | undefined): string {
  return formatWith(value, (date) => DATE_TIME_FORMAT.format(date))
}

// Chat and mail timestamps keep seconds: operators order and match individual messages by them.
export function formatPreciseDateTime(value: string | null | undefined): string {
  return formatWith(value, (date) => PRECISE_DATE_TIME_FORMAT.format(date))
}
