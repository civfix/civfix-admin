import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AdminReportDTO,
  AdminReportListItemDTO,
  AdminReportListResponse,
  ChatHistoryResponse,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { ReportsPage } from "@/features/reports/reports-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

vi.mock("@/components/map/leaflet-map", () => ({
  LeafletMap: () => <div data-testid="leaflet-map" />,
}))

const COUCH = {
  id: "r1a2b3c4-0000-4000-8000-000000000001",
  title: "Couch dumped on sidewalk",
  category: "trash",
  status: "published",
  flagged: false,
  place: "Temescal",
  reporter: { id: "u-rita", name: "Rita Gomez", handle: "@rita", joined: "Feb 2026" },
  confirmations: 0,
  submitted: { rel: "3h", abs: "Sep 23, 2026, 9:00 AM" },
  coords: [37.83, -122.26],
  address: "4900 Telegraph Ave",
  hasPhoto: false,
  thumbnailUrl: null,
} satisfies AdminReportListItemDTO

const COUCH_DETAIL = {
  ...COUCH,
  desc: "Description of the couch",
  timeline: [],
  city: {
    dept: "Oakland Public Works",
    place: COUCH.place,
    contact: "works@oaklandca.gov",
    routed: false,
  },
  media: [],
  linkedEvents: [],
  geoid: "0653000",
  outreach: { status: "sent", threadId: null, routedTo: "works@oaklandca.gov", routedAt: "2026-09-23T10:00:00Z" },
  referenceCode: "CF-R1A2",
  verificationVerdict: "approved",
  verifiedAt: "2026-09-23T10:00:00Z",
  reporterReportVerified: false,
} satisfies AdminReportDTO

const PAGE = {
  items: [COUCH],
  nextCursor: null,
  counts: { all: 1, submitted: 0, in_progress: 0, completed: 0, flagged: 0, needsVerification: 0 },
} satisfies AdminReportListResponse

const NO_CHAT = { items: [], nextCursor: null } satisfies ChatHistoryResponse

describe("ReportDetail drafts", () => {
  it("keeps the city message draft through a failed detail refetch and its retry", async () => {
    apiMock.listAdminReports.mockResolvedValue(PAGE)
    apiMock.getAdminReport.mockResolvedValue(COUCH_DETAIL)
    apiMock.adminReportMessages.mockResolvedValue(NO_CHAT)
    const user = userEvent.setup()
    const { client } = renderWithQuery(<ReportsPage focusId={null} />)

    const draft = await screen.findByRole("textbox", { name: "Message to the city" })
    expect(draft).toBeEnabled()
    await user.type(draft, "Any update on the couch?")

    apiMock.getAdminReport.mockRejectedValueOnce(new Error("Detail refetch failed"))
    await act(() => client.refetchQueries({ queryKey: queryKeys.reports.detail(COUCH.id) }))
    const retry = await within(detailCard()).findByRole("button", { name: "Try again" })
    expect(screen.queryByRole("textbox", { name: "Message to the city" })).toBeNull()

    await user.click(retry)
    expect(await screen.findByRole("textbox", { name: "Message to the city" })).toHaveValue(
      "Any update on the couch?",
    )
  })
})
