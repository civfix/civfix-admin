import type { AdminFilingDTO, AdminReportDTO, FilingEvidenceDTO, GetFilingResponse } from "@civfix/contract"

import type { ReportFiling } from "@/features/filings/use-filings"

export const REPORT_ID = "r1a2b3c4-0000-4000-8000-000000000001"
export const FILING_ID = "f1a2b3c4-0000-4000-8000-000000000001"

export function filingDTO(over: Partial<ReportFiling> = {}): ReportFiling {
  return {
    id: FILING_ID,
    reportId: REPORT_ID,
    reportTitle: "Couch dumped on sidewalk",
    referenceCode: "CF-R1A2",
    geoid: "0644000",
    jurisdictionName: "Los Angeles",
    category: "trash",
    channel: "portal",
    portalHost: "myla311.lacity.gov",
    status: "queued",
    method: null,
    reason: null,
    reasonDetail: null,
    caseId: null,
    caseUrl: null,
    cityClosedAt: null,
    attempts: 0,
    scriptVersion: null,
    dryRun: false,
    ticketText: "Couch dumped on sidewalk\n\nReported by a resident via CivFix · ref CF-R1A2",
    createdAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-20T11:00:00.000Z",
    submittedAt: null,
    ...over,
  }
}

export function getFilingResponse(
  filing: ReportFiling,
  evidence: FilingEvidenceDTO[] = [],
): GetFilingResponse {
  return { filing: { ...filing, evidence } }
}

export function filingRow(over: Partial<AdminFilingDTO> & { id: string }): AdminFilingDTO {
  return { ...filingDTO(), ...over }
}

export function reportDetail(over: Partial<AdminReportDTO> = {}): AdminReportDTO {
  return {
    id: REPORT_ID,
    title: "Couch dumped on sidewalk",
    category: "trash",
    status: "published",
    flagged: false,
    place: "Los Angeles",
    reporter: { id: "u-rita", name: "Rita Gomez", handle: "@rita", joined: "Feb 2026" },
    confirmations: 0,
    submitted: { rel: "3h", abs: "Oct 20, 2026, 9:00 AM" },
    coords: [34.05, -118.25],
    address: "200 N Spring St",
    hasPhoto: false,
    thumbnailUrl: null,
    desc: "A couch on the sidewalk",
    timeline: [{ who: "Rita", what: "submitted the report", when: "3h ago", kind: "submit" }],
    city: { dept: "LA Sanitation", place: "Los Angeles", contact: null, routed: false },
    media: [],
    linkedEvents: [],
    geoid: "0644000",
    outreach: { status: "not_sent", threadId: null, routedTo: null, routedAt: null },
    referenceCode: "CF-R1A2",
    verificationVerdict: null,
    verifiedAt: null,
    reporterReportVerified: false,
    ...over,
  }
}
