import {
  FilingRouteInputSchema,
  type FilingChannel,
  type FilingRouteDTO,
  type FilingRouteHealth,
  type FilingRouteInput,
  type ReportCategory,
} from "@civfix/contract"

import { validationFields } from "@/lib/api"
import { REPORT_CATEGORIES, categoryLabel } from "@/lib/category"
import { formatAgo } from "@/lib/dates"
import { errorMessage } from "@/lib/error-messages"

export type RouteRowKey = "default" | ReportCategory

/** "none" is a row with no saved route: Save routes leaves it out, which deletes any route it had. */
export type RouteChannelChoice = "none" | FilingChannel

export const CHANNEL_OPTIONS: readonly { value: RouteChannelChoice; label: string }[] = [
  { value: "none", label: "Not set" },
  { value: "email", label: "Email" },
  { value: "portal", label: "Portal" },
  { value: "manual", label: "Manual" },
]

export const ROUTES_FALLBACK_HINT =
  "A category without a route uses Default; with neither, the email contacts above; with no contact, reports go to Needs a human."

export interface RouteRow {
  key: RouteRowKey
  label: string
  channel: RouteChannelChoice
  /** Kept while the channel is not Portal, so switching back does not lose it; sent for Portal only. */
  formUrl: string
  requestTypeHint: string
  includeLink: boolean
  senders: string[]
  enabled: boolean
  /** Null for a row with no saved route. */
  health: FilingRouteHealth | null
}

export type RouteRowErrors = Partial<Record<RouteRowKey, string>>

const ROW_KEYS: readonly RouteRowKey[] = ["default", ...REPORT_CATEGORIES]

function rowKey(category: ReportCategory | null): RouteRowKey {
  return category ?? "default"
}

function blankRow(key: RouteRowKey): RouteRow {
  return {
    key,
    label: key === "default" ? "Default" : categoryLabel(key),
    channel: "none",
    formUrl: "",
    requestTypeHint: "",
    includeLink: true,
    senders: [],
    enabled: true,
    health: null,
  }
}

export function routeRows(routes: readonly FilingRouteDTO[]): RouteRow[] {
  const byKey = new Map(routes.map((route) => [rowKey(route.category), route]))
  return ROW_KEYS.map((key) => {
    const route = byKey.get(key)
    if (!route) return blankRow(key)
    return {
      ...blankRow(key),
      channel: route.channel,
      formUrl: route.formUrl ?? "",
      requestTypeHint: route.requestTypeHint ?? "",
      includeLink: route.includeLink,
      senders: [...route.statusSenderDomains],
      enabled: route.enabled,
      health: route.health,
    }
  })
}

/** A row switched to Portal starts from the jurisdiction's saved form URL unless one was typed. */
export function withChannel(
  row: RouteRow,
  channel: RouteChannelChoice,
  jurisdictionFormUrl: string | null,
): RouteRow {
  const prefill = channel === "portal" && row.formUrl.trim() === "" && jurisdictionFormUrl
  return { ...row, channel, formUrl: prefill ? jurisdictionFormUrl : row.formUrl }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function routeInput(row: RouteRow, channel: FilingChannel): unknown {
  const portal = channel === "portal"
  return {
    category: row.key === "default" ? null : row.key,
    channel,
    formUrl: portal ? emptyToNull(row.formUrl) : null,
    requestTypeHint: portal ? emptyToNull(row.requestTypeHint) : null,
    includeLink: row.includeLink,
    statusSenderDomains: row.senders,
    enabled: row.enabled,
  }
}

/**
 * The routes Save routes sends, parsed by the contract's own schema so a refusal shows on its row before
 * the request. `sentKeys[i]` is the row of `routes[i]`, which maps the API's `routes.<i>.` errors back.
 */
export function parseRows(rows: readonly RouteRow[]): {
  routes: FilingRouteInput[]
  sentKeys: RouteRowKey[]
  rowErrors: RouteRowErrors
} {
  const routes: FilingRouteInput[] = []
  const sentKeys: RouteRowKey[] = []
  const rowErrors: RouteRowErrors = {}
  for (const row of rows) {
    if (row.channel === "none") continue
    const parsed = FilingRouteInputSchema.safeParse(routeInput(row, row.channel))
    if (parsed.success) {
      routes.push(parsed.data)
      sentKeys.push(row.key)
    } else {
      rowErrors[row.key] = parsed.error.issues[0]!.message
    }
  }
  return { routes, sentKeys, rowErrors }
}

export type HealthPart = { label: string; at: string } | { label: string; value: string }

export function healthParts(health: FilingRouteHealth): HealthPart[] {
  const parts: HealthPart[] = []
  if (health.lastFiledAt !== null) parts.push({ label: "Last filed", at: health.lastFiledAt })
  if (health.lastFailedAt !== null) parts.push({ label: "Last failed", at: health.lastFailedAt })
  if (health.scriptVersion !== null) parts.push({ label: "script", value: health.scriptVersion })
  return parts
}

export const NEVER_USED = "Never used"

export const HEALTH_SEPARATOR = " · "

export function healthText(health: FilingRouteHealth, now: number): string {
  const parts = healthParts(health)
  if (parts.length === 0) return NEVER_USED
  return parts
    .map((part) => `${part.label} ${"at" in part ? formatAgo(part.at, now) : part.value}`)
    .join(HEALTH_SEPARATOR)
}

// The API keys a field error by its zod path joined with ".", so `routes.1.statusSenderDomains.0` is the
// second route sent, whichever row that was.
const ROUTE_FIELD_KEY = /^routes\.(\d+)(?:\.|$)/

/**
 * A VALIDATION error on a route lands on the row it was sent as. Anything that maps to no sent row, and
 * every other error, is shown once above Save routes.
 */
export function rowErrorsFromError(
  raw: unknown,
  sentKeys: readonly RouteRowKey[],
): { rows: RouteRowErrors; general: string | null } {
  const fields = validationFields(raw)
  if (!fields) return { rows: {}, general: errorMessage(raw) }
  const rows: RouteRowErrors = {}
  let unmapped = false
  for (const [field, message] of Object.entries(fields)) {
    const index = ROUTE_FIELD_KEY.exec(field)?.[1]
    const key = index === undefined ? undefined : sentKeys[Number(index)]
    if (key === undefined) unmapped = true
    else rows[key] ??= message
  }
  return { rows, general: unmapped ? errorMessage(raw) : null }
}
