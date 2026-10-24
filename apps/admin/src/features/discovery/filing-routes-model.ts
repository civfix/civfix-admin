import type { FilingChannel, FilingRouteDTO, FilingRouteHealth, FilingRouteInput, ReportCategory } from "@civfix/contract"

export type RouteRowKey = "default" | ReportCategory

export type RouteChannelChoice = "none" | FilingChannel

export interface RouteRow {
  key: RouteRowKey
  label: string
  channel: RouteChannelChoice
  formUrl: string
  requestTypeHint: string
  includeLink: boolean
  senders: string[]
  enabled: boolean
  health: FilingRouteHealth | null
}

export type RouteRowErrors = Partial<Record<RouteRowKey, string>>

export function routeRows(_routes: readonly FilingRouteDTO[]): RouteRow[] {
  throw new Error("not implemented")
}

export function withChannel(_row: RouteRow, _channel: RouteChannelChoice, _jurisdictionFormUrl: string | null): RouteRow {
  throw new Error("not implemented")
}

export function parseRows(_rows: readonly RouteRow[]): {
  routes: FilingRouteInput[]
  sentKeys: RouteRowKey[]
  rowErrors: RouteRowErrors
} {
  throw new Error("not implemented")
}

export function healthText(_health: FilingRouteHealth, _now: number): string {
  throw new Error("not implemented")
}

export function rowErrorsFromError(
  _raw: unknown,
  _sentKeys: readonly RouteRowKey[],
): { rows: RouteRowErrors; general: string | null } {
  throw new Error("not implemented")
}
