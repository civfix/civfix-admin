import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SourceFooter } from "@/components/shell/source-footer"
import { SOURCE } from "@/lib/source"

describe("SourceFooter", () => {
  it("T1: links the developer page next to the source offer", () => {
    render(<SourceFooter />)

    expect(screen.getByRole("link", { name: "Developer" })).toHaveAttribute("href", "/dev/")
    expect(screen.getByRole("link", { name: "Source code (AGPL-3.0)" })).toHaveAttribute(
      "href",
      SOURCE.url,
    )
  })
})
