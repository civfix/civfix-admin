"use client"

import { Icons } from "@/components/icons"
import { PageHead } from "@/components/shared/page-primitives"

/**
 * Placeholder for a section page that wave 2 will replace. Renders the section's PageHead (so the
 * shell, BackBar, and header are exercised) plus a "to be built" notice. Each wave-2 page replaces its
 * stub file wholesale (see src/components/shell/page-registry.tsx).
 */
export function SectionStub({
  title,
  subtitle,
  note,
}: {
  title: string
  subtitle?: string
  note?: string
}) {
  return (
    <div className="hub">
      <PageHead title={title} subtitle={subtitle} />
      <section className="card">
        <div className="section-stub">
          <span className="section-stub-ico">
            <Icons.Layers size={20} />
          </span>
          <div className="section-stub-title">{title} - coming in wave 2</div>
          <p className="section-stub-sub">
            {note ??
              "This section page is scaffolded but not yet implemented. The shell, navigation, API client, and query keys are ready; a follow-up agent will build the list and detail views here."}
          </p>
        </div>
      </section>
    </div>
  )
}
