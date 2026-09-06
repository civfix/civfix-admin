import { describe, expect, it } from "vitest"

import { maskAccountId, paymentsStateView, requirementGroups } from "./payments-view"

describe("payments view helpers", () => {
  it("shows the operator kill switch ahead of the connected-account state", () => {
    expect(paymentsStateView("ready", false, "operator").label).toBe("Disabled by operator")
    expect(paymentsStateView("ready", true, null).label).toBe("Ready")
    expect(paymentsStateView("ready", false, "eligibility").label).toBe("Ready")
    expect(paymentsStateView("not_started", false, null).label).toBe("Not connected")
    expect(paymentsStateView("at_risk", true, null).label).toBe("At risk")
  })

  it("masks a connected account id down to its prefix and last four", () => {
    expect(maskAccountId("acct_1A2B3C4D5E")).toBe("acct_••••4D5E")
    expect(maskAccountId("acct_123")).toBe("acct_••••")
    expect(maskAccountId("noprefix12345")).toBe("••••2345")
    expect(maskAccountId(null)).toBe("—")
    expect(maskAccountId("   ")).toBe("—")
  })

  it("drops empty requirement buckets and keeps operator-relevant order", () => {
    const groups = requirementGroups({
      pastDue: ["individual.id_number"],
      currentlyDue: [],
      pendingVerification: ["company.tax_id"],
      futureCurrentlyDue: [],
    } as never)
    expect(groups.map((g) => g.label)).toEqual(["Past due", "Pending verification"])
  })
})
