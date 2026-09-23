import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./reports-page.tsx", import.meta.url), "utf8")

describe("official author in the report chat", () => {
  it("marks CivFix posts by the server's official flag, never by name or handle", () => {
    expect(source).toMatch(/msg\.from\?\.official && !removed/)
    expect(source).not.toMatch(/handle\s*===|name\s*===\s*"CivFix"/)
  })
})
