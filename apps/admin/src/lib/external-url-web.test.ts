import { describe, expect, it } from "vitest"

import { isWebUrl } from "./external-url"

describe("web url guard", () => {
  it("accepts absolute http and https urls", () => {
    expect(isWebUrl("https://media.civfix.org/att/1?sig=abc")).toBe(true)
    expect(isWebUrl("http://localhost:8080/_local-storage/att/1")).toBe(true)
    expect(isWebUrl("HTTPS://MEDIA.CIVFIX.ORG/att/1")).toBe(true)
  })

  it("refuses relative, bare and protocol-relative values", () => {
    expect(isWebUrl("inbound/2026/att-1.pdf")).toBe(false)
    expect(isWebUrl("/att/1")).toBe(false)
    expect(isWebUrl("//evil.example/att")).toBe(false)
    expect(isWebUrl("media.civfix.org/att/1")).toBe(false)
  })

  it("refuses script, data and other schemes whatever their casing", () => {
    expect(isWebUrl("javascript:alert(1)")).toBe(false)
    expect(isWebUrl("JavaScript:alert(1)")).toBe(false)
    expect(isWebUrl(" javascript:alert(1)")).toBe(false)
    expect(isWebUrl("data:text/html,<script>alert(1)</script>")).toBe(false)
    expect(isWebUrl("file:///etc/passwd")).toBe(false)
    expect(isWebUrl("ftp://files.example/att")).toBe(false)
  })

  it("treats a missing url as unsafe", () => {
    expect(isWebUrl(null)).toBe(false)
    expect(isWebUrl(undefined)).toBe(false)
    expect(isWebUrl("")).toBe(false)
  })
})
