import { existsSync } from "node:fs"

import { describe, expect, it, vi } from "vitest"

vi.mock("next/font/google", () => {
  const font = () => ({ variable: "font" })
  return { Bricolage_Grotesque: font, Manrope: font, JetBrains_Mono: font }
})

describe("root layout metadata", () => {
  it("points the browser tab icon at the favicon the export ships", async () => {
    const { metadata } = await import("./layout")
    expect(metadata.icons).toEqual({ icon: "/favicon.svg" })
    expect(existsSync(new URL("../../public/favicon.svg", import.meta.url))).toBe(true)
  })
})
