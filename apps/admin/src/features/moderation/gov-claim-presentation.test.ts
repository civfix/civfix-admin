import {
  AppError,
  ErrorCode,
  GOV_VERIFICATION_CHECK_LABELS,
  GovClaimStatusSchema,
  type GovClaimDTO,
} from "@civfix/shared"
import { describe, expect, it } from "vitest"

import {
  GOV_CHECKS,
  GOV_CLAIM_STATUS_VIEW,
  govCheckLabel,
  govClaimApproveBlockedMessage,
  govClaimApproveConfirmBody,
  govClaimApproveErrorMessage,
  govClaimDecisionBlockedMessage,
} from "./gov-claim-presentation"

const PENDING_CHECK = { status: "pending", evidence: null, note: null } as const

function claim(over: Partial<GovClaimDTO> = {}): GovClaimDTO {
  return {
    id: "claim-1",
    name: "Dana Reyes",
    title: "Deputy Director",
    org: "City of Springfield",
    jurisdictionGeoid: "0677000",
    method: "email",
    status: "pending",
    age: "2d",
    contactEmail: "dana@springfield.gov",
    verified: [],
    pending: [...GOV_CHECKS],
    checks: { linkedin: PENDING_CHECK, directory: PENDING_CHECK, callback: PENDING_CHECK },
    ...over,
  }
}

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
    expect(govClaimDecisionBlockedMessage("approved")).toBe("This claim was already approved.")
    expect(govClaimDecisionBlockedMessage("rejected")).toBe("This claim was already rejected.")
  })

  it("allows the decision while the claim is still pending", () => {
    expect(govClaimDecisionBlockedMessage("pending")).toBeNull()
  })

  it("blocks approve when the claim has no contact email to grant access on", () => {
    expect(govClaimApproveBlockedMessage(claim({ contactEmail: "" }))).toBe(
      "This claim has no contact email, so there is no account to grant government access to.",
    )
    expect(govClaimApproveBlockedMessage(claim({ contactEmail: "   " }))).not.toBeNull()
    expect(govClaimApproveBlockedMessage(claim())).toBeNull()
    expect(govClaimApproveBlockedMessage(claim({ status: "approved" }))).toBe(
      "This claim was already approved.",
    )
  })
})

describe("gov claim approve confirm", () => {
  it("states the account grant, the session rule, the check state and the audit", () => {
    const body = govClaimApproveConfirmBody(claim({ verified: ["linkedin"] }), GOV_CHECKS.length)
    expect(body).toContain("grants government access to the account for dana@springfield.gov")
    expect(body).toContain("creating a placeholder account first if that address has none yet")
    expect(body).toContain("signed out only if its role actually changes")
    expect(body).toContain("1 of 3 checks verified.")
    expect(body).toContain("written to the audit log")
  })

  it("claims a jurisdiction link only when the claim carries a jurisdiction", () => {
    expect(govClaimApproveConfirmBody(claim(), GOV_CHECKS.length)).toContain(
      "links that account to jurisdiction 0677000",
    )
    expect(
      govClaimApproveConfirmBody(claim({ jurisdictionGeoid: null }), GOV_CHECKS.length),
    ).not.toContain("jurisdiction")
  })

  it("surfaces an unverified approve in the check count", () => {
    expect(govClaimApproveConfirmBody(claim(), GOV_CHECKS.length)).toContain(
      "0 of 3 checks verified.",
    )
  })
})

describe("gov claim approve refusals", () => {
  it("explains an unverified contact email", () => {
    const err = new AppError(ErrorCode.VALIDATION, "Cannot elevate an existing account", {
      fields: { contactEmail: "unverified" },
    })
    expect(govClaimApproveErrorMessage(err)).toContain("never proven they control it")
  })

  it("explains a blank contact email", () => {
    const err = new AppError(ErrorCode.VALIDATION, "Cannot approve", {
      fields: { contactEmail: "required" },
    })
    expect(govClaimApproveErrorMessage(err)).toContain("no contact email")
  })

  it("explains an operator address", () => {
    const err = new AppError(ErrorCode.FORBIDDEN, "Operator accounts are managed elsewhere")
    expect(govClaimApproveErrorMessage(err)).toContain("ADMIN_EMAILS")
  })

  it("falls back to the server message for anything else", () => {
    const err = new AppError(ErrorCode.CONFLICT, "Gov claim is not pending")
    expect(govClaimApproveErrorMessage(err)).toBe("Gov claim is not pending")
  })
})
