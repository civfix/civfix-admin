import type { EventPageStatus, EventVisibility } from "@civfix/shared"

interface PageStatusView {
  label: string
  cls: string
}

const PAGE_STATUS_VIEW: Record<EventPageStatus, PageStatusView> = {
  draft: { label: "Draft", cls: "priority-low" },
  published: { label: "Published", cls: "status-ok" },
  unpublished: { label: "Unpublished", cls: "status-flag" },
}

export function pageStatusView(status: EventPageStatus): PageStatusView {
  return Object.hasOwn(PAGE_STATUS_VIEW, status) ? PAGE_STATUS_VIEW[status] : { label: status, cls: "priority-low" }
}

export const VISIBILITY_LABEL: Record<EventVisibility, string> = {
  public: "Public",
  unlisted: "Unlisted",
  private: "Private",
}
