import type {
  GetForwardTemplateDefaultResponse,
  JurisdictionDirectoryDTO,
  JurisdictionGeometryResponse,
} from "@civfix/contract"

import { apiMock } from "@/test/api-mock"

const DAY_MS = 24 * 60 * 60 * 1000

export function jurisdiction(
  overrides: Partial<JurisdictionDirectoryDTO> = {},
): JurisdictionDirectoryDTO {
  return {
    geoid: "0644000",
    org: "Los Angeles",
    dept: null,
    email: null,
    form: null,
    method: "none",
    status: "pending",
    coverage: "City limits",
    lastRouted: null,
    layer: "place",
    population: 3_898_747,
    reportsWaiting: 4,
    perCategoryCounts: { trash: 3, graffiti: 1 },
    contacts: [],
    flaggedAt: null,
    handle: null,
    oldestReportAt: new Date(Date.now() - 3 * DAY_MS).toISOString(),
    forwardSubjectTemplate: null,
    forwardBodyTemplate: null,
    ...overrides,
  } satisfies JurisdictionDirectoryDTO
}

const GEOMETRY = {
  geoid: "0644000",
  layer: "place",
  geometry: { type: "Polygon", coordinates: [] },
  bbox: [-118.7, 33.7, -118.1, 34.3],
  point: { lat: 34.05, lng: -118.25 },
} as unknown as JurisdictionGeometryResponse

/** The queries a mapped jurisdiction's detail makes besides the directory list. */
export function mockDetailQueries(): void {
  apiMock.getJurisdictionGeometry.mockResolvedValue(GEOMETRY)
  apiMock.getForwardTemplateDefault.mockResolvedValue({
    subjectTemplate: null,
    bodyTemplate: null,
    updatedAt: null,
  } satisfies GetForwardTemplateDefaultResponse)
  apiMock.listFilingRoutes.mockResolvedValue({ routes: [] })
}
