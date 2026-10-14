import { describe, expect, it } from "vitest"
import type { OrgVerificationStatus } from "@civfix/shared"

import { ORG_STATUS_VIEW, orgStatusView } from "./org-status"

describe("org status pills", () => {
  it("uses the mapped treatment for every known status", () => {
    for (const status of Object.keys(ORG_STATUS_VIEW) as OrgVerificationStatus[]) {
      expect(orgStatusView(status)).toBe(ORG_STATUS_VIEW[status])
    }
  })

  it("shows a status this build does not know raw in a neutral pill", () => {
    expect(orgStatusView("under_appeal" as OrgVerificationStatus)).toEqual({
      label: "under_appeal",
      cls: "priority-low",
    })
  })
})
