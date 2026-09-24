import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { AdminUserListItemDTO, AdminUserListResponse } from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { UserPicker } from "@/features/orgs/user-picker"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

function person(over: Partial<AdminUserListItemDTO> & { id: string; name: string }) {
  return {
    handle: `@${over.id}`,
    city: "Oakland",
    joined: "2026-01-05T00:00:00.000Z",
    avatar: ["#111111", "#222222"],
    avatarUrl: null,
    status: "active",
    reports: 0,
    cleanups: 0,
    removals: 0,
    strikes: 0,
    risk: "low",
    lastActive: "2h ago",
    flagged: false,
    flagReason: null,
    deletedAt: null,
    ...over,
  } satisfies AdminUserListItemDTO
}

function page(items: AdminUserListItemDTO[]): AdminUserListResponse {
  return { items, nextCursor: null }
}

const ADA = person({ id: "ada", name: "Ada Park" })
const BO = person({ id: "bo", name: "Bo Lind", status: "suspended" })
const CY = person({ id: "cy", name: "Cy Ames", deletedAt: "2026-08-01T00:00:00.000Z" })

describe("UserPicker", () => {
  it("promises only what the search matches and drops a leading @ from the term", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ADA]))
    renderWithQuery(<UserPicker value={null} onChange={() => {}} />)

    const box = screen.getByRole("textbox", { name: "Search users by name, handle or city" })
    expect(box).toHaveAttribute("placeholder", "Search by name, handle or city…")
    await userEvent.type(box, "@ada")
    await waitFor(() =>
      expect(apiMock.listAdminUsers).toHaveBeenLastCalledWith({ q: "ada", limit: 8 }),
    )
  })

  it("says everyone matching is already a member when the page held only members", async () => {
    const members = Array.from({ length: 8 }, (_, i) => person({ id: `m${i}`, name: `Member ${i}` }))
    apiMock.listAdminUsers.mockResolvedValue(page(members))
    renderWithQuery(
      <UserPicker value={null} onChange={() => {}} excludeIds={new Set(members.map((m) => m.id))} />,
    )

    await userEvent.type(screen.getByRole("textbox"), "member")
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Everyone matching is already a member."),
    )
    expect(apiMock.listAdminUsers).toHaveBeenLastCalledWith({ q: "member", limit: 16 })
  })

  it("keeps at most eight results after leaving out members", async () => {
    const members = [person({ id: "m0", name: "Member 0" })]
    const others = Array.from({ length: 9 }, (_, i) => person({ id: `o${i}`, name: `Other ${i}` }))
    apiMock.listAdminUsers.mockResolvedValue(page([...members, ...others]))
    renderWithQuery(
      <UserPicker value={null} onChange={() => {}} excludeIds={new Set(["m0"])} />,
    )

    const results = await screen.findByRole("list", { name: "Matching users" })
    expect(within(results).getAllByRole("button")).toHaveLength(8)
    expect(within(results).queryByText("Member 0")).not.toBeInTheDocument()
  })

  it("shows friendly copy when the search fails", async () => {
    apiMock.listAdminUsers.mockRejectedValue(new TypeError("Failed to fetch"))
    renderWithQuery(<UserPicker value={null} onChange={() => {}} />)
    expect(
      await screen.findByText("Could not search users. Check your connection and try again."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument()
  })

  it("labels account status and marks deleted accounts", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ADA, BO, CY]))
    renderWithQuery(<UserPicker value={null} onChange={() => {}} />)

    const results = await screen.findByRole("list", { name: "Matching users" })
    expect(within(results).getByText("Suspended")).toBeInTheDocument()
    expect(within(results).queryByText("suspended")).not.toBeInTheDocument()
    expect(within(results).getByRole("button", { name: /Cy Ames/ })).toHaveTextContent("Deleted")
    expect(within(results).getByRole("button", { name: /Ada Park/ })).not.toHaveTextContent(/Deleted|Active/)
  })

  it("announces how many users match", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ADA, BO]))
    renderWithQuery(<UserPicker value={null} onChange={() => {}} />)
    expect(await screen.findByRole("status")).toHaveTextContent("2 matching users")
  })

  it("names the Change button after what it changes", () => {
    renderWithQuery(
      <UserPicker value={{ id: "ada", name: "Ada Park", handle: "@ada" }} onChange={() => {}} />,
    )
    expect(screen.getByRole("button", { name: "Change selected user" })).toBeInTheDocument()
  })

  it("takes its name and description from the form's label and error", () => {
    apiMock.listAdminUsers.mockReturnValue(new Promise(() => {}))
    renderWithQuery(
      <>
        <span id="owner-label">Owner</span>
        <span id="owner-error">Pick an owner.</span>
        <UserPicker value={null} onChange={() => {}} labelledBy="owner-label" describedBy="owner-error" />
      </>,
    )
    const box = screen.getByRole("textbox", { name: "Owner" })
    expect(box).toHaveAccessibleDescription("Pick an owner.")
  })
})
