import { describe, expect, it } from "vitest"

import {
  getForwardTemplateFields,
  getJurisdictionSort,
  getNeedsMappingCountDisplay,
} from "./discovery-ui-state"

describe("Jurisdictions UI state", () => {
  it("always uses oldest sort for the Need mapping filter", () => {
    expect(getJurisdictionSort("attention", "pop")).toBe("oldest")
    expect(getJurisdictionSort("attention", "reports")).toBe("oldest")
    expect(getJurisdictionSort("attention", "oldest")).toBe("oldest")
  })

  it("shows loading and unavailable count labels instead of false zeroes", () => {
    expect(getNeedsMappingCountDisplay({ count: null, isLoading: true, isError: false })).toBe("Loading…")
    expect(getNeedsMappingCountDisplay({ count: null, isLoading: false, isError: true })).toBe("—")
    expect(getNeedsMappingCountDisplay({ count: 0, isLoading: false, isError: false })).toBe(0)
  })

  it("builds the same template fields for draft and save-and-route payloads", () => {
    expect(getForwardTemplateFields(false, "Subject", "Body")).toEqual({})
    expect(getForwardTemplateFields(true, "Report {title}", "Please review {description}")).toEqual({
      forwardSubjectTemplate: "Report {title}",
      forwardBodyTemplate: "Please review {description}",
    })
    expect(getForwardTemplateFields(true, "  ", "")).toEqual({
      forwardSubjectTemplate: null,
      forwardBodyTemplate: null,
    })
  })
})
