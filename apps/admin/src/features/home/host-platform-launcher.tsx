"use client"

import { Icons, type IconComponent } from "@/components/icons"
import type { Hue } from "@/features/analytics/analytics-charts"
import { PAGE_LABEL, useNav, type PageId } from "@/store/ui-store"

const HOST_PLATFORM_SECTIONS: {
  page: Extract<PageId, "orgs" | "hosts" | "pages">
  hue: Hue
  icon: IconComponent
  sub: string
}[] = [
  {
    page: "orgs",
    hue: "sky",
    icon: Icons.Building,
    sub: "Create and manage orgs, verify, members, events",
  },
  { page: "hosts", hue: "bloom", icon: Icons.Send, sub: "Broadcast counters and the kill switch" },
  { page: "pages", hue: "lilac", icon: Icons.Globe, sub: "Public signup pages: flag or unpublish" },
]

export function HostPlatformLauncher() {
  const nav = useNav()
  return (
    <section className="card">
      <div className="card-head">
        <h3>Host platform</h3>
      </div>
      <div className="host-launch">
        {HOST_PLATFORM_SECTIONS.map((section) => {
          const SectionIcon = section.icon
          return (
            <button
              key={section.page}
              type="button"
              className={`launch-row hue-${section.hue}`}
              onClick={() => nav(section.page)}
            >
              <span className="launch-ico">
                <SectionIcon size={15} />
              </span>
              <span className="launch-text">
                <span className="launch-label">{PAGE_LABEL[section.page]}</span>
                <span className="launch-sub">{section.sub}</span>
              </span>
              <Icons.ChevronRight size={14} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
