import { preciseDateTimeTitle } from "@/lib/dates"

export const NOT_SET = "Not set"

const MINUTE_S = 60
const HOUR_S = 60 * MINUTE_S
const DAY_S = 24 * HOUR_S

/** "45s", "3m 20s", "2h 5m"; hours keep counting past a day, so a stuck queue reads as one number. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds < MINUTE_S) return `${seconds}s`
  if (seconds < HOUR_S) return `${Math.floor(seconds / MINUTE_S)}m ${seconds % MINUTE_S}s`
  return `${Math.floor(seconds / HOUR_S)}h ${Math.floor((seconds % HOUR_S) / MINUTE_S)}m`
}

function formatAgo(value: string, now: number): string {
  // A server clock slightly ahead of this one must not read as a time in the future.
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000))
  if (seconds < MINUTE_S) return "Just now"
  if (seconds < HOUR_S) return `${Math.floor(seconds / MINUTE_S)} min ago`
  if (seconds < DAY_S) return `${Math.floor(seconds / HOUR_S)} hr ago`
  const days = Math.floor(seconds / DAY_S)
  return days === 1 ? "1 day ago" : `${days} days ago`
}

/** `geo_coder` reads "Geo coder". */
export function seamLabel(name: string): string {
  const words = name.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function Ago({ value, now }: { value: string; now: number }) {
  return (
    <time dateTime={value} title={preciseDateTimeTitle(value)}>
      {formatAgo(value, now)}
    </time>
  )
}
