"use client"

import type { ReactNode } from "react"

import { Icons, type IconComponent } from "@/components/icons"
import { Spark } from "@/features/analytics/analytics-charts"
import type { SectionSummary } from "@/features/home/home-summaries"
import { useNav, type PageId } from "@/store/ui-store"

const HUB_ICON: Partial<Record<PageId, IconComponent>> = {
  discovery: Icons.Pin,
  reports: Icons.FileText,
  events: Icons.Calendar,
  mail: Icons.Mail,
  users: Icons.Users,
  moderation: Icons.Shield,
  analytics: Icons.BarChart,
}

function tileClassName(summary: SectionSummary, feature: boolean | undefined): string {
  return `stile hue-${summary.hue} ${feature ? "feature" : ""}`
}

function TileHead({
  summary,
  onOpen,
  children,
}: {
  summary: SectionSummary
  onOpen: () => void
  children?: ReactNode
}) {
  const SectionIcon = HUB_ICON[summary.page] ?? Icons.Layers
  return (
    <button type="button" className="stile-head" onClick={onOpen}>
      <span className="stile-ico">
        <SectionIcon size={16} />
      </span>
      <span className="stile-label">{summary.label}</span>
      {children}
    </button>
  )
}

function TileFoot({
  onOpen,
  cta,
  children,
}: {
  onOpen: () => void
  cta: string
  children?: ReactNode
}) {
  return (
    <button type="button" className="stile-foot opens" onClick={onOpen}>
      {children}
      <span className="spacer-flex" />
      <span className="stile-cta">
        {cta} <Icons.ArrowRight size={13} />
      </span>
    </button>
  )
}

function MetricTrend({ summary }: { summary: SectionSummary }) {
  if (!summary.spark) return null
  if (!summary.spark.some((v) => v > 0)) return <div className="hub-spark">No data yet</div>
  return (
    <Spark
      values={summary.spark}
      hue={summary.hue}
      label={`Pins per week, last ${summary.spark.length} weeks: ${summary.spark.join(", ")}`}
    />
  )
}

export function MetricSectionTile({ summary }: { summary: SectionSummary }) {
  const nav = useNav()
  const open = () => nav(summary.page)
  return (
    <div className={tileClassName(summary, undefined)}>
      <TileHead summary={summary} onOpen={open} />

      <div className="stile-metric">
        <div className="stile-lead">
          <span className="stile-num">{summary.lead}</span>
          <span className="stile-unit">{summary.unit}</span>
        </div>
        <MetricTrend summary={summary} />
      </div>
      {summary.metrics && (
        <div className="stile-metricgrid">
          {summary.metrics.map((metric) => (
            <div key={metric.k} className="smg-cell">
              <div className="smg-top">
                <span className="smg-v">{metric.v}</span>
              </div>
              <div className="smg-k">{metric.k}</div>
            </div>
          ))}
        </div>
      )}

      <TileFoot onOpen={open} cta={summary.cta}>
        <span className="stile-stats">
          {summary.stats.map((stat) => (
            <span key={stat.k} className="stile-stat">
              <b className={stat.tone || ""}>{stat.v}</b> {stat.k}
            </span>
          ))}
        </span>
      </TileFoot>
    </div>
  )
}

export function PreviewSectionTile({
  summary,
  feature,
  moreLabel,
  children,
}: {
  summary: SectionSummary
  feature?: boolean
  moreLabel: string | null
  children: ReactNode
}) {
  const nav = useNav()
  const open = () => nav(summary.page)
  return (
    <div className={tileClassName(summary, feature)}>
      <TileHead summary={summary} onOpen={open}>
        {summary.unit && (
          <span className="stile-headcount">
            {summary.lead === null ? (
              summary.unit
            ) : (
              <>
                <b>{summary.lead}</b> {summary.unit}
              </>
            )}
          </span>
        )}
      </TileHead>

      {feature && summary.blurb && <p className="stile-blurb">{summary.blurb}</p>}
      {children}

      <TileFoot onOpen={open} cta="Open">
        {moreLabel && <span className="stile-moreinline">{moreLabel}</span>}
      </TileFoot>
    </div>
  )
}
