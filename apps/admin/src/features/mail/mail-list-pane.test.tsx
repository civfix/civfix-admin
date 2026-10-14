import { act, render, screen } from "@testing-library/react"
import type { InboxFeedEmailItemDTO, MailThreadListItemDTO } from "@civfix/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MINUTE_MS } from "@/lib/timing"
import { MailListPane } from "@/features/mail/mail-list-pane"

const NOW = Date.parse("2026-09-20T15:00:00.000Z")
const FIVE_MINUTES_AGO = new Date(NOW - 5 * MINUTE_MS).toISOString()

const THREAD = {
  id: "t-1",
  dir: "out",
  from: "outreach@civfix.org",
  to: "works@oaklandca.gov",
  org: "Oakland Public Works",
  subject: "Pothole on 5th",
  preview: "Following up on the report",
  ts: FIVE_MINUTES_AGO,
  unread: false,
  status: "sent",
  jurisdictionGeoid: null,
  reportId: null,
} satisfies MailThreadListItemDTO

const EMAIL = {
  source: "email",
  id: "i-1",
  from: "resident@example.com",
  recipient: "support@civfix.org",
  localPart: "support",
  subject: "Photos of the dumping",
  preview: "See attached",
  ts: FIVE_MINUTES_AGO,
  status: "unread",
  unread: true,
  hasAttachments: false,
} satisfies InboxFeedEmailItemDTO

const SETTLED_LIST = {
  isLoading: false,
  isError: false,
  error: null,
  refetch: () => undefined,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: () => undefined,
}

function renderPane(outreach: boolean) {
  return render(
    <MailListPane
      outreach={outreach}
      box="all"
      feedFilter="all"
      searchTerm={undefined}
      stats={undefined}
      listQuery={SETTLED_LIST}
      activeCount={1}
      mailItems={[THREAD]}
      feedItems={[EMAIL]}
      selectedId={null}
      onSelect={() => undefined}
    />,
  )
}

describe("MailListPane row age labels", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ["outreach thread", true],
    ["inbox feed", false],
  ])("advances the %s age as the clock moves, with no other change", (_label, outreach) => {
    const { container } = renderPane(outreach)
    const age = () => container.querySelector(".mail-ts")?.textContent
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(age()).toBe("5m")

    act(() => {
      vi.advanceTimersByTime(MINUTE_MS)
    })
    expect(age()).toBe("6m")
  })
})
