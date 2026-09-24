import { screen, within } from "@testing-library/react"
import type { AdminOrgEventListResponse } from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { queueRowOf } from "@/test/panes"
import { OrgEventsPanel } from "@/features/orgs/org-events-panel"
import { OWNER, makeOrg } from "@/features/orgs/test-fixtures"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

type OrgEvent = AdminOrgEventListResponse["items"][number]

function orgEvent(over: Partial<OrgEvent> = {}): OrgEvent {
  return {
    id: "ev-1",
    status: "upcoming",
    eventKind: "cleanup",
    flagged: false,
    title: "Riverbank sweep",
    place: "Echo Park",
    attendees: 4,
    capacity: 20,
    bags: 0,
    organizer: OWNER,
    date: { rel: "in 2 days", abs: "Oct 1" },
    coords: [34.07, -118.26],
    ...over,
  }
}

function eventsHead(): HTMLElement {
  return screen.getByText("Events", { selector: ".sub-head" })
}

describe("OrgEventsPanel", () => {
  it("marks a loaded page that has more behind it as a lower bound", async () => {
    apiMock.adminListOrgEvents.mockResolvedValue({ items: [orgEvent()], nextCursor: "cur-2" })
    renderWithQuery(<OrgEventsPanel org={makeOrg()} />)

    await screen.findByText("Riverbank sweep")
    expect(eventsHead()).toHaveTextContent(/^Events\s*1\+$/)
  })

  it("shows the plain count once every page is loaded", async () => {
    apiMock.adminListOrgEvents.mockResolvedValue({ items: [orgEvent()], nextCursor: null })
    renderWithQuery(<OrgEventsPanel org={makeOrg()} />)

    await screen.findByText("Riverbank sweep")
    expect(eventsHead()).toHaveTextContent(/^Events\s*1$/)
  })

  it("names the flagged marker", async () => {
    apiMock.adminListOrgEvents.mockResolvedValue({
      items: [orgEvent({ flagged: true })],
      nextCursor: null,
    })
    renderWithQuery(<OrgEventsPanel org={makeOrg()} />)

    const row = queueRowOf(await screen.findByText("Riverbank sweep"))
    expect(within(row).getByRole("img", { name: "Flagged" })).toBeInTheDocument()
  })
})
