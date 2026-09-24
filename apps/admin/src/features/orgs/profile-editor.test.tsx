import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import type { AdminOrgDTO } from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { DialogHost } from "@/components/shared/dialog"
import { ProfilePanel } from "@/features/orgs/profile-panel"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const RIVER = {
  id: "org-1",
  slug: "river-keepers",
  name: "River Keepers",
  description: "We clean the river.",
  websiteUrl: "https://riverkeepers.org",
  logoUrl: null,
  verifiedStatus: "verified",
  verifiedKind: "nonprofit",
  verifiedAt: "2026-02-01T10:00:00.000Z",
  createdAt: "2026-01-01T10:00:00.000Z",
  deletedAt: null,
  memberCount: 3,
  eventCount: 1,
  owner: null,
  verification: null,
  donationUrl: null,
  suspendedAt: null,
  suspendedReason: null,
  updatedAt: null,
  socialLinks: null,
  logoMediaId: null,
} satisfies AdminOrgDTO

describe("ProfilePanel editor", () => {
  it("PATCHes only the fields the operator changed when the org refetches mid-edit", async () => {
    apiMock.adminUpdateOrg.mockImplementation(async (input: { id: string }) => ({
      ...RIVER,
      ...input,
    }))
    const { client, rerender } = renderWithQuery(
      <>
        <ProfilePanel org={RIVER} />
        <DialogHost />
      </>,
    )

    await userEvent.click(screen.getByRole("button", { name: /Edit profile/ }))
    const description = screen.getByLabelText(/^Description/)
    await userEvent.clear(description)
    await userEvent.type(description, "We clean the river and its banks.")

    // Someone else changes the website while this editor is open, and the detail query refetches.
    rerender(
      <QueryClientProvider client={client}>
        <ProfilePanel org={{ ...RIVER, websiteUrl: "https://riverkeepers.example" }} />
        <DialogHost />
      </QueryClientProvider>,
    )

    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Updated the mission")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiMock.adminUpdateOrg).toHaveBeenCalledTimes(1))
    expect(apiMock.adminUpdateOrg).toHaveBeenCalledWith({
      id: "org-1",
      reason: "Updated the mission",
      description: "We clean the river and its banks.",
    })
  })
})
