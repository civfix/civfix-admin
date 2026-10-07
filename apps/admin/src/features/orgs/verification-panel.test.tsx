import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { renderWithQuery } from "@/test/render"
import { VerificationPanel } from "@/features/orgs/verification-panel"
import { makeOrg, mockOrgDetails, pendingApplication } from "@/features/orgs/test-fixtures"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const DECISION_BUTTONS = [
  "Verify as nonprofit",
  "Verify as government",
  "Verify as community group",
  "Reject",
]

async function renderPanelFor(org: ReturnType<typeof makeOrg>) {
  mockOrgDetails(org)
  renderWithQuery(<VerificationPanel orgId={org.id} />)
  await screen.findByText(`/${org.slug}`)
}

describe("VerificationPanel decision", () => {
  it("offers Verify and Reject for a pending application", async () => {
    const org = makeOrg({ verifiedStatus: "pending", verifiedKind: null })
    await renderPanelFor({ ...org, verification: pendingApplication(org) })

    for (const name of DECISION_BUTTONS) {
      expect(screen.getByRole("button", { name })).toBeEnabled()
    }
    expect(screen.queryByText("No application is awaiting a decision.")).not.toBeInTheDocument()
  })

  it.each(["verified", "rejected", "unverified"] as const)(
    "offers no decision for a %s organization",
    async (verifiedStatus) => {
      await renderPanelFor(makeOrg({ verifiedStatus }))

      for (const name of DECISION_BUTTONS) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
      }
      expect(screen.getByText("No application is awaiting a decision.")).toBeInTheDocument()
      expect(screen.queryByText(/Deciding again overwrites/)).not.toBeInTheDocument()
    },
  )

  it("offers no decision for a deleted organization with a pending application", async () => {
    const org = makeOrg({
      verifiedStatus: "pending",
      verifiedKind: null,
      deletedAt: "2026-04-01T10:00:00.000Z",
    })
    await renderPanelFor({ ...org, verification: pendingApplication(org) })

    for (const name of DECISION_BUTTONS) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
    }
    expect(
      screen.getByText("This organization was deleted, so its application can no longer be decided."),
    ).toBeInTheDocument()
  })
})

describe("VerificationPanel evidence", () => {
  it("shows no evidence card for an organization that never applied", async () => {
    await renderPanelFor(makeOrg({ verification: null }))

    expect(screen.getByText("This organization has never applied for verification.")).toBeInTheDocument()
    expect(screen.queryByText("Evidence")).not.toBeInTheDocument()
    expect(screen.queryByText("No evidence uploaded")).not.toBeInTheDocument()
  })

  it("says an application came without documents", async () => {
    const org = makeOrg({ verifiedStatus: "pending", verifiedKind: null })
    await renderPanelFor({ ...org, verification: pendingApplication(org) })

    expect(screen.getByText("No evidence uploaded")).toBeInTheDocument()
  })
})
