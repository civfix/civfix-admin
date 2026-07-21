import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./home-page.tsx", import.meta.url), "utf8")
const previewRowSource = source.slice(source.indexOf("function PreviewRow"), source.indexOf("interface PreviewState"))
const sectionTileSource = source.slice(source.indexOf("function SectionTile"), source.indexOf("interface PreviewTile"))
const nativeButtonContents = (snippet: string) =>
  [...snippet.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((match) => match[1] ?? "")

describe("home tile accessibility structure", () => {
  it("uses native sibling controls without nested interactive roles", () => {
    expect(previewRowSource).toMatch(/<button\s+type="button"\s+className="slr"/)
    expect(sectionTileSource).toMatch(/<button\s+type="button"\s+className="stile-head"/)
    expect(sectionTileSource).toMatch(/<button\s+type="button"\s+className="stile-foot opens"/)

    expect(previewRowSource).not.toMatch(/role="button"|tabIndex|onKeyDown/)
    expect(sectionTileSource).not.toMatch(/role="button"|tabIndex|onKeyDown/)
    expect(nativeButtonContents(previewRowSource).every((content) => !/<div\b/.test(content))).toBe(true)
    expect(nativeButtonContents(sectionTileSource).every((content) => !/<div\b/.test(content))).toBe(true)
  })
})
