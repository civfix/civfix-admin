import {
  REPORT_CATEGORY_LABELS,
  REPORT_TYPE_LABELS,
  REPORT_TYPE_TO_CATEGORY,
  REPORT_TYPE_VALUES,
  ReportCategorySchema,
  WEB_REPORT_TYPES,
  type ReportCategory,
} from "@civfix/shared"

export const REPORT_CATEGORIES: readonly ReportCategory[] = ReportCategorySchema.options

export const CATEGORY_GLYPHS: Record<ReportCategory, string> = {
  trash:
    "M9 6 L9 5 a1.5 1.5 0 0 1 1.5 -1.5 h3 a1.5 1.5 0 0 1 1.5 1.5 v1 M5 6 h14 M6 6 l1 12 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 l1 -12 M10 11 v5 M14 11 v5",
  recycling: "M12 4 L8 11 H16 L12 4 Z M5 13 L3 17 L7 19 M19 13 L21 17 L17 19 M8 20 H16",
  graffiti: "M4 14 v3 a2 2 0 0 0 2 2 h2 v-3 M4 14 l9 -9 a2.83 2.83 0 0 1 4 4 l-9 9 H4 v-4 Z",
  hazard: "M12 4 L2 20 H22 L12 4 Z M12 10 v4 M12 17 v0.5",
  encampment: "M3.5 21 L14 3 M20.5 21 L10 3 M15.5 21 L12 15 L8.5 21 M3.5 21 H20.5",
  water: "M12 3 C7 8 4 12 4 15 a8 8 0 0 0 16 0 c0 -3 -3 -7 -8 -12 Z",
  other:
    "M5 11 a1 1 0 1 0 0 2 a1 1 0 1 0 0 -2 M12 11 a1 1 0 1 0 0 2 a1 1 0 1 0 0 -2 M19 11 a1 1 0 1 0 0 2 a1 1 0 1 0 0 -2",
}

export function categoryCssVar(category: ReportCategory): string {
  return `var(--cat-${category})`
}

export function categoryPinSrc(category: ReportCategory): string {
  return `/ds/pin-${category}.svg`
}

export function categoryLabel(category: ReportCategory): string {
  return REPORT_CATEGORY_LABELS[category]
}

function buildCategoryReportTypeLabels(): Record<ReportCategory, string[]> {
  const byType = new Map<string, { category: ReportCategory; label: string }>()
  for (const type of REPORT_TYPE_VALUES) {
    byType.set(type, { category: REPORT_TYPE_TO_CATEGORY[type], label: REPORT_TYPE_LABELS[type] })
  }
  for (const webType of WEB_REPORT_TYPES) {
    byType.set(webType.id, { category: webType.category, label: webType.label })
  }
  const out = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c, [] as string[]])) as Record<
    ReportCategory,
    string[]
  >
  for (const { category, label } of byType.values()) {
    const bucket = out[category]
    if (bucket && !bucket.includes(label)) bucket.push(label)
  }
  return out
}

/**
 * What residents actually pick under each category, so an operator can judge a routing contact against
 * it. Keyed by report type, so the web picker's label replaces the contract's for the same type instead
 * of listing both.
 */
export const CATEGORY_REPORT_TYPE_LABELS: Record<ReportCategory, readonly string[]> =
  buildCategoryReportTypeLabels()

export function categoryReportTypes(category: ReportCategory): string {
  const labels = CATEGORY_REPORT_TYPE_LABELS[category]
  if (labels.length === 1 && labels[0] === REPORT_CATEGORY_LABELS[category]) return ""
  return labels.join(", ")
}
