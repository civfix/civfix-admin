import { GOV_VERIFICATION_CHECK_LABELS, GovClaimStatusSchema } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import {
  GOV_CHECKS,
  GOV_CLAIM_STATUS_VIEW,
  govCheckLabel,
  govClaimDecisionBlockedFor,
} from "./gov-claim-presentation"

describe("gov claim presentation", () => {
  it("covers every wire claim status so a pill never renders blank", () => {
    for (const status of GovClaimStatusSchema.options) {
      expect(GOV_CLAIM_STATUS_VIEW[status].cls).toBeTruthy()
      expect(GOV_CLAIM_STATUS_VIEW[status].label).toBeTruthy()
    }
  })

  it("names every verification check from the shared label map", () => {
    expect([...GOV_CHECKS]).toEqual(Object.keys(GOV_VERIFICATION_CHECK_LABELS))
    for (const check of GOV_CHECKS) {
      expect(govCheckLabel(check)).toBe(GOV_VERIFICATION_CHECK_LABELS[check])
    }
  })
})

describe("gov claim decision availability", () => {
  it("blocks a second decision, matching the API's 409 on a non-pending claim", () => {
    expect(govClaimDecisionBlockedFor("approved")).toBe("This claim was already approved.")
    expect(govClaimDecisionBlockedFor("rejected")).toBe("This claim was already rejected.")
  })

  it("allows the decision while the claim is still pending", () => {
    expect(govClaimDecisionBlockedFor("pending")).toBeNull()
  })
})
