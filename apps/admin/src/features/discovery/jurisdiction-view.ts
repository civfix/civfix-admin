import type {
  JurisdictionDirectoryDTO,
  JurisdictionLayer,
  PerCategoryCounts,
  ReportCategory,
} from "@civfix/shared"

import { REPORT_CATEGORIES, categoryLabel, categoryPinSrc, categoryReportTypes } from "@/lib/category"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { MINUTE_MS } from "@/lib/timing"

export const UNMAPPED_GEOID = "__unmapped__"

export type LayerChoice = "all" | JurisdictionLayer

export const LAYER_OPTIONS: readonly { value: JurisdictionLayer; label: string; plural: string }[] = [
  { value: "state", label: "State", plural: "States" },
  { value: "county", label: "County", plural: "Counties" },
  { value: "place", label: "City", plural: "Cities" },
  { value: "federal", label: "Federal land", plural: "Federal land" },
  { value: "tribal", label: "Tribal", plural: "Tribal" },
]

export const LAYER_LABEL = Object.fromEntries(
  LAYER_OPTIONS.map((option) => [option.value, option.label]),
) as Record<JurisdictionLayer, string>

export const REPORT_TYPES: { id: ReportCategory; label: string; pin: string; types: string }[] =
  REPORT_CATEGORIES.map((id) => ({
    id,
    label: categoryLabel(id),
    pin: categoryPinSrc(id),
    types: categoryReportTypes(id),
  }))

const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const DAYS_PER_WEEK = 7
const DAYS_PER_MONTH = 30
const DAYS_PER_YEAR = 365
const MONTHS_PER_YEAR = 12
const SHOW_WEEKS_FROM_DAYS = 14
const SHOW_MONTHS_FROM_WEEKS = 8
const OVERDUE_AFTER_MS = DAY_MS

const THOUSAND = 1000
const WHOLE_THOUSANDS_FROM = 10_000

export function routingCount(counts: PerCategoryCounts, id: ReportCategory): number {
  return counts[id] ?? 0
}

export function dominantCategory(counts: PerCategoryCounts): ReportCategory | null {
  let best: ReportCategory | null = null
  let bestCount = 0
  for (const category of REPORT_CATEGORIES) {
    const count = routingCount(counts, category)
    if (count > bestCount) {
      bestCount = count
      best = category
    }
  }
  return best
}

export function needsAttention(dto: JurisdictionDirectoryDTO): boolean {
  return dto.reportsWaiting > 0 && dto.method === "none"
}

export function formatRoutedDate(iso: string | null): string {
  if (!iso) return EMPTY_VALUE
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatWaitingAge(iso: string | null, now = Date.now()): string {
  if (!iso) return EMPTY_VALUE
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return EMPTY_VALUE
  const elapsed = now - then
  if (elapsed < MINUTE_MS) return "just now"
  const minutes = Math.floor(elapsed / MINUTE_MS)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(elapsed / HOUR_MS)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(elapsed / DAY_MS)
  if (days < SHOW_WEEKS_FROM_DAYS) return `${days}d`
  const weeks = Math.floor(days / DAYS_PER_WEEK)
  if (weeks < SHOW_MONTHS_FROM_WEEKS) return `${weeks}w`
  const months = Math.floor(days / DAYS_PER_MONTH)
  if (months < MONTHS_PER_YEAR) return `${months}mo`
  return `${Math.floor(days / DAYS_PER_YEAR)}y`
}

export function isOverdue(iso: string | null, now = Date.now()): boolean {
  if (!iso) return false
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return false
  return now - then > OVERDUE_AFTER_MS
}

export function formatPopulation(population: number): string {
  if (population >= THOUSAND) {
    return (population / THOUSAND).toFixed(population >= WHOLE_THOUSANDS_FROM ? 0 : 1) + "k"
  }
  return String(population)
}
