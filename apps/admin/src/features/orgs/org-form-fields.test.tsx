import * as React from "react"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { renderWithQuery } from "@/test/render"
import { emptyProfileDraft, type OrgProfileDraft, type OrgProfileErrors } from "@/features/orgs/org-form"
import { OrgProfileFields, ReasonField } from "@/features/orgs/org-form-fields"

function Fields({
  errors = {},
  disabled = false,
}: {
  errors?: OrgProfileErrors
  disabled?: boolean
}) {
  const [draft, setDraft] = React.useState<OrgProfileDraft>(emptyProfileDraft)
  return (
    <OrgProfileFields
      draft={draft}
      errors={errors}
      onChange={setDraft}
      mode="create"
      disabled={disabled}
    />
  )
}

function describedByIdsResolve(el: HTMLElement): boolean {
  const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
  return ids.every((id) => document.getElementById(id) !== null)
}

describe("OrgProfileFields accessibility", () => {
  it("marks a field with an error invalid and describes it by that error", () => {
    renderWithQuery(<Fields errors={{ name: "A name is required.", websiteUrl: "Use https." }} />)

    const name = screen.getByLabelText("Name")
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(name).toHaveAccessibleDescription("A name is required.")
    expect(screen.getByLabelText(/^Website/)).toHaveAccessibleDescription("Use https.")
  })

  it("leaves a valid field unmarked", () => {
    renderWithQuery(<Fields />)

    const name = screen.getByLabelText("Name")
    expect(name).not.toHaveAttribute("aria-invalid")
    expect(name).not.toHaveAttribute("aria-describedby")
  })

  it("describes the slug by its hint, or by its error when the hint gives way to it", () => {
    const { unmount } = renderWithQuery(<Fields />)
    const slug = screen.getByLabelText(/^Slug/)
    expect(slug).toHaveAccessibleDescription("3–40 lowercase letters, digits and hyphens.")
    unmount()

    renderWithQuery(<Fields errors={{ slug: "That slug is taken." }} />)
    const taken = screen.getByLabelText(/^Slug/)
    expect(taken).toHaveAttribute("aria-invalid", "true")
    expect(taken).toHaveAccessibleDescription("That slug is taken.")
    expect(describedByIdsResolve(taken)).toBe(true)
  })

  it("describes the logo picker by its hint, or by its error", () => {
    const { unmount } = renderWithQuery(<Fields />)
    expect(screen.getByLabelText(/^Logo/)).toHaveAccessibleDescription(
      "Shown on the public page and next to every event the organization hosts.",
    )
    unmount()

    renderWithQuery(<Fields errors={{ logoMediaId: "Upload the logo again." }} />)
    const logo = screen.getByLabelText(/^Logo/)
    expect(logo).toHaveAttribute("aria-invalid", "true")
    expect(logo).toHaveAccessibleDescription("Upload the logo again.")
    expect(describedByIdsResolve(logo)).toBe(true)
  })

  it("links a social handle's error to its input", () => {
    renderWithQuery(<Fields errors={{ instagram: "Handles only." }} />)
    const instagram = screen.getByLabelText("Instagram")
    expect(instagram).toHaveAttribute("aria-invalid", "true")
    expect(instagram).toHaveAccessibleDescription("Handles only.")
  })

  it("links the reason's error to the reason box", () => {
    renderWithQuery(<ReasonField value="" onChange={() => {}} error="A reason is required." />)
    const reason = screen.getByLabelText(/^Reason/)
    expect(reason).toHaveAttribute("aria-invalid", "true")
    expect(reason).toHaveAccessibleDescription("A reason is required.")
  })
})

describe("OrgProfileFields slug reset", () => {
  it("disables Reset while the form is disabled", async () => {
    const { client, rerender } = renderWithQuery(<Fields />)
    await userEvent.type(screen.getByLabelText("Name"), "River Keepers")
    await userEvent.type(screen.getByLabelText(/^Slug/), "-la")
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled()

    rerender(
      <QueryClientProvider client={client}>
        <Fields disabled />
      </QueryClientProvider>,
    )

    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled()
  })
})
