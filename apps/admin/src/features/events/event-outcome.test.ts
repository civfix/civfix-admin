import { describe, expect, it } from "vitest"

import { parseBags } from "./event-outcome"

describe("parseBags", () => {
  it.each([
    ["", null],
    ["   ", null],
    ["-1", null],
    ["0", 0],
    ["12", 12],
    ["2.5", null],
    ["1e3", 1000],
    ["100000", 100000],
    ["100001", null],
    ["abc", null],
  ])("parses %j as %j by the contract's rule", (input, expected) => {
    expect(parseBags(input)).toBe(expected)
  })
})
