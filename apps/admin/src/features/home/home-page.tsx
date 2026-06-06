"use client"

import * as React from "react"
import type {
  AdminEventListItemDTO,
  AdminReportListItemDTO,
  AdminUserListItemDTO,
  DiscoveryTaskDTO,
  HomeSummaryResponse,
  MailDirection,
  MailThreadListItemDTO,
  ReportCategory,
} from "@civfix/shared"
import { ADMIN_REPORT_STATUS_LABELS } from "@civfix/shared"
import type { UseQueryResult } from "@tanstack/react-query"

import { Icons, type IconComponent } from "@/components/icons"
import { LiveMap } from "@/components/map/live-map"
import { ActivityCard } from "@/features/home/activity-card"
import { SystemCard } from "@/features/home/system-card"
import { Spark } from "@/features/analytics/analytics-charts"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useHomeSummary } from "@/hooks/use-admin-home"
import { useDiscoveryList } from "@/features/discovery/use-discovery"
import { useReportList } from "@/features/reports/use-reports"
import { useEventList } from "@/features/events/use-events"
import { useMailList } from "@/features/mail/use-mail"
import { useUserList } from "@/features/users/use-users"
import { useNav, type PageId } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Home / dashboard hub (ported from pages-operations.jsx HomePage + HomeBento). The BENTO layout is the
 * shipped default (the prototype's triage/bands variants were a design-tool knob; we ship one).
 *
 * Data split (matches the prototype's launchpad interaction):
 *  - GET /admin/home/summary -> the per-section counts/leads + the analytics mini block (useHomeSummary).
 *  - The existing typed list endpoints -> the first few real entries previewed inside each non-analytics
 *    tile (listDiscovery / listAdminReports / listAdminEvents / listMail / listAdminUsers, fetched with a
 *    small limit). Each preview row deep-links straight into its section with that item preselected
 *    (nav(page, id)) - the design's openEntry -> nav(page, id).
 *  - GET /admin/home/map (LiveMap), GET /admin/activity (ActivityCard), GET /admin/system/health
 *    (SystemCard) - each independent so one failing card does not take down the rest (enumeration 2.A.6).
 *
 * The "... and N more {things}" footer renders an exact count where the summary carries a clean section
 * total (discovery -> queue); for reports / events / mail / users it shows "... and more {things}" when
 * the list page has further items (the home summary endpoint carries no list total for those and the
 * contract is frozen, so an exact remainder is not derivable without a contract change).
 */

const HUB_ICON: Record<string, IconComponent> = {
  discovery: Icons.Pin,
  reports: Icons.FileText,
  events: Icons.Calendar,
  mail: Icons.Mail,
  users: Icons.Users,
  analytics: Icons.BarChart,
}

/** How many preview rows each tile shows (the design previewed 3). */
const PREVIEW_ROWS = 3

interface SectionStat {
  k: string
  v: React.ReactNode
  tone?: "warn" | "alert" | null
}

/** A single preview row (the design's `.slr` item) with its leading glyph and deep-link target id. */
interface PeekItem {
  kind: "pin" | "icon" | "dir" | "avatar"
  /** pin: report category for the pin SVG. */
  cat?: ReportCategory
  /** icon: the Icons.* name + hue. */
  icon?: IconComponent
  hue?: string
  /** dir: inbound/outbound mail arrow. */
  dir?: MailDirection
  /** avatar: the name the initials are derived from. */
  name?: string
  title: string
  meta: string
  age: string
  /** The entry id to deep-link to inside the section. */
  focusId: string
}

interface SectionSummary {
  id: string
  page: PageId
  label: string
  hue: string
  lead: number
  unit: string
  blurb?: string
  stats: SectionStat[]
  cta: string
  /** analytics-only */
  spark?: number[]
  metrics?: { k: string; v: React.ReactNode; delta?: string }[]
}

/** Build the per-section summary view models from the aggregate home summary (buildSummaries port). */
function buildSummaries(d: HomeSummaryResponse): SectionSummary[] {
  return [
    {
      id: "discovery",
      page: "discovery",
      label: "Jurisdictions",
      hue: "slate",
      lead: d.discovery.queue,
      unit: "jurisdictions in queue",
      blurb:
        "Pins are landing in places we do not have a contact for yet. Research, save a contact, route the pin.",
      stats: [
        { k: "Reports waiting", v: d.discovery.reportsWaiting },
        { k: "Over SLA", v: d.discovery.overSla, tone: d.discovery.overSla > 0 ? "warn" : null },
      ],
      cta: "Open",
    },
    {
      id: "reports",
      page: "reports",
      label: "Reports",
      hue: "lilac",
      lead: d.reports.flagged,
      unit: "reports flagged",
      blurb:
        "Every report neighbors submit, routed to the right city department - track status and close the loop.",
      stats: [
        { k: "In progress", v: d.reports.inProgress },
        { k: "Completed", v: d.reports.completed },
      ],
      cta: "Open reports",
    },
    {
      id: "events",
      page: "events",
      label: "Events",
      hue: "sun",
      lead: d.events.upcoming,
      unit: "upcoming events",
      blurb:
        "Community cleanups neighbors organize - track turnout, keep them on the level, message attendees.",
      stats: [
        { k: "Live now", v: d.events.live },
        { k: "Attending", v: d.events.attending },
      ],
      cta: "Open events",
    },
    {
      id: "mail",
      page: "mail",
      label: "Mail",
      hue: "sky",
      lead: d.mail.unread,
      unit: "unread messages",
      blurb:
        "Two-way mail with municipal contacts - outbound routing and the replies that come back.",
      stats: [
        { k: "Needs action", v: d.mail.needsAction, tone: d.mail.needsAction > 0 ? "warn" : null },
        { k: "Bounce", v: `${d.mail.bounceRate}%` },
      ],
      cta: "Open inbox",
    },
    {
      id: "users",
      page: "users",
      label: "Users",
      hue: "sun",
      lead: d.users.flagged,
      unit: "accounts flagged",
      blurb: "Most neighbors never appear here. The queue surfaces the few who need a trust review.",
      stats: [
        { k: "High risk", v: d.users.highRisk, tone: d.users.highRisk > 0 ? "alert" : null },
        { k: "Suspended", v: d.users.suspended },
      ],
      cta: "Review accounts",
    },
    {
      id: "analytics",
      page: "analytics",
      label: "Analytics",
      hue: "moss",
      lead: d.analytics.pinsThisMonth,
      unit: "pins this month",
      blurb: "The numbers are the proof civfix works - dropped, routed, resolved, cleaned up.",
      stats: [{ k: "Cleanups", v: d.analytics.cleanups }],
      spark: d.analytics.pinsByWeek,
      metrics: [
        { k: "Resolved", v: `${d.analytics.resolvedPct}%` },
        { k: "Coverage", v: `${d.analytics.coveragePct}%` },
        { k: "Events", v: d.analytics.eventsThisMonth },
        { k: "Volunteers", v: d.analytics.volunteers },
      ],
      cta: "See analytics",
    },
  ]
}

function catPinSrc(category: ReportCategory): string | null {
  if (category === "other") return null
  return `/ds/pin-${category}.svg`
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// --- DTO -> preview row mappers (ported from buildSummaries' per-section `.list` maps) -------------

function discoveryRow(x: DiscoveryTaskDTO): PeekItem {
  return {
    kind: "pin",
    cat: x.category,
    title: x.place,
    meta: `${x.reports} reports - pop ${(x.pop / 1000).toFixed(0)}k`,
    age: x.age,
    focusId: x.id,
  }
}

function reportRow(r: AdminReportListItemDTO): PeekItem {
  return {
    kind: "pin",
    cat: r.category,
    title: r.title,
    meta: `${r.place} - ${ADMIN_REPORT_STATUS_LABELS[r.status]}`,
    age: r.submitted.rel,
    focusId: r.id,
  }
}

function eventRow(e: AdminEventListItemDTO): PeekItem {
  return {
    kind: "icon",
    icon: Icons.Calendar,
    hue: "sun",
    title: e.title,
    meta: `${e.place} - ${e.attendees} attending`,
    age: e.date.rel,
    focusId: e.id,
  }
}

function mailRow(t: MailThreadListItemDTO): PeekItem {
  return {
    kind: "dir",
    dir: t.dir,
    title: t.org,
    meta: t.subject,
    age: t.ts,
    focusId: t.id,
  }
}

function userRow(u: AdminUserListItemDTO): PeekItem {
  return {
    kind: "avatar",
    name: u.name,
    title: u.name,
    meta: u.flagReason ?? `${u.city} - ${u.trust}`,
    age: u.lastActive,
    focusId: u.id,
  }
}

/** Leading glyph for a preview row (ported from PeekGlyph): pin / icon / dir-arrow / avatar. */
function PeekGlyph({ item }: { item: PeekItem }) {
  if (item.kind === "pin") {
    const src = item.cat ? catPinSrc(item.cat) : null
    return (
      <span className="peek-pin">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" />
        ) : (
          <Icons.Layers size={13} />
        )}
      </span>
    )
  }
  if (item.kind === "icon") {
    const I = item.icon ?? Icons.Shield
    return (
      <span className={`peek-ico hue-${item.hue ?? "lilac"}`}>
        <I size={13} />
      </span>
    )
  }
  if (item.kind === "dir") {
    return (
      <span className={`peek-dir ${item.dir}`}>
        {item.dir === "in" ? <Icons.ArrowDown size={12} /> : <Icons.ArrowUp size={12} />}
      </span>
    )
  }
  return <span className="peek-av">{initials(item.name ?? "")}</span>
}

/** A clickable preview row that deep-links into the section with the item preselected. */
function PreviewRow({ item, page }: { item: PeekItem; page: PageId }) {
  const nav = useNav()
  const open = () => nav(page, item.focusId)
  return (
    <div
      className="slr"
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        open()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.stopPropagation()
          open()
        }
      }}
    >
      <PeekGlyph item={item} />
      <div className="slr-body">
        <div className="slr-title">{item.title}</div>
        <div className="slr-meta">{item.meta}</div>
      </div>
      <span className="slr-age">{item.age}</span>
      <span className="slr-arr">
        <Icons.ChevronRight size={13} />
      </span>
    </div>
  )
}

/** The narrowed query state a preview list needs (avoids UseQueryResult variance across response types). */
interface PreviewState {
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  /** Whether the list page reports further items beyond the preview (cursor or an extra fetched row). */
  hasMore: boolean
}

/** The preview list (loading / error / empty / rows) shown inside a non-analytics tile. */
function PreviewList({
  page,
  state,
  rows,
}: {
  page: PageId
  state: PreviewState
  rows: PeekItem[]
}) {
  if (state.isLoading) {
    return (
      <div className="stile-list">
        <LoadingState label="Loading..." />
      </div>
    )
  }
  if (state.isError) {
    return (
      <div className="stile-list">
        <ErrorState error={state.error} onRetry={state.onRetry} />
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="stile-list">
        <div className="slr-empty">Nothing here right now.</div>
      </div>
    )
  }
  return (
    <div className="stile-list">
      {rows.map((item) => (
        <PreviewRow key={item.focusId} item={item} page={page} />
      ))}
    </div>
  )
}

/**
 * The design's "... and N more {things}" foot label (moreOf port). Exact remainder when a clean section
 * total is known; "... and more {things}" when only the list-page cursor signals further items. Null
 * (no footer) when nothing is loaded yet, the list is empty, or there is no overflow.
 */
function computeMoreLabel(
  state: PreviewState,
  shown: number,
  thing: string,
  things: string,
  total?: number,
): string | null {
  if (state.isLoading || state.isError || shown === 0) return null
  if (total !== undefined) {
    const remaining = Math.max(0, total - shown)
    return remaining > 0 ? `... and ${remaining} more ${remaining === 1 ? thing : things}` : null
  }
  return state.hasMore ? `... and more ${things}` : null
}

/** A cursor-paged list response (the shape every admin list endpoint returns). */
interface ListPage<T> {
  items: T[]
  nextCursor: string | null
}

/** Build the narrowed PreviewState + whether more items exist from a list query result. */
function previewState<T>(query: UseQueryResult<ListPage<T>>, shown: number): PreviewState {
  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    onRetry: () => {
      void query.refetch()
    },
    hasMore: query.data?.nextCursor != null || (query.data?.items.length ?? 0) > shown,
  }
}

/**
 * Section tile used by the bento grid (ported from SectionTile). The analytics tile is the metric
 * variant (lead + spark + 2x2 metric grid + stats footer); every other tile shows the preview list +
 * the "... and N more" footer + the Open CTA.
 */
function SectionTile({
  s,
  feature,
  preview,
  moreLabel,
}: {
  s: SectionSummary
  feature?: boolean
  preview?: React.ReactNode
  /** The non-metric foot's "... and N more {things}" label, or null. */
  moreLabel?: string | null
}) {
  const nav = useNav()
  const Ico = HUB_ICON[s.id] ?? Icons.Layers
  const metric = s.id === "analytics"
  const open = () => nav(s.page)
  return (
    <div
      className={`stile hue-${s.hue} ${feature ? "feature" : ""}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") open()
      }}
    >
      <div className="stile-head">
        <span className="stile-ico">
          <Ico size={16} />
        </span>
        <span className="stile-label">{s.label}</span>
        {!metric && (
          <span className="stile-headcount">
            <b>{s.lead}</b> {s.unit}
          </span>
        )}
      </div>

      {metric ? (
        <>
          <div className="stile-metric">
            <div className="stile-lead">
              <span className="stile-num">{s.lead}</span>
              <span className="stile-unit">{s.unit}</span>
            </div>
            {s.spark && <Spark values={s.spark} hue={s.hue} />}
          </div>
          {s.metrics && (
            <div className="stile-metricgrid">
              {s.metrics.map((m) => (
                <div key={m.k} className="smg-cell">
                  <div className="smg-top">
                    <span className="smg-v">{m.v}</span>
                    {m.delta && (
                      <span className="smg-delta">
                        <Icons.ArrowUp size={9} />
                        {m.delta}
                      </span>
                    )}
                  </div>
                  <div className="smg-k">{m.k}</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {feature && s.blurb && <p className="stile-blurb">{s.blurb}</p>}
          {preview}
        </>
      )}

      <div
        className="stile-foot opens"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation()
          open()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.stopPropagation()
            open()
          }
        }}
      >
        {metric ? (
          <div className="stile-stats">
            {s.stats.map((st) => (
              <span key={st.k} className="stile-stat">
                <b className={st.tone || ""}>{st.v}</b> {st.k}
              </span>
            ))}
          </div>
        ) : (
          moreLabel && <span className="stile-moreinline">{moreLabel}</span>
        )}
        <span className="spacer-flex" />
        <span className="stile-cta">
          {metric ? s.cta : "Open"} <Icons.ArrowRight size={13} />
        </span>
      </div>
    </div>
  )
}

/** A fully-resolved non-analytics tile: its summary view model + preview rows + foot more-label. */
interface PreviewTile {
  id: string
  cell: string
  feature?: boolean
  s: SectionSummary
  state: PreviewState
  rows: PeekItem[]
  moreLabel: string | null
}

export function HomePage(_props: SectionPageProps) {
  const summaryQuery = useHomeSummary()

  // Preview rows from the real list endpoints (small page each). Each row's meta still surfaces the
  // flag reason when present (the design's `u.flagReason || ...`), so review-worthy accounts read clearly.
  const discoveryQuery = useDiscoveryList({ limit: PREVIEW_ROWS + 1 })
  const reportsQuery = useReportList({ limit: PREVIEW_ROWS + 1 })
  const eventsQuery = useEventList({ limit: PREVIEW_ROWS + 1 })
  const mailQuery = useMailList({ limit: PREVIEW_ROWS + 1 })
  const usersQuery = useUserList({ limit: PREVIEW_ROWS + 1 })

  const summaries = React.useMemo(
    () => (summaryQuery.data ? buildSummaries(summaryQuery.data) : []),
    [summaryQuery.data],
  )
  const byId = (id: string) => summaries.find((s) => s.id === id)
  const summary = summaryQuery.data

  // Resolve each non-analytics tile once (view model + rows + foot label). The bento renders them in the
  // design's order (discovery feature, analytics, mail, users, reports, events) with the map first.
  const analytics = byId("analytics")
  const previewTiles: PreviewTile[] = []
  const addTile = (
    id: string,
    cell: string,
    state: PreviewState,
    rows: PeekItem[],
    thing: string,
    things: string,
    opts?: { feature?: boolean; total?: number },
  ) => {
    const s = byId(id)
    if (!s) return
    previewTiles.push({
      id,
      cell,
      feature: opts?.feature,
      s,
      state,
      rows,
      moreLabel: computeMoreLabel(state, rows.length, thing, things, opts?.total),
    })
  }

  addTile(
    "discovery",
    "bt-discovery",
    previewState(discoveryQuery, PREVIEW_ROWS),
    (discoveryQuery.data?.items ?? []).slice(0, PREVIEW_ROWS).map(discoveryRow),
    "city",
    "cities",
    { feature: true, total: summary?.discovery.queue },
  )
  addTile(
    "mail",
    "bt-mail",
    previewState(mailQuery, PREVIEW_ROWS),
    (mailQuery.data?.items ?? []).slice(0, PREVIEW_ROWS).map(mailRow),
    "email",
    "emails",
  )
  addTile(
    "users",
    "bt-users",
    previewState(usersQuery, PREVIEW_ROWS),
    (usersQuery.data?.items ?? []).slice(0, PREVIEW_ROWS).map(userRow),
    "account",
    "accounts",
  )
  addTile(
    "reports",
    "bt-reports",
    previewState(reportsQuery, PREVIEW_ROWS),
    (reportsQuery.data?.items ?? []).slice(0, PREVIEW_ROWS).map(reportRow),
    "report",
    "reports",
  )
  addTile(
    "events",
    "bt-events",
    previewState(eventsQuery, PREVIEW_ROWS),
    (eventsQuery.data?.items ?? []).slice(0, PREVIEW_ROWS).map(eventRow),
    "event",
    "events",
  )

  const tile = (id: string) => previewTiles.find((t) => t.id === id)
  const renderTile = (t: PreviewTile | undefined) =>
    t ? (
      <div className={`bt-cell ${t.cell}`}>
        <SectionTile
          s={t.s}
          feature={t.feature}
          moreLabel={t.moreLabel}
          preview={<PreviewList page={t.s.page} state={t.state} rows={t.rows} />}
        />
      </div>
    ) : null

  return (
    <div className="hub">
      <div className="hub-bento">
        <div className="bt-cell bt-map">
          <LiveMap />
        </div>

        {summaryQuery.isLoading ? (
          <div className="bt-cell bt-discovery">
            <section className="card">
              <LoadingState label="Loading dashboard..." />
            </section>
          </div>
        ) : summaryQuery.isError ? (
          <div className="bt-cell bt-discovery">
            <section className="card">
              <ErrorState
                error={summaryQuery.error}
                onRetry={() => summaryQuery.refetch()}
                title="Could not load the dashboard"
              />
            </section>
          </div>
        ) : (
          <>
            {renderTile(tile("discovery"))}
            {analytics && (
              <div className="bt-cell bt-moderation">
                <SectionTile s={analytics} />
              </div>
            )}
            {renderTile(tile("mail"))}
            {renderTile(tile("users"))}
            {renderTile(tile("reports"))}
            {renderTile(tile("events"))}
          </>
        )}
      </div>

      {/* Recent activity + system health: real per-item data the aggregate summary does not carry. */}
      <div className="hub-aux">
        <ActivityCard />
        <SystemCard />
      </div>
    </div>
  )
}
