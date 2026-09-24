import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  AdminEventPageListItemDTO,
  AdminEventPageListResponse,
  AdminGetEventPageResponse,
} from "@civfix/shared"

import { DialogHost } from "@/components/shared/dialog"
import { Toast } from "@/components/shell/toast"
import type * as ApiModule from "@/lib/api"
import { useUiStore } from "@/store/ui-store"
import { apiMock } from "@/test/api-mock"
import { startFakeTimersWithUser } from "@/test/fake-timers"
import { queueRowOf } from "@/test/panes"
import { renderWithQuery } from "@/test/render"
import { PagesPage } from "@/features/pages/pages-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const ECHO_ID = "11111111-1111-4111-8111-111111111111"
const RIVER_ID = "22222222-2222-4222-8222-222222222222"
const LAKE_ID = "33333333-3333-4333-8333-333333333333"
const ORPHAN_ID = "44444444-4444-4444-8444-444444444444"

const echoPage = {
  cleanupId: ECHO_ID,
  slug: "echo-park-cleanup",
  title: "Echo Park Cleanup",
  status: "published",
  visibility: "public",
  organizer: { id: "u1", name: "Rosa Marquez", handle: "rosa", joined: "2026-01-02T00:00:00.000Z" },
  orgName: "Friends of Echo Park",
  viewCount: 1234,
  publishedAt: "2026-09-01T17:00:00.000Z",
  flaggedAt: null,
  flagReason: null,
  flaggedBy: null,
} satisfies AdminEventPageListItemDTO

const riverPage = {
  cleanupId: RIVER_ID,
  slug: "river-day",
  title: "LA River Day",
  status: "unpublished",
  visibility: "unlisted",
  organizer: null,
  orgName: null,
  viewCount: 42,
  publishedAt: null,
  flaggedAt: "2026-09-10T12:00:00.000Z",
  flagReason: "Fundraising link points at a personal account",
  flaggedBy: { id: "op1", name: "Operator Ann", handle: "ann", joined: "2025-05-05T00:00:00.000Z" },
} satisfies AdminEventPageListItemDTO

const lakePage = {
  cleanupId: LAKE_ID,
  slug: null,
  title: "Silver Lake Sweep",
  status: "draft",
  visibility: "private",
  organizer: null,
  orgName: "Silver Lake Neighbors",
  viewCount: 0,
  publishedAt: null,
  flaggedAt: null,
  flagReason: null,
  flaggedBy: null,
} satisfies AdminEventPageListItemDTO

function listPage(
  items: AdminEventPageListItemDTO[],
  nextCursor: string | null = null,
): AdminEventPageListResponse {
  return { items, nextCursor }
}

function eventPage(
  cleanupId: string,
  overrides: Partial<AdminGetEventPageResponse> = {},
): AdminGetEventPageResponse {
  return {
    cleanupId,
    slug: "echo-park-cleanup",
    status: "published",
    theme: { accent: "bloom" },
    blocks: [
      {
        id: "b1",
        kind: "about",
        title: "About the day",
        body: "Bring gloves and water.",
      },
    ],
    seo: { title: "Echo Park Cleanup", description: "Monthly lakeside sweep", noindex: false },
    visibility: "public",
    publishedAt: "2026-09-01T17:00:00.000Z",
    flaggedAt: null,
    flagReason: null,
    viewCount: 1234,
    ...overrides,
  }
}

function listPane(): HTMLElement {
  const section = screen.getByRole("heading", { level: 3, name: "Pages" }).closest("section")
  if (!section) throw new Error("list heading is not inside a section")
  return section
}

function detailPane(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name: title })
  const section = heading.closest("section")
  if (!section) throw new Error("detail heading is not inside a section")
  return section
}

afterEach(() => {
  useUiStore.setState({ toast: null })
})

describe("PagesPage list states", () => {
  it("shows the loading state while the list is in flight", async () => {
    apiMock.adminListEventPages.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<PagesPage focusId={null} />)

    expect(await screen.findByText("Loading pages...")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Signup pages" })).toBeInTheDocument()
    expect(screen.getByText("No page selected")).toBeInTheDocument()
  })

  it("shows the empty state when no page matches", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([]))
    renderWithQuery(<PagesPage focusId={null} />)

    expect(await screen.findByText("No pages loaded")).toBeInTheDocument()
    expect(
      screen.getByText("Nothing on the loaded pages matches this filter or search."),
    ).toBeInTheDocument()
    expect(screen.getByText("No page selected")).toBeInTheDocument()
    expect(screen.getByText("Pick a page from the list.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("shows the error message with a retry that refetches", async () => {
    apiMock.adminListEventPages.mockRejectedValueOnce(new Error("pages backend unavailable"))
    renderWithQuery(<PagesPage focusId={null} />)

    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText("Could not load this")).toBeInTheDocument()
    expect(within(alert).getByText("pages backend unavailable")).toBeInTheDocument()

    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage]))
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))

    expect(await screen.findByRole("heading", { level: 2, name: "Echo Park Cleanup" })).toBeInTheDocument()
    expect(apiMock.adminListEventPages).toHaveBeenCalledTimes(2)
  })

  it("renders rows with their key fields and opens the first page in the detail pane", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage, riverPage, lakePage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id)),
    )
    renderWithQuery(<PagesPage focusId={null} />)

    const list = listPane()
    expect(await within(list).findByText("/e/echo-park-cleanup")).toBeInTheDocument()
    expect(within(list).getByText("/e/river-day")).toBeInTheDocument()
    expect(within(list).getByText("no slug")).toBeInTheDocument()
    expect(within(list).getByText("1,234 views")).toBeInTheDocument()
    expect(within(list).getByText("42 views")).toBeInTheDocument()
    expect(within(list).getByText("Public")).toBeInTheDocument()
    expect(within(list).getByText("Unlisted")).toBeInTheDocument()
    expect(within(list).getByText("Private")).toBeInTheDocument()
    expect(within(list).getByText("Rosa Marquez")).toBeInTheDocument()
    expect(within(list).getByText("Friends of Echo Park")).toBeInTheDocument()
    expect(within(list).getByText("Silver Lake Neighbors")).toBeInTheDocument()
    expect(within(list).getByText("Published")).toBeInTheDocument()
    expect(within(list).getByText("Unpublished")).toBeInTheDocument()
    expect(within(list).getByText("Draft")).toBeInTheDocument()
    expect(within(list).getByText("3")).toBeInTheDocument()

    const detail = detailPane("Echo Park Cleanup")
    expect(within(detail).getByText("/e/echo-park-cleanup")).toBeInTheDocument()
    expect(within(detail).getByText("Public")).toBeInTheDocument()
    expect(within(detail).getByText("1,234")).toBeInTheDocument()
    expect(within(detail).getByText("Friends of Echo Park")).toBeInTheDocument()
    expect(within(detail).getByText("Rosa Marquez")).toBeInTheDocument()
    expect(within(detail).getByRole("button", { name: "Flag" })).toBeEnabled()
    expect(within(detail).getByRole("button", { name: "Unpublish" })).toBeEnabled()
    expect(within(detail).getByRole("button", { name: /Open the event/ })).toBeInTheDocument()

    expect(await within(detail).findByText("Monthly lakeside sweep")).toBeInTheDocument()
    expect(within(detail).getByText("About the day")).toBeInTheDocument()
    expect(within(detail).getByText("Bring gloves and water.")).toBeInTheDocument()
    expect(within(detail).getByText(/^\/e\/echo-park-cleanup · theme bloom · indexable$/)).toBeInTheDocument()
    expect(apiMock.adminGetEventPage).toHaveBeenCalledWith({ id: ECHO_ID })
  })

  it("selecting a row swaps the detail pane to that page", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage, riverPage, lakePage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id, { slug: "river-day", seo: { title: null, noindex: true } })),
    )
    renderWithQuery(<PagesPage focusId={null} />)

    await userEvent.click(await screen.findByText("LA River Day"))

    const detail = detailPane("LA River Day")
    expect(screen.queryByRole("heading", { level: 2, name: "Echo Park Cleanup" })).not.toBeInTheDocument()
    expect(within(detail).getByText("/e/river-day")).toBeInTheDocument()
    // Once as the header badge, once as the flag row label.
    expect(within(detail).getAllByText("Flagged")).toHaveLength(2)
    expect(within(detail).getByText(/Operator Ann/)).toBeInTheDocument()
    expect(
      within(detail).getByText("Fundraising link points at a personal account"),
    ).toBeInTheDocument()
    expect(within(detail).getByRole("button", { name: "Clear flag" })).toBeEnabled()
    expect(within(detail).getByRole("button", { name: "Unpublish" })).toBeDisabled()
    expect(await within(detail).findByText(/^\/e\/river-day · theme bloom · noindex$/)).toBeInTheDocument()
  })

  it("shows the draft crumb for a page without a slug", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage, lakePage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id, { slug: null, status: "draft", blocks: [] })),
    )
    renderWithQuery(<PagesPage focusId={null} />)

    await userEvent.click(await screen.findByText("Silver Lake Sweep"))

    const detail = detailPane("Silver Lake Sweep")
    expect(within(detail).getByText("unpublished draft")).toBeInTheDocument()
    expect(await within(detail).findByText("No blocks")).toBeInTheDocument()
    expect(within(detail).getByText(/no public slug · theme bloom · indexable/)).toBeInTheDocument()
  })
})

describe("PagesPage list accessibility", () => {
  it("selects a page row with Enter and with Space and marks the selected row as current", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage, riverPage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id)),
    )
    renderWithQuery(<PagesPage focusId={null} />)

    const list = listPane()
    const echoRow = await within(list).findByRole("button", { name: /^Echo Park Cleanup/ })
    const riverRow = within(list).getByRole("button", { name: /^LA River Day/ })
    await waitFor(() => expect(echoRow).toHaveAttribute("aria-current", "true"))
    expect(riverRow).not.toHaveAttribute("aria-current")

    riverRow.focus()
    await userEvent.keyboard("{Enter}")
    expect(await screen.findByRole("heading", { level: 2, name: "LA River Day" })).toBeInTheDocument()
    expect(riverRow).toHaveAttribute("aria-current", "true")
    expect(echoRow).not.toHaveAttribute("aria-current")

    echoRow.focus()
    await userEvent.keyboard(" ")
    expect(await screen.findByRole("heading", { level: 2, name: "Echo Park Cleanup" })).toBeInTheDocument()
  })

  it("names the search box and the flagged marker", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([riverPage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id)),
    )
    renderWithQuery(<PagesPage focusId={null} />)

    expect(screen.getByRole("textbox", { name: "Search signup pages" })).toBeInTheDocument()
    expect(await within(listPane()).findByRole("img", { name: "Flagged" })).toBeInTheDocument()
  })

  it("marks the list count as partial while more pages can be loaded", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage], "cursor-2"))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id)),
    )
    renderWithQuery(<PagesPage focusId={null} />)

    expect(await within(listPane()).findByText("1+")).toBeInTheDocument()
  })
})

describe("PagesPage moderation", () => {
  function renderWithChrome() {
    return renderWithQuery(
      <>
        <PagesPage focusId={null} />
        <DialogHost />
        <Toast />
      </>,
    )
  }

  it("names a flagged page by its public /e path in the toast", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id)),
    )
    apiMock.adminFlagEventPage.mockResolvedValue({})
    renderWithChrome()

    await userEvent.click(await screen.findByRole("button", { name: "Flag" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Copied a city logo")
    await userEvent.click(within(dialog).getByRole("button", { name: "Flag page" }))

    expect(await screen.findByText("Flagged · /e/echo-park-cleanup")).toBeInTheDocument()
  })

  it("names a page without a slug by its title in the toast", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([lakePage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id, { slug: null, status: "draft" })),
    )
    apiMock.adminUnpublishEventPage.mockResolvedValue({})
    renderWithChrome()

    await userEvent.click(await screen.findByRole("button", { name: "Unpublish" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Impersonates a city agency")
    await userEvent.click(within(dialog).getByRole("button", { name: "Unpublish page" }))

    expect(await screen.findByText("Unpublished · Silver Lake Sweep")).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(LAKE_ID))).not.toBeInTheDocument()
  })

  it("clears the selection instead of jumping to another page when an unpublished page leaves the Published list", async () => {
    const otherPublished = { ...riverPage, status: "published", flaggedAt: null, flagReason: null, flaggedBy: null } satisfies AdminEventPageListItemDTO
    let unpublished = false
    apiMock.adminListEventPages.mockImplementation(async () =>
      listPage(unpublished ? [otherPublished] : [echoPage, otherPublished]),
    )
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id)),
    )
    apiMock.adminUnpublishEventPage.mockImplementation(async () => {
      unpublished = true
      return {}
    })
    renderWithChrome()

    await screen.findByRole("heading", { level: 2, name: "Echo Park Cleanup" })
    await userEvent.click(screen.getByRole("button", { name: "Unpublish" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Impersonates a city agency")
    await userEvent.click(within(dialog).getByRole("button", { name: "Unpublish page" }))

    await waitFor(() =>
      expect(within(listPane()).queryByText("Echo Park Cleanup")).not.toBeInTheDocument(),
    )
    expect(await screen.findByText("No page selected")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument()
  })

  it("keeps a manually picked page open, read by id, after a filter drops it from the list", async () => {
    apiMock.adminListEventPages.mockImplementation(async (params: { status?: string }) =>
      listPage(params.status === "draft" ? [lakePage] : [echoPage, riverPage]),
    )
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(
        eventPage(id, id === RIVER_ID ? { slug: "river-day", seo: { title: "LA River Day", noindex: false } } : {}),
      ),
    )
    renderWithQuery(<PagesPage focusId={null} />)

    await userEvent.click(await within(listPane()).findByText("LA River Day"))
    await screen.findByRole("heading", { level: 2, name: "LA River Day" })

    await userEvent.click(screen.getByRole("button", { name: "Draft" }))
    const lakeRow = await within(listPane()).findByText("Silver Lake Sweep")

    expect(await screen.findByRole("heading", { level: 2, name: "LA River Day" })).toBeInTheDocument()
    expect(queueRowOf(lakeRow)).not.toHaveAttribute("aria-current")
    expect(apiMock.adminGetEventPage).toHaveBeenCalledWith({ id: RIVER_ID })
  })
})

describe("PagesPage paging, filters and search", () => {
  it("requests published pages first and loads the next page with the cursor", async () => {
    apiMock.adminListEventPages
      .mockResolvedValueOnce(listPage([echoPage], "cursor-2"))
      .mockResolvedValueOnce(listPage([riverPage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id)),
    )
    renderWithQuery(<PagesPage focusId={null} />)

    await within(listPane()).findByText("/e/echo-park-cleanup")
    expect(apiMock.adminListEventPages).toHaveBeenNthCalledWith(1, { status: "published" })

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(listPane()).findByText("/e/river-day")).toBeInTheDocument()
    expect(apiMock.adminListEventPages).toHaveBeenNthCalledWith(2, {
      status: "published",
      cursor: "cursor-2",
    })
    expect(within(listPane()).getByText("/e/echo-park-cleanup")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
    expect(within(listPane()).getByText("2")).toBeInTheDocument()
  })

  it("maps each filter chip onto the list params", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([]))
    renderWithQuery(<PagesPage focusId={null} />)
    await screen.findByText("No pages loaded")

    await userEvent.click(screen.getByRole("button", { name: "All" }))
    await waitFor(() => expect(apiMock.adminListEventPages).toHaveBeenLastCalledWith({}))

    await userEvent.click(screen.getByRole("button", { name: "Unpublished" }))
    await waitFor(() =>
      expect(apiMock.adminListEventPages).toHaveBeenLastCalledWith({ status: "unpublished" }),
    )

    await userEvent.click(screen.getByRole("button", { name: "Draft" }))
    await waitFor(() =>
      expect(apiMock.adminListEventPages).toHaveBeenLastCalledWith({ status: "draft" }),
    )

    await userEvent.click(screen.getByRole("button", { name: "Flagged" }))
    await waitFor(() =>
      expect(apiMock.adminListEventPages).toHaveBeenLastCalledWith({ flagged: true }),
    )
  })

  it("sends the trimmed search after the debounce, keeping the active filter", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([]))
    renderWithQuery(<PagesPage focusId={null} />)
    await screen.findByText("No pages loaded")
    const user = startFakeTimersWithUser()

    await user.type(screen.getByPlaceholderText(/Search slug or title/), "  echo ")
    await act(async () => {
      vi.advanceTimersByTime(249)
    })
    expect(apiMock.adminListEventPages).not.toHaveBeenCalledWith(
      expect.objectContaining({ q: expect.any(String) }),
    )

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(apiMock.adminListEventPages).toHaveBeenLastCalledWith({ status: "published", q: "echo" })
    expect(apiMock.adminListEventPages).toHaveBeenCalledWith(expect.objectContaining({ q: expect.any(String) }))
  })
})

describe("PagesPage deep links", () => {
  it("opens the focused page when it is in the first page of results", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage, riverPage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(eventPage(id, { slug: "river-day" })),
    )
    renderWithQuery(<PagesPage focusId={RIVER_ID} />)

    expect(await screen.findByRole("heading", { level: 2, name: "LA River Day" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2, name: "Echo Park Cleanup" })).not.toBeInTheDocument()
  })

  it("fetches the focused page on its own when it is not in the loaded list", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage]))
    apiMock.adminGetEventPage.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve(
        eventPage(id, {
          slug: "orphan-sweep",
          status: "unpublished",
          visibility: "unlisted",
          seo: { title: "Orphan Sweep", noindex: false },
          viewCount: 7,
          flaggedAt: "2026-09-12T08:00:00.000Z",
          flagReason: "Copied a city logo",
        }),
      ),
    )
    renderWithQuery(<PagesPage focusId={ORPHAN_ID} />)

    const heading = await screen.findByRole("heading", { level: 2, name: "Orphan Sweep" })
    expect(heading).toBeInTheDocument()
    expect(apiMock.adminGetEventPage).toHaveBeenCalledWith({ id: ORPHAN_ID })

    const detail = detailPane("Orphan Sweep")
    expect(within(detail).getByText("/e/orphan-sweep")).toBeInTheDocument()
    expect(within(detail).getByText("Unlisted")).toBeInTheDocument()
    expect(within(detail).getByText("Copied a city logo")).toBeInTheDocument()
    expect(within(detail).getByRole("button", { name: "Unpublish" })).toBeDisabled()
    expect(screen.queryByRole("heading", { level: 2, name: "Echo Park Cleanup" })).not.toBeInTheDocument()
    expect(within(listPane()).getByText("/e/echo-park-cleanup")).toBeInTheDocument()
  })

  it("shows the linked-page error when the focused page cannot be fetched", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage]))
    apiMock.adminGetEventPage.mockRejectedValue(new Error("page not found"))
    renderWithQuery(<PagesPage focusId={ORPHAN_ID} />)

    expect(await screen.findByText("Could not load the linked page")).toBeInTheDocument()
    expect(screen.getByText("page not found")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument()
  })

  it("shows the linked-page loader while the focused page is in flight", async () => {
    apiMock.adminListEventPages.mockResolvedValue(listPage([echoPage]))
    apiMock.adminGetEventPage.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<PagesPage focusId={ORPHAN_ID} />)

    expect(await screen.findByText("Loading the linked page...")).toBeInTheDocument()
  })
})
