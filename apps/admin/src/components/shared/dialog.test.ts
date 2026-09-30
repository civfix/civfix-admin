import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./dialog.tsx", import.meta.url), "utf8")

describe("dialog host", () => {
  it("bounds the prompt textarea by the request's maxLength", () => {
    const textarea = source.match(/<textarea[\s\S]*?\/>/)?.[0] ?? ""
    expect(textarea).toContain("maxLength={current.maxLength}")
  })

  it("drops the cancel button only for an acknowledge-only confirm", () => {
    expect(source).toMatch(
      /\{!\(current\.kind === "confirm" && current\.acknowledgeOnly\) && \(\s*<button className="btn ghost" onClick=\{cancel\}>/,
    )
  })

  it("renders confirm details as a list under the body", () => {
    expect(source).toMatch(/current\.kind === "confirm" && current\.details[\s\S]*?<ul className="dialog-list">/)
  })
})
