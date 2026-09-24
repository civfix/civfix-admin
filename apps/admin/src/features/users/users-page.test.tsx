import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  AppError,
  ErrorCode,
  type AdminUserDTO,
  type AdminUserListItemDTO,
  type AdminUserListResponse,
  type UserEventItemDTO,
  type UserMessageItemDTO,
  type UserReportsResponse,
} from "@civfix/shared"
import { describe, expect, it, onTestFinished, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { startFakeTimersWithUser } from "@/test/fake-timers"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { UsersPage } from "@/features/users/users-page"
import { DialogHost } from "@/components/shared/dialog"
import { useUiStore } from "@/store/ui-store"

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

    const user = startFakeTimersWithUser()
    await user.type(screen.getByPlaceholderText("Search name, handle, city…"), "  ana ")
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(apiMock.listAdminUsers).toHaveBeenLastCalledWith({ q: "ana" })
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

  it("keeps a deep-linked focusId that is not on the first page selected", async () => {
    const CARA = listItem({ id: "u-cara", name: "Cara Lind" })
    apiMock.listAdminUsers.mockResolvedValue(page([ANA, BEN]))
    mockDetails(ANA, BEN, CARA)
    renderWithQuery(<UsersPage focusId="u-cara" />)
    expect(await within(detailCard()).findByRole("heading", { name: "Cara Lind" })).toBeInTheDocument()
    await within(accountsList()).findByText("Ana Ruiz")
    expect(within(detailCard()).getByRole("heading", { name: "Cara Lind" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Ana Ruiz" })).not.toBeInTheDocument()
  })
})

function resetShellAfterTest() {
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  onTestFinished(() => {
    scrollTo.mockRestore()
    useUiStore.setState({ page: "home", focusId: null, toast: null })
    window.history.replaceState(null, "", "#/")
  })
}

function rowOf(text: string): HTMLElement {
  const row = within(accountsList()).getByText(text).closest<HTMLElement>('[role="button"]')
  if (!row) throw new Error(`${text} has no keyboard-operable row`)
  return row
}

async function openActivityTab(label: string) {
  await userEvent.click(within(detailCard()).getByText(label))
}

function eventItem(over: Partial<UserEventItemDTO> & { id: string; title: string }) {
  return { place: "Lake Merritt", role: "member", attendees: 4, when: "Sat", ...over } satisfies UserEventItemDTO
}

function messageItem(over: Partial<UserMessageItemDTO> & { id: string; text: string }) {
  return {
    thread: "Beach day",
    when: "3d",
    source: "chat",
    sourceId: "ev-9",
    deletedAt: null,
    ...over,
  } satisfies UserMessageItemDTO
}

describe("UsersPage selection", () => {
  it("keeps the acted-on account open when the refetched list no longer holds it", async () => {
    let suspended = false
    apiMock.listAdminUsers.mockImplementation(async () => page(suspended ? [BEN] : [ANA, BEN]))
    apiMock.getAdminUser.mockImplementation(async ({ id }: { id: string }) =>
      id === ANA.id ? detail({ ...ANA, status: suspended ? "suspended" : "active" }) : detail(BEN),
    )
    apiMock.getUserReports.mockResolvedValue(NO_REPORTS)
    apiMock.setUserStatus.mockImplementation(async () => {
      suspended = true
      return {}
    })
    renderWithQuery(
      <>
        <UsersPage focusId={null} />
        <DialogHost />
      </>,
    )
    await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })

    await userEvent.click(within(detailCard()).getByRole("button", { name: /Suspend/ }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Suspend" }))

    await waitFor(() => expect(within(accountsList()).queryByText("Ana Ruiz")).not.toBeInTheDocument())
    expect(await within(detailCard()).findByRole("button", { name: /Reactivate/ })).toBeInTheDocument()
    expect(within(detailCard()).getByRole("heading", { name: "Ana Ruiz" })).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("heading", { name: "Ben Okafor" })).not.toBeInTheDocument()
  })

  it("selects the first row of the new list when a filter drops the selected account", async () => {
    apiMock.listAdminUsers.mockImplementation(async (params: { filter?: string }) =>
      page(params.filter === "suspended" ? [BEN] : [ANA, BEN]),
    )
    mockDetails(ANA, BEN)
    renderWithQuery(<UsersPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })

    await userEvent.click(screen.getByRole("button", { name: /^Suspended/ }))

    expect(await within(detailCard()).findByRole("heading", { name: "Ben Okafor" })).toBeInTheDocument()
  })

  it("selects a row from the keyboard and marks the selected row as current", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA, BEN]))
    mockDetails(ANA, BEN)
    renderWithQuery(<UsersPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })
    expect(rowOf("Ana Ruiz")).toHaveAttribute("aria-current", "true")
    expect(rowOf("Ben Okafor")).not.toHaveAttribute("aria-current")

    rowOf("Ben Okafor").focus()
    await userEvent.keyboard(" ")
    expect(await within(detailCard()).findByRole("heading", { name: "Ben Okafor" })).toBeInTheDocument()
    expect(rowOf("Ben Okafor")).toHaveAttribute("aria-current", "true")

    rowOf("Ana Ruiz").focus()
    await userEvent.keyboard("{Enter}")
    expect(await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })).toBeInTheDocument()
  })
})

describe("UsersPage list copy and search", () => {
  it("names the search box and drops a leading @ from the search term", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    renderWithQuery(<UsersPage focusId={null} />)
    await screen.findByText("Ana Ruiz")

    const user = startFakeTimersWithUser()
    await user.type(screen.getByRole("textbox", { name: "Search accounts" }), "@anaruiz")
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(apiMock.listAdminUsers).toHaveBeenLastCalledWith({ q: "anaruiz" })
  })

  it("names the flagged marker and pluralizes single counts", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([{ ...BEN, reports: 1, cleanups: 1 }]))
    mockDetails(BEN)
    renderWithQuery(<UsersPage focusId={null} />)
    await screen.findByText("Ben Okafor")
    expect(within(accountsList()).getByRole("img", { name: "Flagged" })).toBeInTheDocument()
    expect(within(accountsList()).getByText("1 report")).toBeInTheDocument()
    expect(within(accountsList()).getByText("1 cleanup")).toBeInTheDocument()
  })
})

describe("UsersPage account detail", () => {
  it("shows a not-found state without a retry when the account does not exist", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    apiMock.getAdminUser.mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND, "User not found", { httpStatus: 404 }),
    )
    renderWithQuery(<UsersPage focusId="u-gone" />)
    expect(await within(detailCard()).findByText("User not found")).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("says the copy failed when the clipboard is unavailable", async () => {
    resetShellAfterTest()
    const original = Object.getOwnPropertyDescriptor(window.navigator, "clipboard")
    Object.defineProperty(window.navigator, "clipboard", { configurable: true, get: () => undefined })
    onTestFinished(() => {
      if (original) Object.defineProperty(window.navigator, "clipboard", original)
      else delete (window.navigator as { clipboard?: unknown }).clipboard
    })
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    renderWithQuery(<UsersPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })

    fireEvent.click(within(detailCard()).getByRole("button", { name: /u-ana/ }))
    await waitFor(() => expect(useUiStore.getState().toast?.text).toBe("Couldn't copy. Select the ID manually."))
  })

  it("exposes the activity tabs as a tablist that arrow keys move through", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    apiMock.getUserEvents.mockResolvedValue({ items: [], nextCursor: null })
    renderWithQuery(<UsersPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })

    const tablist = within(detailCard()).getByRole("tablist", { name: "Activity" })
    const reportsTab = within(tablist).getByRole("tab", { name: /^Reports/ })
    const eventsTab = within(tablist).getByRole("tab", { name: /^Events/ })
    expect(reportsTab).toHaveAttribute("aria-selected", "true")
    expect(eventsTab).toHaveAttribute("aria-selected", "false")
    expect(eventsTab).toHaveAttribute("tabindex", "-1")
    expect(within(detailCard()).getByRole("tabpanel", { name: /^Reports/ })).toBeInTheDocument()

    reportsTab.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(eventsTab).toHaveAttribute("aria-selected", "true")
    expect(eventsTab).toHaveFocus()
    expect(await within(detailCard()).findByText("No cleanup events yet")).toBeInTheDocument()

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}")
    expect(within(tablist).getByRole("tab", { name: /^Messages/ })).toHaveAttribute("aria-selected", "true")
  })

  it("opens a profile report row with the Space key", async () => {
    resetShellAfterTest()
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    apiMock.getUserReports.mockResolvedValue({
      items: [
        { id: "r-1", title: "Broken bench", category: "other", status: "submitted", place: "Fresno", age: "2d" },
      ],
      nextCursor: null,
    } satisfies UserReportsResponse)
    renderWithQuery(<UsersPage focusId={null} />)
    const title = await within(detailCard()).findByText("Broken bench")

    const row = title.closest<HTMLElement>('[role="button"]')!
    row.focus()
    await userEvent.keyboard(" ")
    expect(useUiStore.getState()).toMatchObject({ page: "reports", focusId: "r-1" })
  })

  it("labels a co-hosted event as co-hosted and pluralizes a single attendee", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    apiMock.getUserEvents.mockResolvedValue({
      items: [eventItem({ id: "ev-1", title: "Beach day", role: "cohost", attendees: 1 })],
      nextCursor: null,
    })
    renderWithQuery(<UsersPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })

    await openActivityTab("Events")
    expect(await within(detailCard()).findByText("Co-hosted the Beach day")).toBeInTheDocument()
    expect(within(detailCard()).getByText("Co-host")).toBeInTheDocument()
    expect(within(detailCard()).getByText(/1 neighbor joined/)).toBeInTheDocument()
  })

  it("labels a removed message neutrally and keeps block content out of the row button", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    apiMock.getUserMessages.mockResolvedValue({
      items: [messageItem({ id: "m-1", text: "gone now", deletedAt: "2026-09-01T00:00:00.000Z" })],
      nextCursor: null,
    })
    renderWithQuery(<UsersPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })

    await openActivityTab("Messages")
    const text = await within(detailCard()).findByText(/gone now/)
    expect(within(detailCard()).getByText("Removed")).toBeInTheDocument()
    expect(within(detailCard()).queryByText(/deleted by user/)).not.toBeInTheDocument()
    const button = text.closest("button")!
    expect(button.querySelector("div")).toBeNull()
  })

  it("pages through a user's messages with Load more", async () => {
    apiMock.listAdminUsers.mockResolvedValue(page([ANA]))
    mockDetails(ANA)
    apiMock.getUserMessages.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "m-c2"
        ? { items: [messageItem({ id: "m-2", text: "older message" })], nextCursor: null }
        : { items: [messageItem({ id: "m-1", text: "newest message" })], nextCursor: "m-c2" },
    )
    renderWithQuery(<UsersPage focusId={null} />)
    await within(detailCard()).findByRole("heading", { name: "Ana Ruiz" })

    await openActivityTab("Messages")
    await within(detailCard()).findByText(/newest message/)
    await userEvent.click(within(detailCard()).getByRole("button", { name: "Load more" }))

    expect(await within(detailCard()).findByText(/older message/)).toBeInTheDocument()
    expect(apiMock.getUserMessages).toHaveBeenLastCalledWith({ id: "u-ana", cursor: "m-c2" })
    expect(within(detailCard()).getByText(/newest message/)).toBeInTheDocument()
    expect(within(detailCard()).queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })
})
