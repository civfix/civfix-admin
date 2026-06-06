"use client"

import { Icons, type IconComponent } from "@/components/icons"
import { PAGE_LABEL, useNav, type SectionId } from "@/store/ui-store"

/**
 * Slim back affordance shown on every section page (ported from chrome.jsx). The global top bar and
 * sidebar are gone: the dashboard (home) is the hub, and a section returns to it via this bar.
 */

const SECTION_ICON: Record<SectionId, IconComponent> = {
  discovery: Icons.Pin,
  reports: Icons.FileText,
  events: Icons.Calendar,
  mail: Icons.Mail,
  users: Icons.Users,
  analytics: Icons.BarChart,
  moderation: Icons.Shield,
  government: Icons.Building,
}

const SECTION_HUE: Record<SectionId, string> = {
  discovery: "slate",
  reports: "lilac",
  events: "sun",
  mail: "sky",
  users: "sun",
  analytics: "moss",
  moderation: "bloom",
  government: "sky",
}

export function BackBar({ page }: { page: SectionId }) {
  const nav = useNav()
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
    </div>
  )
}
