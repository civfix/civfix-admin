"use client"

import * as React from "react"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead } from "@/components/shared/page-primitives"
import { menuFocusIndex } from "@/features/orgs/org-members"
import { GovClaimsSection } from "@/features/moderation/gov-claims-section"
import { ModerationQueueSection } from "@/features/moderation/moderation-queue"
import { useNav } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

type Section = "queue" | "gov_claims"

const SECTION_OPTIONS: { id: Section; label: string; Icon: IconComponent }[] = [
  { id: "queue", label: "Queue", Icon: Icons.Shield },
  { id: "gov_claims", label: "Gov claims", Icon: Icons.Building },
]

export function ModerationPage({ focusId }: SectionPageProps) {
  const [section, setSection] = React.useState<Section>("queue")
  const queue = section === "queue"
  const nav = useNav()
  const radioRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  const switchTo = (next: Section) => {
    if (next === section) return
    // The deep link names a queue item; leaving the queue ends it, so coming back opens the queue fresh.
    if (focusId) nav("moderation")
    setSection(next)
  }

  return (
    <>
      <PageHead
        title="Moderation"
        subtitle={
          queue ? (
            <span>
              The moderation queue: citizen content reports (the in-app &ldquo;Report&rdquo; button)
              plus held media, coordinated-report clusters, and appeals. Review the signals, then
              approve, remove, hold, or decide the appeal.
            </span>
          ) : (
            <span>
              Government staff asking for access to their jurisdiction. Verify who they are, then
              approve (which provisions a government role on their account) or reject with a reason.
            </span>
          )
        }
      />

      <div className="mailbox-switch" role="radiogroup" aria-label="Moderation section">
        {SECTION_OPTIONS.map(({ id, label, Icon }, i) => {
          const checked = section === id
          return (
            <button
              key={id}
              ref={(el) => {
                radioRefs.current[i] = el
              }}
              type="button"
              className={`mbx ${checked ? "active" : ""}`}
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => switchTo(id)}
              onKeyDown={(e) => {
                const next = menuFocusIndex(e.key, i, SECTION_OPTIONS.length, "both")
                if (next === null) return
                e.preventDefault()
                switchTo(SECTION_OPTIONS[next]!.id)
                radioRefs.current[next]?.focus()
              }}
            >
              <Icon size={13} /> {label}
            </button>
          )
        })}
      </div>

      {queue ? <ModerationQueueSection focusId={focusId} /> : <GovClaimsSection />}
    </>
  )
}
