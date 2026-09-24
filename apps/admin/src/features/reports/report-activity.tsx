"use client"

import type { AdminReportDTO } from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"

type ReportTimelineItem = AdminReportDTO["timeline"][number]

const TIMELINE_ICON: Record<ReportTimelineItem["kind"], IconComponent> = {
  submit: Icons.Pin,
  route: Icons.Send,
  confirm: Icons.Users,
  status: Icons.Clock,
  done: Icons.Check,
  warn: Icons.AlertTriangle,
  followup: Icons.Mail,
  remove: Icons.Trash,
  reply: Icons.MessageSquare,
}

function TimelineRow({ item }: { item: ReportTimelineItem }) {
  const TimelineIcon = TIMELINE_ICON[item.kind] ?? Icons.Clock
  return (
    <div className={`rep-tl-row kind-${item.kind}`}>
      <span className="rep-tl-ico">
        <TimelineIcon size={12} />
      </span>
      <div className="rep-tl-body">
        <div className="rep-tl-text">
          <b>{item.who}</b> {item.what}
        </div>
        <div className="rep-tl-when">{item.when}</div>
      </div>
    </div>
  )
}

export function ReportActivity({ timeline }: { timeline: ReportTimelineItem[] }) {
  return (
    <div className="sub">
      <div className="sub-head">Activity</div>
      <div className="sub-body">
        {timeline.length === 0 ? (
          <EmptyState
            title="No activity yet"
            sub="Updates appear here as this report is routed, confirmed, and resolved."
            icon={<Icons.Clock size={20} />}
          />
        ) : (
          <div className="rep-timeline">
            {timeline.map((t, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <TimelineRow key={i} item={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
