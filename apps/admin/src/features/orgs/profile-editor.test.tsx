import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { AppError, ErrorCode, type AdminOrgDTO } from "@civfix/shared"
import { describe, expect, it, onTestFinished, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { makeQueryClient } from "@/lib/query"
import { useUiStore } from "@/store/ui-store"
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

describe("ProfilePanel editor save errors", () => {
  function recordToasts(): { text: string; tone: string }[] {
    const shown: { text: string; tone: string }[] = []
    const unsubscribe = useUiStore.subscribe((s, prev) => {
      if (s.toast && s.toast !== prev.toast) shown.push({ text: s.toast.text, tone: s.toast.tone })
    })
    onTestFinished(unsubscribe)
    return shown
  }

  async function saveDescription(): Promise<void> {
    renderWithQuery(
      <>
        <ProfilePanel org={RIVER} />
        <DialogHost />
      </>,
      makeQueryClient(),
    )
    await userEvent.click(screen.getByRole("button", { name: /Edit profile/ }))
    await userEvent.type(screen.getByLabelText(/^Description/), " Weekly.")
    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Updated the mission")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(apiMock.adminUpdateOrg).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole("button", { name: /Save changes/ })).toBeEnabled())
  }

  it("shows one error toast for a failure the editor has no field for", async () => {
    apiMock.adminUpdateOrg.mockRejectedValue(new AppError(ErrorCode.FORBIDDEN, "Operators only."))
    const shown = recordToasts()

    await saveDescription()

    expect(shown).toEqual([{ text: "Operators only.", tone: "error" }])
  })

  it("shows a field error next to its field and no toast", async () => {
    apiMock.adminUpdateOrg.mockRejectedValue(
      new AppError(ErrorCode.VALIDATION, "Invalid", {
        fields: { description: "Description is too long." },
      }),
    )
    const shown = recordToasts()

    await saveDescription()

    expect(screen.getByText("Description is too long.")).toBeInTheDocument()
    expect(shown).toEqual([])
  })
})

describe("ProfilePanel facts", () => {
  it("shows the same placeholder for an empty website and a missing donation link", () => {
    renderWithQuery(<ProfilePanel org={{ ...RIVER, websiteUrl: "", donationUrl: null }} />)

    expect(factValue("Website").textContent).toBe(EMPTY_VALUE)
    expect(factValue("Donation link").textContent).toBe(EMPTY_VALUE)
  })

  it("shows a donation link that is not https as plain text rather than as missing", () => {
    renderWithQuery(<ProfilePanel org={{ ...RIVER, donationUrl: "http://give.example" }} />)

    expect(factValue("Donation link")).toHaveTextContent("http://give.example")
    expect(screen.queryByRole("link", { name: "http://give.example" })).not.toBeInTheDocument()
  })
})

describe("ProfilePanel editor logo upload", () => {
  it("cannot be cancelled while the logo is still uploading", async () => {
    renderWithQuery(<ProfilePanel org={RIVER} />)
    await userEvent.click(screen.getByRole("button", { name: /Edit profile/ }))
    const logo = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" })
    // Hashing is the upload's first await; holding it keeps the upload in flight.
    Object.defineProperty(logo, "arrayBuffer", { value: () => new Promise(() => {}) })

    await userEvent.upload(screen.getByLabelText(/^Logo/), logo)

    expect(await screen.findByText("Uploading the logo…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  })
})

function factValue(label: string): HTMLElement {
  const row = screen.getByText(label).parentElement
  const value = row?.lastElementChild
  if (!(value instanceof HTMLElement)) throw new Error(`${label} fact is not rendered`)
  return value
}
