import { render, screen } from "@testing-library/react"
import { AppError, ErrorCode } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { ErrorState } from "@/components/shared/data-states"

describe("ErrorState", () => {
  it("shows the API's own message", () => {
    render(<ErrorState error={new AppError(ErrorCode.FORBIDDEN, "Operators only")} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Operators only")
  })

  it("explains a failed request in plain words instead of the browser's fetch text", () => {
    render(<ErrorState error={new TypeError("Failed to fetch")} />)
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Could not reach the server. Check your connection and try again.")
    expect(alert).not.toHaveTextContent("Failed to fetch")
  })

  it("shows the generic copy for a thrown non-error value", () => {
    render(<ErrorState error="boom" />)
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.")
  })

  it("lets an explicit message replace the error's", () => {
    render(<ErrorState error={new TypeError("Failed to fetch")} message="Custom copy" />)
    expect(screen.getByRole("alert")).toHaveTextContent("Custom copy")
  })
})
