import { EMPTY_VALUE } from "./empty-value"

const DATE_PARTS: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
const DATE_TIME_PARTS: Intl.DateTimeFormatOptions = {
  ...DATE_PARTS,
  hour: "numeric",
  minute: "2-digit",
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

export function formatDate(value: string | null | undefined): string {
  return formatWith(value, (date) => date.toLocaleDateString(undefined, DATE_PARTS))
}

export function formatDateTime(value: string | null | undefined): string {
  return formatWith(value, (date) => date.toLocaleString(undefined, DATE_TIME_PARTS))
}
