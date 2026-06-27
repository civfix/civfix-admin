"use client"

import { Icons, type IconComponent } from "@/components/icons"
import { PAGE_LABEL, useNav, type SectionId } from "@/store/ui-store"
import { useAdminLogout, useOperatorSession } from "@/hooks/use-admin-auth"

const SECTION_ICON: Record<SectionId, IconComponent> = {
  discovery: Icons.Pin,
  reports: Icons.FileText,
  events: Icons.Calendar,
  mail: Icons.Mail,
  users: Icons.Users,
  moderation: Icons.Shield,
  gov: Icons.Building,
  analytics: Icons.BarChart,
}

const SECTION_HUE: Record<SectionId, string> = {
  discovery: "slate",
  reports: "lilac",
  events: "sun",
  mail: "sky",
  users: "sun",
  moderation: "lilac",
  gov: "sky",
  analytics: "moss",
}

export function BackBar({ page }: { page: SectionId }) {
  const nav = useNav()
  const { operator } = useOperatorSession()
  const logout = useAdminLogout()
  const Ico = SECTION_ICON[page] ?? Icons.Layers
  const hue = SECTION_HUE[page] ?? "bloom"
  return (
    <div className="backbar">
      <button className="backbar-btn" onClick={() => nav("home")}>
        <Icons.ChevronLeft size={15} />
        <span>Dashboard</span>
      </button>
      <span className="backbar-div" />
      <span className={`backbar-here hue-${hue}`}>
        <span className="backbar-ico">
          <Ico size={14} />
        </span>
        {PAGE_LABEL[page]}
      </span>
      <div className="spacer" />
      {operator && <span className="meta">{operator.name}</span>}
      <button className="backbar-btn" onClick={() => void logout()}>
        <Icons.Lock size={14} />
        <span>Sign out</span>
      </button>
    </div>
  )
}
