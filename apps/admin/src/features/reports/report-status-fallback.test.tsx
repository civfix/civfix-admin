import { within } from "@testing-library/react"
import type {
  AdminReportDTO,
  AdminReportListItemDTO,
  AdminReportListResponse,
  AdminReportStatus,
  ChatHistoryResponse,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard, listCard } from "@/test/panes"
import { ReportsPage } from "@/features/reports/reports-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

vi.mock("@/components/map/leaflet-map", () => ({
  LeafletMap: () => <div data-testid="leaflet-map" />,
}))

// The shared client hands back a body that fails its schema as-is, so a status added on the server
// after this build reaches the page untyped.
const ARCHIVED = {
  id: "r9a8b7c6-0000-4000-8000-000000000009",
  title: "Mattress by the creek",
  category: "trash",
  status: "archived" as AdminReportStatus,
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

const ARCHIVED_DETAIL = {
  ...ARCHIVED,
  desc: "Description of Mattress by the creek",
  timeline: [],
  city: { dept: "Oakland Public Works", place: "Temescal", contact: null, routed: false },
  media: [],
  linkedEvents: [],
  geoid: "0653000",
  outreach: { status: "not_sent", threadId: null, routedTo: null, routedAt: null },
  referenceCode: "CF-R9A8",
  verificationVerdict: null,
  verifiedAt: null,
  reporterReportVerified: false,
} satisfies AdminReportDTO

describe("ReportsPage with a status this build does not know", () => {
  it("renders the detail pane and offers no status transition", async () => {
    apiMock.listAdminReports.mockResolvedValue({
      items: [ARCHIVED],
      nextCursor: null,
      counts: {
        all: 1,
        submitted: 0,
        in_progress: 0,
        completed: 0,
        flagged: 0,
        needsVerification: 0,
      },
    } satisfies AdminReportListResponse)
    apiMock.getAdminReport.mockResolvedValue(ARCHIVED_DETAIL)
    apiMock.adminReportMessages.mockResolvedValue({
      items: [],
      nextCursor: null,
    } satisfies ChatHistoryResponse)
    renderWithQuery(<ReportsPage focusId={null} />)

    const card = detailCard()
    expect(
      await within(card).findByRole("heading", { name: "Mattress by the creek" }),
    ).toBeInTheDocument()
    expect(within(card).getByText("No status changes from archived")).toBeInTheDocument()
    for (const label of ["Acknowledged", "Under review", "Resolved", "Published"]) {
      expect(within(card).queryByRole("button", { name: label })).not.toBeInTheDocument()
    }
    expect(within(listCard()).getByText("Mattress by the creek")).toBeInTheDocument()
  })
})
