import { render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Providers } from "@/components/providers"

vi.mock("@/components/auth/auth-hydrator", () => ({ AuthHydrator: () => null }))
vi.mock("@/hooks/use-admin-auth", () => ({
  useOperatorSession: () => ({ isOperator: true, operator: null, status: "authenticated" }),
}))

function Crash(): never {
  throw new Error("shell exploded")
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Providers", () => {
  it("renders the operator's app content", () => {
    render(
      <Providers>
        <p>Dashboard content</p>
      </Providers>,
    )
    expect(screen.getByText("Dashboard content")).toBeInTheDocument()
  })

  it("catches a render error anywhere in the app with a root alert offering Reload", () => {
    render(
      <Providers>
        <Crash />
      </Providers>,
    )

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Something went wrong")
    expect(alert).toHaveTextContent("shell exploded")
    expect(within(alert).getByRole("button", { name: "Reload" })).toBeInTheDocument()
  })
})
