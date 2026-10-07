import type {
  AdminEventPageListItemDTO,
  AdminEventPageListQuery,
  EventPageDTO,
  EventPageStatus,
} from "@civfix/shared"

import { publicPagePath } from "@/features/pages/page-path"

export const PAGE_FILTERS = ["all", "published", "unpublished", "draft", "flagged"] as const
export type PageFilter = (typeof PAGE_FILTERS)[number]

function isPageFilter(value: string): value is PageFilter {
  return (PAGE_FILTERS as readonly string[]).includes(value)
}

export function pageListParams(
  filter: string,
  search: string,
): Pick<AdminEventPageListQuery, "status" | "flagged" | "q"> {
  const searchTerm = search.trim() || undefined
  if (!isPageFilter(filter) || filter === "all") return { q: searchTerm }
  if (filter === "flagged") return { flagged: true, q: searchTerm }
  return { status: filter satisfies EventPageStatus, q: searchTerm }
}

export function pageRowFromDTO(page: EventPageDTO): AdminEventPageListItemDTO {
  return {
    cleanupId: page.cleanupId,
    slug: page.slug,
    title: page.seo.title ?? (page.slug === null ? "Signup page" : publicPagePath(page.slug)),
    status: page.status,
    visibility: page.visibility,
    organizer: null,
    orgName: null,
    viewCount: page.viewCount ?? 0,
    publishedAt: page.publishedAt ?? null,
    flaggedAt: page.flaggedAt ?? null,
    flagReason: page.flagReason ?? null,
    flaggedBy: null,
  }
}
