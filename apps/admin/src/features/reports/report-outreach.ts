import type { ReportOutreachStatus } from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"

export interface OutreachView {
  cls: string
  icon: IconComponent
  label: string
}

const OUTREACH_VIEW: Record<ReportOutreachStatus, OutreachView> = {
  not_sent: { cls: "status-new", icon: Icons.Mail, label: "Not sent" },
  sent: { cls: "status-progress", icon: Icons.Send, label: "Sent" },
  delivered: { cls: "status-progress", icon: Icons.Check, label: "Delivered" },
  replied: { cls: "status-ok", icon: Icons.MessageSquare, label: "Replied" },
  bounced: { cls: "status-flag", icon: Icons.AlertTriangle, label: "Bounced" },
}

export function outreachView(status: ReportOutreachStatus): OutreachView {
  return OUTREACH_VIEW[status] ?? OUTREACH_VIEW.not_sent
}
