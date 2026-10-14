import { describe, expect, it } from "vitest"

import { withCartoKey } from "./carto"

const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"

describe("withCartoKey", () => {
  it.each([undefined, "", "   "])("leaves the url untouched for the key %j", (key) => {
    expect(withCartoKey(TILE_URL, key)).toBe(TILE_URL)
  })

  it("appends a trimmed key", () => {
    expect(withCartoKey(TILE_URL, "  abc123 ")).toBe(`${TILE_URL}?key=abc123`)
  })

  it("encodes a key that carries query syntax", () => {
    expect(withCartoKey(TILE_URL, "a b&c=d")).toBe(`${TILE_URL}?key=a%20b%26c%3Dd`)
  })
})
