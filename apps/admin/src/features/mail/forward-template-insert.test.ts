import { describe, expect, it } from "vitest"

import { insertAt } from "./forward-template-modal-state"

describe("inserting a template variable", () => {
  it("inserts into an empty field", () => {
    expect(insertAt("", 0, 0, "{title}")).toEqual({ value: "{title}", caret: 7 })
  })

  it("inserts at the caret in the middle of the text", () => {
    expect(insertAt("Report  here", 7, 7, "{title}")).toEqual({
      value: "Report {title} here",
      caret: 14,
    })
  })

  it("replaces the selected text", () => {
    expect(insertAt("Report NAME here", 7, 11, "{title}")).toEqual({
      value: "Report {title} here",
      caret: 14,
    })
  })
})
