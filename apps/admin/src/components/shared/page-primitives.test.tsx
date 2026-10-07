import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { FilterChips } from "@/components/shared/page-primitives"

const OPTIONS = ["All", { value: "open", label: "Open", count: 3 }]

describe("FilterChips", () => {
  it("exposes which chip is selected as a pressed toggle button", () => {
    render(<FilterChips options={OPTIONS} value="open" onChange={() => undefined} />)

    expect(screen.getByRole("button", { name: "Open 3", pressed: true })).toHaveAttribute("type", "button")
    expect(screen.getByRole("button", { name: "All", pressed: false })).toHaveAttribute("type", "button")
  })

  it("groups the chips under the given label", () => {
    render(<FilterChips options={OPTIONS} value="All" onChange={() => undefined} ariaLabel="Status" />)

    const group = screen.getByRole("group", { name: "Status" })
    expect(group).toContainElement(screen.getByRole("button", { name: "All", pressed: true }))
  })

  it("reports the chosen value", async () => {
    const onChange = vi.fn()
    render(<FilterChips options={OPTIONS} value="All" onChange={onChange} />)

    await userEvent.setup().click(screen.getByRole("button", { name: "Open 3" }))
    expect(onChange).toHaveBeenCalledWith("open")
  })
})
