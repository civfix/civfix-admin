"use client"

import * as React from "react"
import type { HomeSummaryResponse } from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { LiveMap } from "@/components/map/live-map"
import { ActivityCard } from "@/features/home/activity-card"
import { SystemCard } from "@/features/home/system-card"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useHomeSummary } from "@/hooks/use-admin-home"
import { useNav, type PageId } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Home / dashboard hub (ported from pages-operations.jsx HomePage). The BENTO layout is the shipped
 * default (the prototype's triage/bands variants were a design-tool knob; we ship one). The hub reads
 * GET /admin/home/summary for the per-section counts/leads, GET /admin/home/map (LiveMap), GET
 * /admin/activity (activity feed), and GET /admin/system/health - each with its own loading/error
 * state so one failing card does not take down the rest (enumeration 2.A.6).
 *
 * Difference from the prototype: the summary endpoint returns AGGREGATES (counts), not full section
 * lists, so each tile renders its lead + stats + CTA rather than a 3-row item preview (the prototype
 * built those previews by reading all six section lists client-side, which the aggregate endpoint
 * intentionally avoids). The "Recent activity" card carries the real per-item feed.
 */

const HUB_ICON: Record<string, IconComponent> = {
  discovery: Icons.Pin,
  reports: Icons.FileText,
  events: Icons.Calendar,
  mail: Icons.Mail,
  users: Icons.Users,
  analytics: Icons.BarChart,
}

interface SectionStat {
  k: string
  v: React.ReactNode
  tone?: "warn" | "alert" | null
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

/** Sparkline (ported from pages-operations.jsx Spark). */
function Spark({ values, hue }: { values: number[]; hue: string }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  return (
    <div className="hub-spark">
      {values.map((v, i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={`hub-spark-bar ${i === values.length - 1 ? "now" : ""}`}
          style={
            {
              height: `${10 + ((v - min) / (max - min || 1)) * 88}%`,
              "--sh": `var(--${hue})`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** Section tile used by the bento grid (ported from SectionTile). */
function SectionTile({ s, feature }: { s: SectionSummary; feature?: boolean }) {
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
        feature && s.blurb && <p className="stile-blurb">{s.blurb}</p>
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
        <div className="stile-stats">
          {s.stats.map((st) => (
            <span key={st.k} className="stile-stat">
              <b className={st.tone || ""}>{st.v}</b> {st.k}
            </span>
          ))}
        </div>
        <span className="spacer-flex" />
        <span className="stile-cta">
          {s.cta} <Icons.ArrowRight size={13} />
        </span>
      </div>
    </div>
  )
}

export function HomePage(_props: SectionPageProps) {
  const summaryQuery = useHomeSummary()

  const summaries = React.useMemo(
    () => (summaryQuery.data ? buildSummaries(summaryQuery.data) : []),
    [summaryQuery.data],
  )
  const byId = (id: string) => summaries.find((s) => s.id === id)

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
            {byId("discovery") && (
              <div className="bt-cell bt-discovery">
                <SectionTile s={byId("discovery")!} feature />
              </div>
            )}
            {byId("analytics") && (
              <div className="bt-cell bt-moderation">
                <SectionTile s={byId("analytics")!} />
              </div>
            )}
            {byId("mail") && (
              <div className="bt-cell bt-mail">
                <SectionTile s={byId("mail")!} />
              </div>
            )}
            {byId("users") && (
              <div className="bt-cell bt-users">
                <SectionTile s={byId("users")!} />
              </div>
            )}
            {byId("reports") && (
              <div className="bt-cell bt-reports">
                <SectionTile s={byId("reports")!} />
              </div>
            )}
            {byId("events") && (
              <div className="bt-cell bt-events">
                <SectionTile s={byId("events")!} />
              </div>
            )}
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
