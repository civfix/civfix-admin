import type { GovClaimDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { verifyCheckRequest } from "./gov-claim-presentation"

const PENDING_CHECK = { status: "pending", evidence: null, note: null } as const

function claimWithLinkedin(linkedin: GovClaimDTO["checks"]["linkedin"]): Pick<GovClaimDTO, "id" | "checks"> {
  return { id: "claim-1", checks: { linkedin, directory: PENDING_CHECK, callback: PENDING_CHECK } }
}

describe("verifyCheckRequest", () => {
  it("records trimmed evidence and keeps the stored note when marking verified", () => {
    const claim = claimWithLinkedin({ status: "pending", evidence: null, note: "called twice" })
    expect(verifyCheckRequest(claim, "linkedin", "verified", "  https://example.org/p  ")).toEqual({
      id: "claim-1",
      check: "linkedin",
      status: "verified",
      evidence: "https://example.org/p",
      note: "called twice",
    })
  })

  it("omits blank typed evidence when marking verified", () => {
    const claim = claimWithLinkedin(PENDING_CHECK)
    expect(verifyCheckRequest(claim, "linkedin", "verified", "   ")).toEqual({
      id: "claim-1",
      check: "linkedin",
      status: "verified",
    })
  })

  it("keeps the stored evidence and note when moving back to pending", () => {
    const claim = claimWithLinkedin({ status: "verified", evidence: "profile link", note: "ok" })
    expect(verifyCheckRequest(claim, "linkedin", "pending")).toEqual({
      id: "claim-1",
      check: "linkedin",
      status: "pending",
      evidence: "profile link",
      note: "ok",
    })
  })
})
