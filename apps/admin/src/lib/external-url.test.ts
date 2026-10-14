import { describe, expect, it } from "vitest"

import { isHttpsUrl } from "./external-url"

describe("external url guard", () => {
  it("accepts only absolute https urls", () => {
    expect(isHttpsUrl("https://example.org/about")).toBe(true)
    expect(isHttpsUrl("http://example.org")).toBe(false)
    expect(isHttpsUrl("//example.org")).toBe(false)
    expect(isHttpsUrl("example.org")).toBe(false)
  })

  it("refuses script and data urls whatever their casing", () => {
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false)
    expect(isHttpsUrl("JavaScript:alert(1)")).toBe(false)
    expect(isHttpsUrl("data:text/html,<script>alert(1)</script>")).toBe(false)
  })

  it("still requires a parseable url", () => {
    expect(isHttpsUrl("https://example.org:99999/")).toBe(false)
  })

  it("treats a missing url as unsafe", () => {
    expect(isHttpsUrl(null)).toBe(false)
    expect(isHttpsUrl(undefined)).toBe(false)
    expect(isHttpsUrl("")).toBe(false)
  })
})
