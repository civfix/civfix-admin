"use client"

import * as React from "react"
import {
  REPORT_CATEGORY_LABELS,
  type AnalyticsKpisResponse,
  type ReportCategory,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { downloadCsv } from "@/lib/csv"
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


const CAT_COLOR: Record<ReportCategory, string> = {
  trash: "var(--cat-trash)",
  recycling: "var(--cat-recycling)",
  graffiti: "var(--cat-graffiti)",
  hazard: "var(--cat-hazard)",
  encampment: "var(--cat-encampment)",
  water: "var(--cat-water)",
  other: "var(--ink-3)",
}

function initials(name: string): string {
  const out = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return out || "?"
}

function humanizeHours(hours: number): string {
  if (hours <= 0) return "—"
  if (hours < 1) return "<1h"
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  const rem = Math.round(hours % 24)
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`
}

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

function KpiDelta({ delta, dir }: { delta: string; dir: "up" | "down" | "flat" }) {
  const color = dir === "up" ? "var(--moss-700)" : dir === "down" ? "var(--danger)" : "var(--ink-3)"
  return (
    <div className="statcell-hot" style={{ color }}>
      {dir === "up" ? <Icons.ArrowUp size={10} /> : dir === "down" ? <Icons.ArrowDown size={10} /> : null}{" "}
      {delta}
    </div>
  )
}

function KpiStrip({ kpis }: { kpis: AnalyticsKpisResponse }) {
  return (
    <>
      {kpis.kpis
        .filter((k) => !/route/i.test(k.label))
        .map((k) => {
          const isPct = /resolved/i.test(k.label)
          return (
            <div key={k.label} className="statcell">
              <div className="statcell-label">{k.label}</div>
              <div className="statcell-num">
                {isPct ? `${Math.round(k.num)}%` : k.num.toLocaleString()}
              </div>
              <KpiDelta delta={k.delta} dir={k.dir} />
            </div>
          )
        })}
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

  const canExport = !!kpis
  const exportCsv = () => {
    if (!kpis) return
    const rows: (string | number)[][] = [["Metric", "Value", "Change"]]
    kpis.kpis
      .filter((k) => !/route/i.test(k.label))
      .forEach((k) => rows.push([k.label, k.num, k.delta]))
    if (events) {
      rows.push(["Cleanup events (month)", events.thisMonth, ""])
      rows.push(["Volunteers", events.volunteers, ""])
    }
    rows.push([])
    rows.push(["Category", "Reports", "Share %"])
    ;(byCategoryQuery.data?.rows ?? []).forEach((c) =>
      rows.push([REPORT_CATEGORY_LABELS[c.cat], c.count, c.pct]),
    )
    downloadCsv("civfix-analytics.csv", rows)
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

      { }
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
          <KpiStrip kpis={kpis} />
        </div>
      ) : null}

      <div className="analytics-grid">
        { }
        <AnalyticsCard
          title="Pins per week"
          meta="8-week trend"
          span2
          query={pinsQuery}
          isEmpty={(d) => d.weeks.length === 0}
        >
          {(d) => <BarChart values={d.weeks} labels={d.labels} />}
        </AnalyticsCard>

        { }
        <AnalyticsCard
          title="By category"
          meta="this month"
          query={byCategoryQuery}
          isEmpty={(d) => d.rows.every((r) => r.count === 0)}
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

        { }
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

        { }
        <AnalyticsCard
          title="Mapping coverage"
          meta="jurisdictions"
          query={coverageQuery}
          isEmpty={(d) => d.mapped + d.needsMapping === 0}
        >
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

        { }
        <AnalyticsCard
          title="Median resolution time"
          meta="by report type"
          span2
          query={resolutionQuery}
          isEmpty={(d) => d.rows.every((r) => r.hours === 0)}
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
                    <span className="cat-bd-n mono">{humanizeHours(r.hours)}</span>
                  </div>
                ))}
              </div>
            )
          }}
        </AnalyticsCard>

        { }
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
                { }
                {d.bags > 0 ? (
                  <div className="es-stat">
                    <span className="es-num">{d.bags.toLocaleString()}</span>
                    <span className="es-lbl">bags collected</span>
                  </div>
                ) : null}
              </div>
              <BarChart values={d.byMonth} labels={d.monthLabels} />
            </>
          )}
        </AnalyticsCard>

        { }
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
              {d.rows.map((j, i) => (
                <div key={`${j.org}-${i}`} className="trow jt">
                  <span className="td-strong">{j.org}</span>
                  <span className="mono">{j.pins}</span>
                  <span className="mono" style={{ color: "var(--moss-700)", fontWeight: 700 }}>
                    { }
                    {j.resolved}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </AnalyticsCard>

        { }
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
              {d.rows.map((c, i) => (
                <div key={`${c.name}-${c.city}-${i}`} className="trow ct">
                  <span className="contrib-cell">
                    <span className="contrib-av">{initials(c.name)}</span>
                    <span className="contrib-text">
                      <span className="td-strong">{c.name}</span>
                      <span className="contrib-city">{c.city || "—"}</span>
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
