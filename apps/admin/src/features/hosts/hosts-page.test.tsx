import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AdminBroadcastListItemDTO,
  AdminBroadcastListResponse,
  AdminHostListItemDTO,
  AdminHostListResponse,
} from "@civfix/shared"
import { describe, expect, it, onTestFinished, vi } from "vitest"

import { DialogHost } from "@/components/shared/dialog"
import type * as ApiModule from "@/lib/api"
import { HostsPage } from "@/features/hosts/hosts-page"
import { apiMock } from "@/test/api-mock"
import { startFakeTimersWithUser } from "@/test/fake-timers"
import { renderWithQuery } from "@/test/render"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

function actor(id: string, name: string, handle: string) {
  return { id, name, handle, joined: "2025-01-01T00:00:00.000Z" }
}

function host(overrides: Partial<AdminHostListItemDTO> & { id: string; name: string; handle: string }): AdminHostListItemDTO {
  const { id, name, handle, ...rest } = overrides
  return {
    host: actor(id, name, handle),
    messagingSuspended: false,
    suspendedAt: null,
    suspendedBy: null,
    windowDays: 30,
    broadcastCount: 12,
    recipientCount: 340,
    sentCount: 330,
    failedCount: 0,
    suppressedCount: 10,
    lastBroadcastAt: "2026-09-20T15:00:00.000Z",
    eventsMessaged: 3,
    ...rest,
  } satisfies AdminHostListItemDTO
}

const ada = host({ id: "h-ada", name: "Ada Lovelace", handle: "@ada" })
const cy = host({ id: "h-cy", name: "Cy Twombly", handle: "@cy" })
const bob = host({
  id: "h-bob",
  name: "Bob Builder",
  handle: "@bob",
  messagingSuspended: true,
  suspendedAt: "2026-09-18T10:00:00.000Z",
  suspendedBy: actor("op-1", "Olive Operator", "@olive"),
  broadcastCount: 1,
  recipientCount: 9,
  sentCount: 5,
  failedCount: 4,
  suppressedCount: 2,
  eventsMessaged: 1,
})

function page(items: AdminHostListItemDTO[], nextCursor: string | null = null): AdminHostListResponse {
  return { items, nextCursor } satisfies AdminHostListResponse
}

function broadcast(overrides: Partial<AdminBroadcastListItemDTO> & { id: string; cleanupId: string }): AdminBroadcastListItemDTO {
  return {
    eventTitle: "Park cleanup",
    kind: "host_broadcast",
    status: "sent",
    subjectHash: "abc123",
    createdBy: null,
    recipientCount: 40,
    sentCount: 38,
    failedCount: 2,
    suppressedCount: 0,
    channels: ["email", "push"],
    createdAt: "2026-09-19T12:00:00.000Z",
    finishedAt: "2026-09-19T12:05:00.000Z",
    ...overrides,
  } satisfies AdminBroadcastListItemDTO
}

function broadcasts(items: AdminBroadcastListItemDTO[], nextCursor: string | null = null): AdminBroadcastListResponse {
  return { items, nextCursor } satisfies AdminBroadcastListResponse
}

function listSection() {
  return screen.getByRole("heading", { name: "Hosts", level: 3 }).closest("section") as HTMLElement
}

function detailSection() {
  return listSection().nextElementSibling as HTMLElement
}

describe("HostsPage list states", () => {
  it("shows the loading state while the host list is in flight", async () => {
    apiMock.adminListHosts.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<HostsPage focusId={null} />)

    expect(screen.getByRole("heading", { name: "Host messaging", level: 1 })).toBeInTheDocument()
    expect(await screen.findByText("Loading hosts...")).toBeInTheDocument()
    expect(within(detailSection()).getByText("No host selected")).toBeInTheDocument()
  })

  it("shows the empty state when no host matches", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([]))
    renderWithQuery(<HostsPage focusId={null} />)

    expect(await screen.findByText("No hosts here")).toBeInTheDocument()
    expect(
      screen.getByText("No host matches this filter and search in the last 30 days."),
    ).toBeInTheDocument()
    expect(within(listSection()).getByText("0")).toBeInTheDocument()
    expect(within(detailSection()).getByText("No host selected")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("shows the error message with a retry that refetches", async () => {
    apiMock.adminListHosts.mockRejectedValue(new Error("Hosts backend down"))
    renderWithQuery(<HostsPage focusId={null} />)

    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText("Could not load this")).toBeInTheDocument()
    expect(within(alert).getByText("Hosts backend down")).toBeInTheDocument()

    apiMock.adminListHosts.mockResolvedValue(page([]))
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("No hosts here")).toBeInTheDocument()
  })

  it("renders rows with their counters and auto-selects the first host", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada, bob]))
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    renderWithQuery(<HostsPage focusId={null} />)

    const list = listSection()
    expect(await within(list).findByText("Ada Lovelace")).toBeInTheDocument()
    expect(within(list).getByText("@ada")).toBeInTheDocument()
    expect(within(list).getByText("12 broadcasts")).toBeInTheDocument()
    expect(within(list).getByText("340 recipients")).toBeInTheDocument()
    expect(within(list).getByText("3 events")).toBeInTheDocument()
    expect(within(list).getByText("Bob Builder")).toBeInTheDocument()
    expect(within(list).getByText("1 event")).toBeInTheDocument()
    expect(within(list).getByText("Suspended")).toBeInTheDocument()
    expect(within(list).getByText("4 failed")).toBeInTheDocument()
    expect(within(list).getByText("2")).toBeInTheDocument()

    const detail = detailSection()
    expect(await within(detail).findByRole("heading", { name: "Ada Lovelace", level: 2 })).toBeInTheDocument()
    expect(within(detail).getByText("Messaging active")).toBeInTheDocument()
    expect(within(detail).getByText("last 30 days")).toBeInTheDocument()
    expect(within(detail).getByText("10 suppressed")).toBeInTheDocument()
    expect(within(detail).getByRole("button", { name: "Suspend messaging" })).toBeInTheDocument()
    expect(apiMock.adminListHosts).toHaveBeenCalledWith({ q: undefined, windowDays: 30 })
  })
})

describe("HostsPage list accessibility", () => {
  it("selects a host row with Enter and with Space and marks the selected row as current", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada, bob]))
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    renderWithQuery(<HostsPage focusId={null} />)

    const list = listSection()
    const adaRow = await within(list).findByRole("button", { name: /^Ada Lovelace/ })
    const bobRow = within(list).getByRole("button", { name: /^Bob Builder/ })
    await waitFor(() => expect(adaRow).toHaveAttribute("aria-current", "true"))
    expect(bobRow).not.toHaveAttribute("aria-current")

    bobRow.focus()
    await userEvent.keyboard("{Enter}")
    expect(
      await within(detailSection()).findByRole("heading", { name: "Bob Builder", level: 2 }),
    ).toBeInTheDocument()
    expect(bobRow).toHaveAttribute("aria-current", "true")
    expect(adaRow).not.toHaveAttribute("aria-current")

    adaRow.focus()
    await userEvent.keyboard(" ")
    expect(
      await within(detailSection()).findByRole("heading", { name: "Ada Lovelace", level: 2 }),
    ).toBeInTheDocument()
  })

  it("names the search box", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([]))
    renderWithQuery(<HostsPage focusId={null} />)

    expect(screen.getByRole("textbox", { name: "Search hosts" })).toBeInTheDocument()
  })

  it("marks the list count as partial while more hosts can be loaded", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada], "cursor-2"))
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    renderWithQuery(<HostsPage focusId={null} />)

    expect(await within(listSection()).findByText("1+")).toBeInTheDocument()
  })
})

describe("HostsPage detail pane", () => {
  it("opens the clicked host with its suspension note and broadcast log", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada, bob]))
    apiMock.adminListBroadcasts.mockImplementation(async (params: { createdBy: string }) =>
      params.createdBy === "h-bob"
        ? broadcasts([
            broadcast({ id: "b-1", cleanupId: "ev-1", eventTitle: "River sweep" }),
            broadcast({ id: "b-2", cleanupId: "ev-1", eventTitle: null, status: "failed", channels: [] }),
          ])
        : broadcasts([]),
    )
    renderWithQuery(<HostsPage focusId={null} />)

    await userEvent.click(await within(listSection()).findByText("Bob Builder"))

    const detail = detailSection()
    expect(await within(detail).findByRole("heading", { name: "Bob Builder", level: 2 })).toBeInTheDocument()
    expect(within(detail).getByText("Messaging suspended")).toBeInTheDocument()
    expect(within(detail).getByText(/by Olive Operator\. The mandatory reason is in the/)).toBeInTheDocument()
    expect(within(detail).getByRole("button", { name: "Restore messaging" })).toBeInTheDocument()

    // The log row links the event and "Events reached" lists it once more, deduplicated by event.
    expect(await within(detail).findAllByRole("button", { name: "River sweep" })).toHaveLength(2)
    expect(within(detail).getAllByText("Host broadcast")).toHaveLength(2)
    expect(within(detail).getByText("Failed", { selector: ".pill" })).toBeInTheDocument()
    expect(within(detail).getByText("no channel")).toBeInTheDocument()
    expect(within(detail).getByText("email, push")).toBeInTheDocument()
    expect(within(detail).getByText(/This log is content-free by design/)).toBeInTheDocument()

    expect(apiMock.adminListBroadcasts).toHaveBeenLastCalledWith({
      createdBy: "h-bob",
      kind: "host_broadcast",
      from: expect.any(String),
    })
  })

  it("shows the empty broadcast log and no events for a host with nothing logged", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada]))
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    renderWithQuery(<HostsPage focusId={null} />)

    const detail = detailSection()
    expect(await within(detail).findByText("No broadcasts logged")).toBeInTheDocument()
    expect(within(detail).getByText("No events in the loaded log")).toBeInTheDocument()
  })

  it("shows a broadcast log error inside the detail pane", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada]))
    apiMock.adminListBroadcasts.mockRejectedValue(new Error("Log unavailable"))
    renderWithQuery(<HostsPage focusId={null} />)

    const alert = await within(detailSection()).findByRole("alert")
    expect(within(alert).getByText("Could not load this host's broadcasts")).toBeInTheDocument()
    expect(within(alert).getByText("Log unavailable")).toBeInTheDocument()
  })

  it("does not ask for more of a broadcast log that failed to load", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada]))
    apiMock.adminListBroadcasts.mockRejectedValue(new Error("Log unavailable"))
    renderWithQuery(<HostsPage focusId={null} />)

    const detail = detailSection()
    await within(detail).findByRole("alert")
    expect(within(detail).queryByText(/Load more of the broadcast log/)).not.toBeInTheDocument()
    expect(within(detail).queryByText("No events in the loaded log")).not.toBeInTheDocument()
    expect(within(detail).getByText("No events to show")).toBeInTheDocument()
  })

  it("pages the broadcast log with its cursor", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada]))
    apiMock.adminListBroadcasts
      .mockResolvedValueOnce(broadcasts([broadcast({ id: "b-1", cleanupId: "ev-1", eventTitle: "First event" })], "log-2"))
      .mockResolvedValueOnce(broadcasts([broadcast({ id: "b-2", cleanupId: "ev-2", eventTitle: "Second event" })]))
    renderWithQuery(<HostsPage focusId={null} />)

    const detail = detailSection()
    await userEvent.click(await within(detail).findByRole("button", { name: "Load more broadcasts" }))

    expect(await within(detail).findAllByRole("button", { name: "Second event" })).toHaveLength(2)
    expect(apiMock.adminListBroadcasts).toHaveBeenLastCalledWith({
      createdBy: "h-ada",
      kind: "host_broadcast",
      from: expect.any(String),
      cursor: "log-2",
    })
    expect(within(detail).queryByRole("button", { name: "Load more broadcasts" })).not.toBeInTheDocument()
  })

  it("navigates to the event from both the log row and the events reached list", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada]))
    apiMock.adminListBroadcasts.mockResolvedValue(
      broadcasts([broadcast({ id: "b-1", cleanupId: "ev-9", eventTitle: "Beach day" })]),
    )
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    onTestFinished(() => scrollTo.mockRestore())
    renderWithQuery(<HostsPage focusId={null} />)

    const links = await within(detailSection()).findAllByRole("button", { name: "Beach day" })
    expect(links).toHaveLength(2)
    for (const link of links) {
      window.history.pushState(null, "", "#/hosts")
      await userEvent.click(link)
      expect(window.location.hash).toBe("#/events/ev-9")
    }
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })

  it("opens the event from the broadcast log link with Enter and with Space", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada]))
    apiMock.adminListBroadcasts.mockResolvedValue(
      broadcasts([broadcast({ id: "b-1", cleanupId: "ev-9", eventTitle: "Beach day" })]),
    )
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    onTestFinished(() => scrollTo.mockRestore())
    renderWithQuery(<HostsPage focusId={null} />)

    const [logLink] = await within(detailSection()).findAllByRole("button", { name: "Beach day" })
    for (const key of ["{Enter}", " "]) {
      window.history.pushState(null, "", "#/hosts")
      logLink!.focus()
      await userEvent.keyboard(key)
      expect(window.location.hash).toBe("#/events/ev-9")
    }
  })

  it("clears the selection instead of jumping to another host when a suspended host leaves the Active list", async () => {
    let suspended = false
    apiMock.adminListHosts.mockImplementation(async (params: { suspended?: boolean }) =>
      params.suspended === false ? page(suspended ? [cy] : [ada, cy]) : page([ada, cy]),
    )
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    apiMock.adminSetHostMessagingSuspended.mockImplementation(async () => {
      suspended = true
      return {}
    })
    renderWithQuery(
      <>
        <HostsPage focusId={null} />
        <DialogHost />
      </>,
    )

    await within(listSection()).findByText("Ada Lovelace")
    await userEvent.click(screen.getByRole("button", { name: "Active" }))
    expect(
      await within(detailSection()).findByRole("heading", { name: "Ada Lovelace", level: 2 }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Suspend messaging" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox"), "Spamming attendees")
    await userEvent.click(within(dialog).getByRole("button", { name: "Suspend messaging" }))

    await waitFor(() => expect(within(listSection()).queryByText("Ada Lovelace")).not.toBeInTheDocument())
    const detail = detailSection()
    expect(await within(detail).findByText("No host selected")).toBeInTheDocument()
    expect(within(detail).queryByRole("heading", { level: 2 })).not.toBeInTheDocument()
    expect(within(detail).queryByRole("button", { name: "Suspend messaging" })).not.toBeInTheDocument()
  })

  it("suspends messaging with the typed reason", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada]))
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    apiMock.adminSetHostMessagingSuspended.mockResolvedValue({})
    renderWithQuery(
      <>
        <HostsPage focusId={null} />
        <DialogHost />
      </>,
    )

    await userEvent.click(await screen.findByRole("button", { name: "Suspend messaging" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Suspend messaging for Ada Lovelace?")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Suspend messaging" })).toBeDisabled()

    await userEvent.type(within(dialog).getByRole("textbox"), "  Spamming attendees  ")
    await userEvent.click(within(dialog).getByRole("button", { name: "Suspend messaging" }))

    await waitFor(() =>
      expect(apiMock.adminSetHostMessagingSuspended).toHaveBeenCalledWith({
        id: "h-ada",
        suspended: true,
        reason: "Spamming attendees",
      }),
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

describe("HostsPage filters, search and paging", () => {
  it("maps the filter chips to the suspended query param", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([]))
    renderWithQuery(<HostsPage focusId={null} />)
    await screen.findByText("No hosts here")

    await userEvent.click(screen.getByRole("button", { name: "Suspended" }))
    await waitFor(() =>
      expect(apiMock.adminListHosts).toHaveBeenLastCalledWith({ suspended: true, q: undefined, windowDays: 30 }),
    )

    await userEvent.click(screen.getByRole("button", { name: "Active" }))
    await waitFor(() =>
      expect(apiMock.adminListHosts).toHaveBeenLastCalledWith({ suspended: false, q: undefined, windowDays: 30 }),
    )

    await userEvent.click(screen.getByRole("button", { name: "All" }))
    await waitFor(() =>
      expect(apiMock.adminListHosts).toHaveBeenLastCalledWith({ q: undefined, windowDays: 30 }),
    )
  })

  it("debounces the search into a trimmed q param", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([]))
    renderWithQuery(<HostsPage focusId={null} />)
    await screen.findByText("No hosts here")
    const user = startFakeTimersWithUser()

    await user.type(screen.getByPlaceholderText(/Search host name or handle/), "  ada ")
    await act(async () => {
      vi.advanceTimersByTime(249)
    })
    expect(apiMock.adminListHosts).not.toHaveBeenCalledWith(expect.objectContaining({ q: expect.any(String) }))

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(apiMock.adminListHosts).toHaveBeenLastCalledWith({ q: "ada", windowDays: 30 })
  })

  it("loads the next page of hosts with the cursor", async () => {
    apiMock.adminListHosts
      .mockResolvedValueOnce(page([ada], "cursor-2"))
      .mockResolvedValueOnce(page([bob]))
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    renderWithQuery(<HostsPage focusId={null} />)

    await userEvent.click(await within(listSection()).findByRole("button", { name: "Load more" }))

    expect(await within(listSection()).findByText("Bob Builder")).toBeInTheDocument()
    expect(apiMock.adminListHosts).toHaveBeenLastCalledWith({ q: undefined, windowDays: 30, cursor: "cursor-2" })
    expect(within(listSection()).queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
    expect(within(listSection()).getByText("2")).toBeInTheDocument()
  })
})

describe("HostsPage deep link", () => {
  it("opens the focused host instead of the first row", async () => {
    apiMock.adminListHosts.mockResolvedValue(page([ada, bob]))
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    renderWithQuery(<HostsPage focusId="h-bob" />)

    expect(
      await within(detailSection()).findByRole("heading", { name: "Bob Builder", level: 2 }),
    ).toBeInTheDocument()
  })

  it("does not blame the loaded window when the host list itself failed", async () => {
    apiMock.adminListHosts.mockRejectedValue(new Error("Hosts backend down"))
    renderWithQuery(<HostsPage focusId="h-bob" />)

    await within(listSection()).findByRole("alert")
    const detail = detailSection()
    expect(within(detail).queryByText("That host is not in this window")).not.toBeInTheDocument()
    expect(within(detail).getByText("No host selected")).toBeInTheDocument()
  })

  it("does not show the deep-link explanation after a manual pick is searched out of the list", async () => {
    apiMock.adminListHosts.mockImplementation(async (params: { q?: string }) =>
      params.q ? page([]) : page([ada, bob]),
    )
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    renderWithQuery(<HostsPage focusId={null} />)

    await userEvent.click(await within(listSection()).findByText("Bob Builder"))
    await within(detailSection()).findByRole("heading", { name: "Bob Builder", level: 2 })
    await userEvent.type(screen.getByRole("textbox", { name: "Search hosts" }), "nobody")

    expect(await within(listSection()).findByText("No hosts here")).toBeInTheDocument()
    const detail = detailSection()
    expect(within(detail).queryByText("That host is not in this window")).not.toBeInTheDocument()
    expect(within(detail).getByText("No host selected")).toBeInTheDocument()
  })

  it("explains when the focused host is not in the loaded window and keeps holding it", async () => {
    apiMock.adminListHosts
      .mockResolvedValueOnce(page([ada], "cursor-2"))
      .mockResolvedValueOnce(page([bob]))
    apiMock.adminListBroadcasts.mockResolvedValue(broadcasts([]))
    renderWithQuery(<HostsPage focusId="h-bob" />)

    const detail = detailSection()
    expect(await within(detail).findByText("That host is not in this window")).toBeInTheDocument()
    expect(within(detail).queryByRole("heading", { level: 2 })).not.toBeInTheDocument()

    await userEvent.click(within(listSection()).getByRole("button", { name: "Load more" }))
    expect(await within(detail).findByRole("heading", { name: "Bob Builder", level: 2 })).toBeInTheDocument()
  })
})
