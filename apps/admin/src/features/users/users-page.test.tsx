import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AdminUserDTO,
  AdminUserListItemDTO,
  AdminUserListResponse,
  UserReportsResponse,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { UsersPage } from "@/features/users/users-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

function listItem(over: Partial<AdminUserListItemDTO> & { id: string; name: string }) {
  return {
    handle: "@handle",
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

const ANA = listItem({
  id: "u-ana",
  name: "Ana Ruiz",
  handle: "@anaruiz",
  city: "Fresno",
  reports: 3,
  cleanups: 2,
})
const BEN = listItem({
  id: "u-ben",
  name: "Ben Okafor",
  handle: "@benok",
  status: "suspended",
  flagged: true,
  reports: 1,
  cleanups: 0,
})

function page(items: AdminUserListItemDTO[], nextCursor: string | null = null) {
  return {
    items,
    nextCursor,
    counts: { all: 12, active: 9, suspended: 1, flagged: 2, deleted: 0, banned: 0 },
  } satisfies AdminUserListResponse
}

function detail(item: AdminUserListItemDTO): AdminUserDTO {
  return {
    ...item,
    role: "citizen",
    messages: 4,
    reportVerified: false,
    organizations: [],
  } satisfies AdminUserDTO
}

const NO_REPORTS = { items: [], nextCursor: null } satisfies UserReportsResponse

function mockDetails(...users: AdminUserListItemDTO[]) {
  apiMock.getAdminUser.mockImplementation(async ({ id }: { id: string }) => {
    const u = users.find((x) => x.id === id)
    if (!u) throw new Error(`no user ${id}`)
    return detail(u)
  })
  apiMock.getUserReports.mockResolvedValue(NO_REPORTS)
}

function accountsList() {
  return screen.getByRole("heading", { name: "Accounts" }).closest("section") as HTMLElement
}

describe("UsersPage", () => {
  it("shows the loading state while the first page is in flight", () => {
    apiMock.listAdminUsers.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<UsersPage focusId={null} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading accounts...")
    expect(within(detailCard()).getByText("No user selected")).toBeInTheDocument()
  })

  it("shows the empty copy when no account matches", async () => {
    apiMock.listAdminUsers.mockResolvedValue({ items: [], nextCursor: null })
    renderWithQuery(<UsersPage focusId={null} />)
    expect(await screen.findByText("Nothing matches")).toBeInTheDocument()
    expect(screen.getByText("Try a different filter or search.")).toBeInTheDocument()
    expect(within(detailCard()).getByText("Pick an account from the list.")).toBeInTheDocument()
  })

  it("shows the error state with the failure message and a retry", async () => {
    apiMock.listAdminUsers.mockRejectedValue(new Error("Users backend unreachable"))
    renderWithQuery(<UsersPage focusId={null} />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("Users backend unreachable")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("renders rows with key fields and auto-selects the first account into the detail pane", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA, BEN]))
    mockDetails(ANA, BEN)
    renderWithQuery(<UsersPage focusId={null} />)

    await screen.findByText("Ana Ruiz")
    const listCard = accountsList()
    expect(within(listCard).getByText("Ana Ruiz")).toBeInTheDocument()
    expect(within(listCard).getByText("@anaruiz")).toBeInTheDocument()
    expect(within(listCard).getByText("Fresno")).toBeInTheDocument()
    expect(within(listCard).getByText("3 reports")).toBeInTheDocument()
    expect(within(listCard).getByText("2 cleanups")).toBeInTheDocument()
    expect(within(listCard).getByText("Ben Okafor")).toBeInTheDocument()
    expect(within(listCard).getByText("Suspended")).toBeInTheDocument()
    expect(within(listCard).getByTitle("Flagged")).toBeInTheDocument()

    expect(apiMock.listAdminUsers).toHaveBeenCalledWith({})
    expect(await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })).toBeInTheDocument()
    expect(within(detailCard()).getByText("u-ana")).toBeInTheDocument()
    expect(within(detailCard()).getByText(/Risk: Low/)).toBeInTheDocument()
    expect(within(detailCard()).getByRole("button", { name: /Ban account/ })).toBeInTheDocument()
    expect(await within(detailCard()).findByText("No reports yet")).toBeInTheDocument()
    expect(apiMock.getAdminUser).toHaveBeenCalledWith({ id: "u-ana" })
    expect(apiMock.getUserReports).toHaveBeenCalledWith({ id: "u-ana" })
  })

  it("opens the clicked account in the detail pane", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA, BEN]))
    mockDetails(ANA, BEN)
    renderWithQuery(<UsersPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })

    await userEvent.click(within(accountsList()).getByText("Ben Okafor"))

    const card = detailCard()
    expect(await within(card).findByRole("heading", { name: "Ben Okafor" })).toBeInTheDocument()
    // Both the status badge and the toggled flag button read "Flagged".
    expect(within(card).getAllByText("Flagged")).toHaveLength(2)
    expect(within(card).getByRole("button", { name: "Flagged" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Reactivate/ })).toBeInTheDocument()
    expect(apiMock.getAdminUser).toHaveBeenCalledWith({ id: "u-ben" })
  })

  it("shows the facet counts on the filter chips", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    renderWithQuery(<UsersPage focusId={null} />)
    await screen.findByText("Ana Ruiz")
    expect(screen.getByRole("button", { name: "All 12" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Flagged 2" })).toBeInTheDocument()
  })

  it("sends the chosen filter chip to the api", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    renderWithQuery(<UsersPage focusId={null} />)
    await screen.findByText("Ana Ruiz")

    await userEvent.click(screen.getByRole("button", { name: /^Flagged/ }))
    await waitFor(() =>
      expect(apiMock.listAdminUsers).toHaveBeenLastCalledWith({ filter: "flagged" }),
    )

    await userEvent.click(screen.getByRole("button", { name: /^Deleted/ }))
    await waitFor(() =>
      expect(apiMock.listAdminUsers).toHaveBeenLastCalledWith({ filter: "deleted" }),
    )

    await userEvent.click(screen.getByRole("button", { name: /^All/ }))
    await waitFor(() => expect(apiMock.listAdminUsers).toHaveBeenLastCalledWith({}))
  })

  it("sends the trimmed search text to the api after the debounce", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    renderWithQuery(<UsersPage focusId={null} />)
    await screen.findByText("Ana Ruiz")

    await userEvent.type(screen.getByPlaceholderText("Search name, handle, city…"), "  ana ")
    await waitFor(() => expect(apiMock.listAdminUsers).toHaveBeenLastCalledWith({ q: "ana" }))
  })

  it("shows Load more when a cursor is returned and fetches the next page with it", async () => {
    apiMock.listAdminUsers.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "cur-2" ? page([BEN]) : page([ANA], "cur-2"),
    )
    mockDetails(ANA, BEN)
    renderWithQuery(<UsersPage focusId={null} />)
    await screen.findByText("Ana Ruiz")

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(accountsList()).findByText("Ben Okafor")).toBeInTheDocument()
    expect(apiMock.listAdminUsers).toHaveBeenLastCalledWith({ cursor: "cur-2" })
    expect(within(accountsList()).getByText("Ana Ruiz")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("hides Load more when there is no cursor", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    renderWithQuery(<UsersPage focusId={null} />)
    await screen.findByText("Ana Ruiz")
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("opens a deep-linked focusId that is on the first page", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA, BEN]))
    mockDetails(ANA, BEN)
    renderWithQuery(<UsersPage focusId="u-ben" />)
    expect(await within(detailCard()).findByRole("heading", { name: "Ben Okafor" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Ana Ruiz" })).not.toBeInTheDocument()
  })

  it("replaces a deep-linked focusId that is not on the first page with the first row (current behavior)", async () => {
    const CARA = listItem({ id: "u-cara", name: "Cara Lind" })
    apiMock.listAdminUsers.mockResolvedValue(page([ANA, BEN]))
    mockDetails(ANA, BEN, CARA)
    renderWithQuery(<UsersPage focusId="u-cara" />)
    expect(await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Cara Lind" })).not.toBeInTheDocument()
  })
})
