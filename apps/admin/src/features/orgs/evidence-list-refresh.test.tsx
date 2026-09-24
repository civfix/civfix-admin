import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { VerificationPanel } from "@/features/orgs/verification-panel"
import { makeOrg, mockOrgDetails, pendingApplication } from "@/features/orgs/test-fixtures"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const FIRST_DOC = "aaaa0001-0000-4000-8000-000000000001"
const SECOND_DOC = "bbbb0002-0000-4000-8000-000000000002"
const RESUBMITTED_DOC = "cccc0003-0000-4000-8000-000000000003"

function orgWithDocuments(documentMediaIds: string[]) {
  const org = makeOrg({ verifiedStatus: "pending", verifiedKind: null })
  return { ...org, verification: { ...pendingApplication(org), documentMediaIds } }
}

describe("EvidenceList on a refetch with new documents", () => {
  it("closes the open viewer without dropping focus from the row toggle", async () => {
    apiMock.adminGetMedia.mockReturnValue(new Promise(() => {}))
    const before = orgWithDocuments([FIRST_DOC, SECOND_DOC])
    mockOrgDetails(before)
    const user = userEvent.setup()
    const { client } = renderWithQuery(<VerificationPanel orgId={before.id} />)
    await screen.findByText(`/${before.slug}`)

    const toggle = screen.getByRole("button", { name: /Document 1/ })
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(toggle).toHaveFocus()

    mockOrgDetails(orgWithDocuments([FIRST_DOC, RESUBMITTED_DOC]))
    await act(() => client.refetchQueries({ queryKey: queryKeys.orgs.detail(before.id) }))

    await screen.findByText("cccc0003")
    const after = screen.getByRole("button", { name: /Document 1/ })
    expect(after).toHaveAttribute("aria-expanded", "false")
    expect(after).toHaveFocus()
  })
})
