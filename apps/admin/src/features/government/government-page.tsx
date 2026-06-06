"use client"

import { SectionStub } from "@/components/shared/section-stub"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Government provisioning queue + detail (enumeration 2.H). This route was a DEAD LINK in the prototype
 * (only GovRow + .gov-claim-row CSS shipped, no page); it is a first-class route here. WAVE 2: build the
 * claims queue + detail (verify LinkedIn / Directory / Callback, then approve -> provision gov_admin and
 * link the jurisdiction, or reject). Data: listGovClaims / getGovClaim / verifyGovClaim /
 * approveGovClaim / rejectGovClaim. Keep the named export `GovernmentPage`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function GovernmentPage(_props: SectionPageProps) {
  return (
    <SectionStub
      title="Government"
      subtitle="Operators verify municipal officials - LinkedIn, directory, phone callback - then provision a gov_admin linked to the jurisdiction."
    />
  )
}
