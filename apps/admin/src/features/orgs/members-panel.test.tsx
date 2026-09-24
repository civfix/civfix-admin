import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { AdminOrgMemberListResponse, GetAdminOrgResponse } from "@civfix/shared"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { DialogHost } from "@/components/shared/dialog"
import { MembersPanel } from "@/features/orgs/members-panel"
import { OWNER, SAM, makeOrg, member } from "@/features/orgs/test-fixtures"
import { useOrg } from "@/features/orgs/use-orgs"
import { useUiStore } from "@/store/ui-store"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

afterEach(() => {
  // The dialog host is backed by a module-level store; close anything a test left open.
  if (screen.queryByRole("dialog")) fireEvent.keyDown(window, { key: "Escape" })
})

function roster(items: AdminOrgMemberListResponse["items"], nextCursor: string | null = null) {
  apiMock.adminListOrgMembers.mockResolvedValue({ items, nextCursor } satisfies AdminOrgMemberListResponse)
}

function renderPanel(org = makeOrg()) {
  return renderWithQuery(
    <>
      <MembersPanel org={org} />
      <DialogHost />
    </>,
  )
}

function rosterHead(): HTMLElement {
  return screen.getByText("Roster")
}

describe("MembersPanel roster", () => {
  it("counts the loaded rows against the organization's total while more pages exist", async () => {
    roster([member(SAM, "member")], "cur-2")
    renderPanel(makeOrg({ memberCount: 3 }))

    await screen.findByText("Sam Lee")
    expect(rosterHead()).toHaveTextContent("1 of 3")
  })

  it("counts the rows alone once every page is loaded", async () => {
    roster([member(OWNER, "owner"), member(SAM, "member")])
    renderPanel(makeOrg({ memberCount: 2 }))

    await screen.findByText("Sam Lee")
    expect(rosterHead()).toHaveTextContent(/^Roster\s*2$/)
  })

  it("names the organization's owner in the transfer prompt when the owner is not on the loaded page", async () => {
    roster([member(SAM, "member")], "cur-2")
    renderPanel(makeOrg({ owner: OWNER }))

    await userEvent.click(await screen.findByRole("button", { name: "Actions for Sam Lee" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Transfer ownership/ }))

    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("Rosa Park becomes an admin")
    expect(dialog).not.toHaveTextContent("the current owner")
  })
})

describe("MembersPanel row actions", () => {
  it("offers no actions on the owner's row, which the backend would refuse", async () => {
    roster([member(OWNER, "owner"), member(SAM, "member")])
    renderPanel()

    expect(await screen.findByRole("button", { name: "Actions for Rosa Park" })).toBeDisabled()
    expect(screen.getByText("Transfer ownership before changing this role or removing")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Actions for Sam Lee" })).toBeEnabled()
  })

  it("confirms a removal once the organization refetch lands after the roster dropped the member", async () => {
    useUiStore.setState({ toast: null })
    const org = makeOrg()
    let removed = false
    let releaseOrg!: (org: GetAdminOrgResponse) => void
    const orgRefetch = new Promise<GetAdminOrgResponse>((resolve) => {
      releaseOrg = resolve
    })
    apiMock.adminListOrgMembers.mockImplementation(async () => ({
      items: removed ? [member(OWNER, "owner")] : [member(OWNER, "owner"), member(SAM, "member")],
      nextCursor: null,
    }))
    apiMock.adminGetOrg.mockImplementation(() => (removed ? orgRefetch : Promise.resolve(org)))
    apiMock.adminRemoveOrgMember.mockImplementation(async () => {
      removed = true
      return { ok: true }
    })
    function OrgDetailObserver() {
      useOrg(org.id)
      return null
    }
    renderWithQuery(
      <>
        <OrgDetailObserver />
        <MembersPanel org={org} />
        <DialogHost />
      </>,
    )

    await userEvent.click(await screen.findByRole("button", { name: "Actions for Sam Lee" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Left the organization")
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove member" }))

    await waitFor(() => expect(screen.queryByText("Sam Lee")).not.toBeInTheDocument())
    await act(async () => {
      releaseOrg(org)
    })
    await waitFor(() =>
      expect(useUiStore.getState().toast).toMatchObject({
        text: `Sam Lee removed from ${org.name}`,
        tone: "ok",
      }),
    )
  })

  it("gives the menu's label and divider their menu roles", async () => {
    roster([member(OWNER, "owner"), member(SAM, "member")])
    renderPanel()
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Sam Lee" }))

    const menu = screen.getByRole("menu", { name: "Actions for Sam Lee" })
    expect(within(menu).getByRole("separator")).toBeInTheDocument()
    expect(within(menu).getByText("Change role")).toHaveAttribute("role", "presentation")
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent?.trim())).toEqual([
      "Transfer ownership",
      "Make admin",
      "Remove",
    ])
  })
})

describe("MembersPanel add member", () => {
  it("labels the person picker and links its error", async () => {
    roster([member(OWNER, "owner")])
    apiMock.listAdminUsers.mockReturnValue(new Promise(() => {}))
    renderPanel()
    await userEvent.click(await screen.findByRole("button", { name: /Add member/ }))

    await userEvent.click(screen.getByRole("button", { name: /Add member/ }))

    const person = screen.getByRole("group", { name: "Person" })
    expect(person).toHaveAccessibleDescription("Pick a user to add.")
  })
})
