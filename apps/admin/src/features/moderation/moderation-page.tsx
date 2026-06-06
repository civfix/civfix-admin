"use client"

import { SectionStub } from "@/components/shared/section-stub"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Moderation queue + detail (enumeration 2.I). This route was a DEAD LINK in the prototype (the design
 * shipped only ModerationRow + the .mod-detail CSS, no page); it is a first-class route here. WAVE 2:
 * build the queue + ModerationDetail (signals, user trust, similar items, approve / remove / hold /
 * appeal). Data: listModeration / getModerationItem / approveModeration / removeModeration /
 * holdModeration / appealModeration. Keep the named export `ModerationPage`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ModerationPage(_props: SectionPageProps) {
  return (
    <SectionStub
      title="Moderation"
      subtitle="Held media and flagged reports - review the signals, the reporter's trust, and similar items, then approve, remove, or hold."
    />
  )
}
