import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { OperatorLogin } from "@/features/auth/operator-login"

vi.mock("@/hooks/use-admin-auth", () => ({
  useOperatorSession: () => ({ isOperator: false, operator: null, status: "forbidden" }),
  useOperatorBootstrap: () => () => Promise.resolve("forbidden"),
}))

describe("OperatorLogin", () => {
  it("states the not-authorized reason once, as an alert", () => {
    render(<OperatorLogin />)

    expect(screen.getByRole("heading", { name: "Not authorized" })).toBeInTheDocument()
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(
      "You signed in with Cloudflare Access, but this account is not authorized for the operator dashboard. Ask an administrator to add your email to the operator allowlist.",
    )
    expect(screen.getAllByText(/is not authorized for the operator dashboard/)).toHaveLength(1)
  })
})
