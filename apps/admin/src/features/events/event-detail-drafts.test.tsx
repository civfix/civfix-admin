import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { AdminEventDTO, AdminEventListItemDTO, AdminEventListResponse } from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { EventsPage } from "@/features/events/events-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

vi.mock("@/components/map/leaflet-map", () => ({
  LeafletMap: () => <div data-testid="leaflet-map" />,
}))

const BEACH = {
  id: "aaaa1111-0000-4000-8000-000000000001",
  title: "Beach sweep",
  status: "in_progress",
  eventKind: "cleanup",
  flagged: false,
  place: "Ocean Beach",
  attendees: 14,
  capacity: 20,
  bags: 0,
  organizer: { id: "u-org", name: "Olive Park", handle: "@olive", joined: "Mar 2026" },
  date: { rel: "today", abs: "Sep 24, 9:00 AM" },
  coords: [37.8, -122.26],
} satisfies AdminEventListItemDTO

const BEACH_DETAIL = {
  ...BEACH,
  desc: "About the beach sweep",
  address: "Ocean Beach main entrance",
  timeline: [],
  messages: [],
  linkedReports: [],
} satisfies AdminEventDTO

const PAGE = {
  items: [BEACH],
  nextCursor: null,
  counts: { all: 1, upcoming: 0, in_progress: 1, completed: 0, flagged: 0 },
} satisfies AdminEventListResponse

describe("EventDetail drafts", () => {
  it("keeps the attendee update and bags drafts through a failed detail refetch and its retry", async () => {
    apiMock.listAdminEvents.mockResolvedValue(PAGE)
    apiMock.getAdminEvent.mockResolvedValue(BEACH_DETAIL)
    const user = userEvent.setup()
    const { client } = renderWithQuery(<EventsPage focusId={null} />)

    const update = await screen.findByRole("textbox", { name: "Update for attendees" })
    await user.type(update, "Meet at the north lot")
    await user.type(screen.getByRole("spinbutton", { name: "Bags collected" }), "12")

    apiMock.getAdminEvent.mockRejectedValueOnce(new Error("Detail refetch failed"))
    await act(() => client.refetchQueries({ queryKey: queryKeys.events.detail(BEACH.id) }))
    const retry = await within(detailCard()).findByRole("button", { name: "Try again" })
    expect(screen.queryByRole("textbox", { name: "Update for attendees" })).toBeNull()

    await user.click(retry)
    expect(await screen.findByRole("textbox", { name: "Update for attendees" })).toHaveValue(
      "Meet at the north lot",
    )
    expect(screen.getByRole("spinbutton", { name: "Bags collected" })).toHaveValue(12)
  })
})
