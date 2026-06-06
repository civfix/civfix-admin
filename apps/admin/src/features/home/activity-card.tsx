"use client"

import type { ActivityItemDTO } from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { EmptyState } from "@/components/shared/page-primitives"
import { useActivity } from "@/hooks/use-admin-home"

/**
 * Recent activity feed (ported from queues.jsx ActivityFeed). Reads GET /admin/activity (the audit log
 * + recent domain events). Shows the most recent items with a per-kind icon and hue.
 */

const ACT_ICONS: Record<ActivityItemDTO["kind"], IconComponent> = {
  pin: Icons.Pin,
  claim: Icons.Check,
  discovery_done: Icons.Check,
  outreach_bounce: Icons.AlertTriangle,
  mod_action: Icons.Shield,
  gov_onboard: Icons.Building,
  outreach_open: Icons.Mail,
  cleanup_plan: Icons.Bookmark,
}

const HUE_BG = {
  bloom: { bg: "var(--bloom-50)", fg: "var(--bloom-700)" },
  moss: { bg: "var(--moss-50)", fg: "var(--moss-700)" },
  sun: { bg: "var(--sun-50)", fg: "var(--sun-700)" },
  sky: { bg: "var(--sky-50)", fg: "var(--sky-700)" },
  lilac: { bg: "var(--lilac-50)", fg: "var(--lilac-600)" },
} satisfies Record<string, { bg: string; fg: string }>

type HueKey = keyof typeof HUE_BG

export function ActivityCard() {
  const q = useActivity()
  const items = q.data?.items ?? []

  return (
    <section className="card">
      <div className="card-head">
        <h3>Recent activity</h3>
        <span className="live-inline-dot" />
        <div className="spacer" />
      </div>
      {q.isLoading ? (
        <LoadingState label="Loading activity..." />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load activity" />
      ) : items.length === 0 ? (
        <EmptyState icon={<Icons.Activity size={20} />} title="No recent activity" />
      ) : (
        <div className="activity">
          {items.slice(0, 7).map((a, i) => {
            const Ico = ACT_ICONS[a.kind] ?? Icons.Activity
            const hue = HUE_BG[a.hue as HueKey] ?? HUE_BG.sky
            return (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className="act-row"
              >
                <span className="ico" style={{ background: hue.bg, color: hue.fg }}>
                  <Ico size={12} />
                </span>
                <div className="msg">
                  <span className="who">{a.who}</span> {a.what} <span className="what">{a.where}</span>
                </div>
                <div className="ts">{a.ts}</div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
