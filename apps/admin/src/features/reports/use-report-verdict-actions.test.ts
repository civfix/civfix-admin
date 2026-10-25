import type { FilingStatus } from "@civfix/contract"
import { describe, expect, it, vi } from "vitest"

import { confirmDialog } from "@/components/shared/dialog"
import { filingDTO, reportDetail } from "@/test/filings"
import {
  reportVerdictActions,
  type ReportVerdictControls,
} from "@/features/reports/use-report-verdict-actions"

vi.mock("@/components/shared/dialog", () => ({ confirmDialog: vi.fn(() => Promise.resolve(false)) }))

const CANCELS = "This also cancels its city filing."

const controls = {
  verdictMutation: { mutate: vi.fn(), isPending: false },
} as unknown as ReportVerdictControls

async function rejectBody(status: FilingStatus | null): Promise<string> {
  vi.mocked(confirmDialog).mockClear()
  const filing = status === null ? null : filingDTO({ status })
  await reportVerdictActions(controls, reportDetail({ filing }), filing, () => {}).reject()
  return vi.mocked(confirmDialog).mock.calls[0]![0].body ?? ""
}

describe("reportVerdictActions(...).reject confirm body", () => {
  it.each<FilingStatus>(["queued", "needs_human"])(
    "T28: ends with the filing cancel for a %s filing",
    async (status) => {
      expect((await rejectBody(status)).endsWith(CANCELS)).toBe(true)
    },
  )

  it.each<[string, FilingStatus | null]>([
    ["running", "running"],
    ["submitted", "submitted"],
    ["no", null],
  ])("T28: says nothing of a cancel for a %s filing", async (_name, status) => {
    expect(await rejectBody(status)).not.toContain(CANCELS)
  })
})
