"use client"

import { Icons, type IconComponent } from "@/components/icons"
import { PAGE_LABEL, useNav, type SectionId } from "@/store/ui-store"
import { useOperatorLogout, useOperatorSession } from "@/hooks/use-admin-auth"

const SECTION_ICON: Record<SectionId, IconComponent> = {
  discovery: Icons.Pin,
  reports: Icons.FileText,
  events: Icons.Calendar,
  mail: Icons.Mail,
  users: Icons.Users,
  moderation: Icons.Shield,
  analytics: Icons.BarChart,
  orgs: Icons.Building,
  hosts: Icons.Send,
  pages: Icons.Globe,
}

const SECTION_HUE: Record<SectionId, string> = {
  discovery: "slate",
  reports: "lilac",
  events: "sun",
  mail: "sky",
  users: "sun",
  moderation: "lilac",
  analytics: "moss",
  orgs: "sky",
  hosts: "bloom",
  pages: "lilac",
}

export function BackBar({ page }: { page: SectionId }) {
  const nav = useNav()
  const { operator } = useOperatorSession()
  const logout = useOperatorLogout()
  const SectionIcon = SECTION_ICON[page]
  const hue = SECTION_HUE[page]
  return (
    <div className="backbar">
      <button className="backbar-btn" onClick={() => nav("home")}>
        <Icons.ChevronLeft size={15} />
        <span>Dashboard</span>
      </button>
      <span className="backbar-div" />
      <span className={`backbar-here hue-${hue}`}>
        <span className="backbar-ico">
          <SectionIcon size={14} />
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
