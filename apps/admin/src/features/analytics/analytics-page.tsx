"use client"

import * as React from "react"
import {
  REPORT_CATEGORY_LABELS,
  type AnalyticsEventsResponse,
  type AnalyticsKpisResponse,
  type ReportCategory,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { BarChart } from "@/features/analytics/analytics-charts"
import {
  useAnalyticsByCategory,
  useAnalyticsCoverage,
  useAnalyticsEvents,
  useAnalyticsFunnel,
  useAnalyticsKpis,
  useAnalyticsPinsByWeek,
  useAnalyticsResolutionByCategory,
  useAnalyticsTopContributors,
  useAnalyticsTopJurisdictions,
} from "@/features/analytics/use-analytics"
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Analytics (ported from pages-misc.jsx AnalyticsPage, enumeration 2.G). Layout: PageHead + a
 * client-side CSV Export, a KPI strip (analyticsKpis + the events thisMonth/volunteers cells), and the
 * analytics card grid. Each card is an INDEPENDENT read with its own loading / error / empty state so
 * one failing aggregate does not blank the page (enumeration 2.A.6). The eight prototype cards render in
 * the same design language.
 *
 * Reconciliation: by-category / resolution-by-category use the 6 canonical civfix categories
 * (REPORT_CATEGORY_LABELS); the design's "cleanup" is the Events domain, not a report category. Category
 * bar colors come from the ported `--cat-*` CSS vars (no hardcoded hex); "other" has no dedicated var so
 * it uses the tertiary ink (the design's warm gray).
 */

/** Bar color per civfix report category, from the ported design-system CSS vars (no hardcoded hex). */
const CAT_COLOR: Record<ReportCategory, string> = {
  trash: "var(--cat-trash)",
  recycling: "var(--cat-recycling)",
  graffiti: "var(--cat-graffiti)",
  hazard: "var(--cat-hazard)",
  water: "var(--cat-water)",
  other: "var(--ink-3)",
}

/** Initials for a contributor avatar (first two words). */
function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/**
 * A card wrapper that owns its title + meta and renders the matching loading / error / empty state for
 * its query, so each analytics aggregate fails independently. `isEmpty` decides the empty state; the
 * children render once data is present.
 */
function AnalyticsCard<T>({
  title,
  meta,
  query,
  isEmpty,
  span2 = false,
  pad = true,
  children,
}: {
  title: string
  meta: string
  query: {
    isLoading: boolean
    isError: boolean
    error: unknown
    data: T | undefined
    refetch: () => void
  }
  isEmpty?: (data: T) => boolean
  span2?: boolean
  pad?: boolean
  children: (data: T) => React.ReactNode
}) {
  let inner: React.ReactNode
  if (query.isLoading) {
    inner = <LoadingState label={`Loading ${title.toLowerCase()}...`} />
  } else if (query.isError) {
    inner = <ErrorState error={query.error} onRetry={() => query.refetch()} />
  } else if (!query.data || (isEmpty && isEmpty(query.data))) {
    inner = <EmptyState title="No data yet" sub="Nothing to show for this window." />
  } else {
    inner = children(query.data)
  }

  return (
    <section className={`card ${span2 ? "span-2" : ""}`}>
      <div className="card-head">
        <h3>{title}</h3>
        <div className="spacer" />
        <span className="meta">{meta}</span>
      </div>
      {pad ? <div className="card-pad">{inner}</div> : inner}
    </section>
  )
}

/**
 * Month-over-month change of a monthly series (the last two points), or null when there is no prior
 * month to compare against. Drives the up/down delta arrow on the events KPI cell from real data
 * instead of a hardcoded placeholder.
 */
function monthOverMonth(series: number[]): { delta: string; dir: "up" | "down" | "flat" } | null {
  if (series.length < 2) return null
  const last = series[series.length - 1] ?? 0
  const prev = series[series.length - 2] ?? 0
  const diff = last - prev
  const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat"
  return { delta: `${diff > 0 ? "+" : ""}${diff}`, dir }
}

/** A KPI delta caption (the design's up/down arrow + delta, moss-tinted). */
function KpiDelta({ delta, dir }: { delta: string; dir: "up" | "down" | "flat" }) {
  return (
    <div className="statcell-hot" style={{ color: "var(--moss-700)" }}>
      {dir === "down" ? <Icons.ArrowDown size={10} /> : <Icons.ArrowUp size={10} />} {delta}
    </div>
  )
}

/** The KPI strip: analyticsKpis (route-time hidden) plus the two events cells. */
function KpiStrip({
  kpis,
  events,
}: {
  kpis: AnalyticsKpisResponse
  events: AnalyticsEventsResponse | undefined
}) {
  // Real month-over-month delta for the events cell (from the byMonth series); volunteers carries no
  // monthly history in the contract, so its cell keeps a static caption rather than a fabricated delta.
  const eventsDelta = events ? monthOverMonth(events.byMonth) : null
  return (
    <>
      {kpis.kpis
        .filter((k) => !/route/i.test(k.label))
        .map((k) => (
          <div key={k.label} className="statcell">
            <div className="statcell-label">{k.label}</div>
            <div className="statcell-num">
              {/* The Resolved KPI is a percentage; the contract carries the bare number, so re-append
                  the "%" at render time to match the design's "89%" (count KPIs stay bare). */}
              {k.num.toLocaleString()}
              {/resolved/i.test(k.label) ? "%" : ""}
            </div>
            <KpiDelta delta={k.delta} dir={k.dir} />
          </div>
        ))}
      <div className="statcell">
        <div className="statcell-label">Cleanup events</div>
        <div className="statcell-num">{events ? events.thisMonth : "-"}</div>
        {eventsDelta ? (
          <KpiDelta delta={eventsDelta.delta} dir={eventsDelta.dir} />
        ) : (
          <div className="statcell-hot" style={{ color: "var(--moss-700)" }}>
            this month
          </div>
        )}
      </div>
      <div className="statcell">
        <div className="statcell-label">Volunteers</div>
        <div className="statcell-num">{events ? events.volunteers.toLocaleString() : "-"}</div>
        <div className="statcell-hot" style={{ color: "var(--moss-700)" }}>
          all cleanups
        </div>
      </div>
    </>
  )
}

export function AnalyticsPage(_props: SectionPageProps) {
  const toast = useToast()

  const kpisQuery = useAnalyticsKpis()
  const pinsQuery = useAnalyticsPinsByWeek()
  const byCategoryQuery = useAnalyticsByCategory()
  const funnelQuery = useAnalyticsFunnel()
  const coverageQuery = useAnalyticsCoverage()
  const resolutionQuery = useAnalyticsResolutionByCategory()
  const eventsQuery = useAnalyticsEvents()
  const topJurisdictionsQuery = useAnalyticsTopJurisdictions()
  const topContributorsQuery = useAnalyticsTopContributors()

  const kpis = kpisQuery.data
  const events = eventsQuery.data

  // Client-side CSV export (no endpoint): KPIs + events + by-category, downloaded as civfix-analytics.csv.
  const canExport = !!kpis
  const exportCsv = () => {
    if (!kpis) return
    const rows: (string | number)[][] = [["Metric", "Value", "Change"]]
    kpis.kpis.forEach((k) => rows.push([k.label, k.num, k.delta]))
    if (events) {
      rows.push(["Cleanup events (month)", events.thisMonth, ""])
      rows.push(["Volunteers", events.volunteers, ""])
      rows.push(["Bags collected", events.bags, ""])
    }
    rows.push([])
    rows.push(["Category", "Reports", "Share %"])
    ;(byCategoryQuery.data?.rows ?? []).forEach((c) =>
      rows.push([REPORT_CATEGORY_LABELS[c.cat], c.count, c.pct]),
    )
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "civfix-analytics.csv"
    link.click()
    URL.revokeObjectURL(url)
    toast("Analytics exported · civfix-analytics.csv")
  }

  return (
    <>
      <PageHead
        title="Analytics"
        subtitle={
          <span>
            The numbers are the proof civfix works. Pins dropped, reports routed, issues resolved,
            cleanups planned.
          </span>
        }
      >
        <button
          className="btn"
          onClick={exportCsv}
          disabled={!canExport}
          style={!canExport ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
        >
          <Icons.FileText size={13} /> Export
        </button>
      </PageHead>

      {/* KPI strip. Loading/error render as a clean strip-level panel, not jammed into a stat cell. */}
      {kpisQuery.isLoading ? (
        <div className="strip-state">
          <LoadingState label="Loading KPIs..." />
        </div>
      ) : kpisQuery.isError ? (
        <div className="strip-state">
          <ErrorState error={kpisQuery.error} onRetry={() => kpisQuery.refetch()} />
        </div>
      ) : kpis ? (
        <div className="statusstrip kpi-strip">
          <KpiStrip kpis={kpis} events={events} />
        </div>
      ) : null}

      <div className="analytics-grid">
        {/* Pins per week */}
        <AnalyticsCard
          title="Pins per week"
          meta="8-week trend"
          span2
          query={pinsQuery}
          isEmpty={(d) => d.weeks.length === 0}
        >
          {(d) => <BarChart values={d.weeks} labels={d.labels} />}
        </AnalyticsCard>

        {/* By category */}
        <AnalyticsCard
          title="By category"
          meta="this month"
          query={byCategoryQuery}
          isEmpty={(d) => d.rows.length === 0}
        >
          {(d) => (
            <div className="cat-breakdown">
              {d.rows.map((c) => (
                <div key={c.cat} className="cat-bd-row">
                  <span className="cat-bd-dot" style={{ background: CAT_COLOR[c.cat] }} />
                  <span className="cat-bd-name">{REPORT_CATEGORY_LABELS[c.cat]}</span>
                  <span className="cat-bd-track">
                    <span style={{ width: `${c.pct}%`, background: CAT_COLOR[c.cat] }} />
                  </span>
                  <span className="cat-bd-n mono">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </AnalyticsCard>

        {/* Report funnel */}
        <AnalyticsCard
          title="Report funnel"
          meta="pin → resolved"
          query={funnelQuery}
          isEmpty={(d) => d.stages.length === 0}
        >
          {(d) => (
            <div className="funnel">
              {d.stages.map((f, i) => (
                <div key={f.stage} className="funnel-row">
                  <div className="funnel-top">
                    <span className="funnel-stage">{f.stage}</span>
                    <span className="funnel-n mono">{f.count.toLocaleString()}</span>
                  </div>
                  <div className="funnel-track">
                    <div
                      className="funnel-fill"
                      style={{
                        width: `${f.pct}%`,
                        background: i === d.stages.length - 1 ? "var(--moss)" : "var(--bloom)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </AnalyticsCard>

        {/* Mapping coverage */}
        <AnalyticsCard title="Mapping coverage" meta="jurisdictions" query={coverageQuery}>
          {(d) => (
            <div className="coverage">
              <div className="coverage-num">
                <span className="coverage-pct">
                  {d.pct}
                  <span className="coverage-pctsign">%</span>
                </span>
                <span className="coverage-cap">routed &amp; live</span>
              </div>
              <div className="coverage-bar">
                <span className="coverage-fill" style={{ width: `${d.pct}%` }} />
              </div>
              <div className="coverage-legend">
                <span className="cl-item">
                  <span className="dot" style={{ background: "var(--cat-trash)" }} />
                  {d.mapped} mapped
                </span>
                <span className="cl-item">
                  <span className="dot" style={{ background: "var(--bloom-600)" }} />
                  {d.needsMapping} need mapping
                </span>
              </div>
            </div>
          )}
        </AnalyticsCard>

        {/* Median resolution time */}
        <AnalyticsCard
          title="Median resolution time"
          meta="by report type"
          span2
          query={resolutionQuery}
          isEmpty={(d) => d.rows.length === 0}
        >
          {(d) => {
            const max = Math.max(...d.rows.map((x) => x.hours), 1)
            return (
              <div className="cat-breakdown">
                {d.rows.map((r) => (
                  <div key={r.cat} className="cat-bd-row res-row">
                    <span className="cat-bd-dot" style={{ background: CAT_COLOR[r.cat] }} />
                    <span className="cat-bd-name">{REPORT_CATEGORY_LABELS[r.cat]}</span>
                    <span className="cat-bd-track">
                      <span style={{ width: `${(r.hours / max) * 100}%`, background: CAT_COLOR[r.cat] }} />
                    </span>
                    <span className="cat-bd-n mono">{r.hours}h</span>
                  </div>
                ))}
              </div>
            )
          }}
        </AnalyticsCard>

        {/* Cleanup events */}
        <AnalyticsCard
          title="Cleanup events"
          meta="8-month trend"
          span2
          query={eventsQuery}
          isEmpty={(d) => d.byMonth.length === 0}
        >
          {(d) => (
            <>
              <div className="events-summary">
                <div className="es-stat">
                  <span className="es-num">{d.thisMonth}</span>
                  <span className="es-lbl">events this month</span>
                </div>
                <div className="es-stat">
                  <span className="es-num">{d.volunteers.toLocaleString()}</span>
                  <span className="es-lbl">volunteers</span>
                </div>
                <div className="es-stat">
                  <span className="es-num">{d.bags.toLocaleString()}</span>
                  <span className="es-lbl">bags collected</span>
                </div>
              </div>
              <BarChart values={d.byMonth} labels={d.monthLabels} />
            </>
          )}
        </AnalyticsCard>

        {/* Top jurisdictions */}
        <AnalyticsCard
          title="Top jurisdictions"
          meta="by pin volume"
          span2
          pad={false}
          query={topJurisdictionsQuery}
          isEmpty={(d) => d.rows.length === 0}
        >
          {(d) => (
            <div className="table">
              <div className="trow thead jt">
                <span>Jurisdiction</span>
                <span>Pins</span>
                <span>Resolved</span>
              </div>
              {d.rows.map((j) => (
                <div key={j.org} className="trow jt">
                  <span className="td-strong">{j.org}</span>
                  <span className="mono">{j.pins}</span>
                  <span className="mono" style={{ color: "var(--moss-700)", fontWeight: 700 }}>
                    {/* resolved is a percentage; the contract carries the bare number, so append "%"
                        at render time to match the design's "91%". */}
                    {j.resolved}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </AnalyticsCard>

        {/* Top contributors */}
        <AnalyticsCard
          title="Top contributors"
          meta="reports + cleanups"
          span2
          pad={false}
          query={topContributorsQuery}
          isEmpty={(d) => d.rows.length === 0}
        >
          {(d) => (
            <div className="table">
              <div className="trow thead ct">
                <span>Neighbor</span>
                <span>Reports</span>
                <span>Cleanups</span>
              </div>
              {d.rows.map((c) => (
                <div key={c.name} className="trow ct">
                  <span className="contrib-cell">
                    <span className="contrib-av">{initials(c.name)}</span>
                    <span className="contrib-text">
                      <span className="td-strong">{c.name}</span>
                      <span className="contrib-city">{c.city}</span>
                    </span>
                  </span>
                  <span className="mono">{c.reports}</span>
                  <span className="mono" style={{ color: "var(--moss-700)", fontWeight: 700 }}>
                    {c.cleanups}
                  </span>
                </div>
              ))}
            </div>
          )}
        </AnalyticsCard>
      </div>
    </>
  )
}
