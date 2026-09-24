import { describe, expect, it } from "vitest"

import {
  isReportStatus,
  reportBucket,
  reportNeedsAttention,
  reportStatusView,
} from "./report-status"

describe("report status buckets", () => {
  it("recognizes only report statuses", () => {
    expect(isReportStatus("published")).toBe(true)
    expect(isReportStatus("resolved")).toBe(true)
    expect(isReportStatus("upcoming")).toBe(false)
    expect(isReportStatus("live")).toBe(false)
  })

  it("buckets an unknown status as awaiting action", () => {
    expect(reportBucket("published")).toBe("submitted")
    expect(reportBucket("in_progress")).toBe("in_progress")
    expect(reportBucket("resolved")).toBe("completed")
    expect(reportBucket("upcoming")).toBe("submitted")
  })

  it("needs attention for flagged pins and the awaiting-action bucket only", () => {
    expect(reportNeedsAttention("submitted", false)).toBe(true)
    expect(reportNeedsAttention("held", false)).toBe(true)
    expect(reportNeedsAttention("published", false)).toBe(true)
    expect(reportNeedsAttention("in_progress", false)).toBe(false)
    expect(reportNeedsAttention("resolved", false)).toBe(false)
    expect(reportNeedsAttention("resolved", true)).toBe(true)
    expect(reportNeedsAttention("live", false)).toBe(false)
  })

  it("labels the awaiting-action bucket Needs verification", () => {
    expect(reportStatusView("published").label).toBe("Needs verification")
  })

  it("reads an Object.prototype key as awaiting action, not as a status", () => {
    expect(reportStatusView("constructor").label).toBe("Needs verification")
  })
})
