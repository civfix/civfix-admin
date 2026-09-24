import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AdminEventDTO,
  AdminEventListItemDTO,
  AdminEventListResponse,
  AdminReportListItemDTO,
  AdminReportListResponse,
} from "@civfix/shared"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { AppShell } from "@/components/shell/app-shell"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { useUiStore } from "@/store/ui-store"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

vi.mock("@/components/map/leaflet-map", () => ({
  LeafletMap: () => <div data-testid="leaflet-map" />,
}))

const EVENT = {
  id: "aaaa1111-0000-4000-8000-000000000001",
  title: "Beach sweep",
  status: "upcoming",
  eventKind: "cleanup",
  flagged: false,
  place: "Ocean Beach",
  attendees: 4,
  capacity: null,
  bags: 0,
  organizer: { id: "u-org", name: "Olive Park", handle: "@olive", joined: "Mar 2026" },
  date: { rel: "in 3 days", abs: "Sep 26, 9:00 AM" },
  coords: [37.8, -122.26],
} satisfies AdminEventListItemDTO

const REPORT = {
  id: "r-1",
  title: "Trash pile by the pier",
  category: "trash",
  status: "published",
  flagged: false,
  place: "Ocean Beach",
  reporter: { id: "u-rita", name: "Rita Gomez", handle: "@rita", joined: "Feb 2026" },
  confirmations: 0,
  submitted: { rel: "3h", abs: "Sep 23, 2026, 9:00 AM" },
  coords: [37.8, -122.26],
  address: "Great Hwy",
  hasPhoto: false,
  thumbnailUrl: null,
} satisfies AdminReportListItemDTO

const TITLE = "Link reports"

// Rendered inside the real shell so its global "Escape goes home" handler is live.
async function openPicker() {
  apiMock.listAdminEvents.mockResolvedValue({
    items: [EVENT],
    nextCursor: null,
    counts: { all: 1, upcoming: 1, in_progress: 0, completed: 0, flagged: 0 },
  } satisfies AdminEventListResponse)
  apiMock.getAdminEvent.mockResolvedValue({
    ...EVENT,
    desc: "About the sweep",
    address: "Ocean Beach main entrance",
    timeline: [],
    messages: [],
    linkedReports: [],
  } satisfies AdminEventDTO)
  apiMock.listAdminReports.mockResolvedValue({
    items: [REPORT],
    nextCursor: null,
  } as AdminReportListResponse)
  const user = userEvent.setup()
  renderWithQuery(<AppShell />)
  const opener = await screen.findByRole("button", { name: "Link reports" })
  await user.click(opener)
  const dialog = screen.getByRole("dialog", { name: TITLE })
  await within(dialog).findByText(REPORT.title)
  return { user, opener, dialog }
}

function overlayOf(dialog: HTMLElement): HTMLElement {
  const overlay = dialog.parentElement
  if (!overlay) throw new Error("dialog has no overlay")
  return overlay
}

function reportRow(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole("button", { name: new RegExp(REPORT.title) })
}

beforeEach(() => {
  window.history.replaceState(null, "", "#/events")
  useUiStore.setState({ page: "events", focusId: null })
})

describe("Events link-reports modal", () => {
  it("is a labelled modal dialog with a named close button", async () => {
    const { dialog } = await openPicker()
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument()
  })

  it("starts in the search field and keeps Tab inside the dialog", async () => {
    const { user, dialog } = await openPicker()
    expect(within(dialog).getByPlaceholderText("Search title, place, reporter…")).toHaveFocus()

    for (let i = 0; i < 8; i++) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
    for (let i = 0; i < 8; i++) {
      await user.tab({ shift: true })
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it("keeps a selection on Escape from a button and does not send the shell home", async () => {
    const { user, dialog } = await openPicker()
    await user.click(reportRow(dialog))
    expect(within(dialog).getByText("1 selected")).toBeInTheDocument()

    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: TITLE })).toBeInTheDocument()
    expect(screen.getByText("1 selected")).toBeInTheDocument()
    expect(window.location.hash).toBe("#/events")
    expect(useUiStore.getState().page).toBe("events")
  })

  it("keeps a selection on a backdrop click", async () => {
    const { user, dialog } = await openPicker()
    await user.click(reportRow(dialog))

    await user.click(overlayOf(dialog))

    expect(screen.getByRole("dialog", { name: TITLE })).toBeInTheDocument()
    expect(screen.getByText("1 selected")).toBeInTheDocument()
  })

  it("closes with nothing selected on Escape without leaving Events, and restores focus", async () => {
    const { user, opener, dialog } = await openPicker()
    within(dialog).getByRole("button", { name: "Cancel" }).focus()

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(window.location.hash).toBe("#/events")
    expect(useUiStore.getState().page).toBe("events")
    expect(opener).toHaveFocus()
  })

  it("closes with nothing selected on a backdrop click", async () => {
    const { user, dialog } = await openPicker()
    await user.click(overlayOf(dialog))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("drops a selection only through the close button, and returns focus to the opener", async () => {
    const { user, opener, dialog } = await openPicker()
    await user.click(reportRow(dialog))

    await user.click(within(dialog).getByRole("button", { name: "Close" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
  })
})
