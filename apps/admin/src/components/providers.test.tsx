import { render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Providers } from "@/components/providers"

vi.mock("@/components/auth/auth-hydrator", () => ({ AuthHydrator: () => null }))
const session = vi.hoisted(() => ({
  current: { isOperator: true, operator: null, status: "authenticated" } as {
    isOperator: boolean
    operator: null
    status: string
  },
}))

vi.mock("@/hooks/use-admin-auth", () => ({
  useOperatorSession: () => session.current,
}))

function Crash(): never {
  throw new Error("shell exploded")
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  session.current = { isOperator: true, operator: null, status: "authenticated" }
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
    expect(alert).toHaveTextContent(
      "This page hit an unexpected error. Try again, or reload the dashboard.",
    )
    expect(alert).not.toHaveTextContent("shell exploded")
    expect(within(alert).getByRole("button", { name: "Reload" })).toBeInTheDocument()
  })

  it("shows a signing-out screen rather than the sign-in gate while signing out", () => {
    session.current = { isOperator: false, operator: null, status: "signing-out" }
    render(
      <Providers>
        <p>Dashboard content</p>
      </Providers>,
    )

    expect(screen.getByRole("status")).toHaveTextContent("Signing out...")
    expect(screen.queryByText("Dashboard content")).toBeNull()
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
  })
})
