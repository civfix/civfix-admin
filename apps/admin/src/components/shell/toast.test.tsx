import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ERROR_TOAST_MS, SUCCESS_TOAST_MS, Toast } from "@/components/shell/toast"
import { useUiStore } from "@/store/ui-store"
import { startFakeTimersWithUser } from "@/test/fake-timers"

function show(text: string, tone?: "ok" | "error"): void {
  act(() => useUiStore.getState().showToast(text, tone))
}

afterEach(() => {
  act(() => useUiStore.setState({ toast: null }))
})

describe("Toast", () => {
  it("keeps an empty status live region mounted while no toast is shown", () => {
    render(<Toast />)
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull()
  })

  it("announces the toast text through the same live region", () => {
    render(<Toast />)
    const region = screen.getByRole("status")
    show("Report removed")
    expect(screen.getByRole("status")).toBe(region)
    expect(region).toHaveTextContent("Report removed")
  })

  it("dismisses from a real, focusable Dismiss button, by keyboard too", async () => {
    const user = startFakeTimersWithUser()
    render(<Toast />)
    show("Saved")

    const dismiss = screen.getByRole("button", { name: "Dismiss" })
    expect(dismiss).toHaveAttribute("type", "button")
    dismiss.focus()
    expect(dismiss).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(useUiStore.getState().toast).toBeNull()
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull()
  })

  it("marks an error toast with the error tone", () => {
    render(<Toast />)
    show("Could not save", "error")
    expect(screen.getByRole("status")).toHaveClass("error")
    show("Saved")
    expect(screen.getByRole("status")).not.toHaveClass("error")
  })

  it("auto-dismisses a success toast after the success duration", () => {
    vi.useFakeTimers()
    try {
      render(<Toast />)
      show("Saved")
      act(() => vi.advanceTimersByTime(SUCCESS_TOAST_MS - 1))
      expect(screen.getByRole("status")).toHaveTextContent("Saved")
      act(() => vi.advanceTimersByTime(1))
      expect(useUiStore.getState().toast).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps an error toast up longer than a success toast", () => {
    vi.useFakeTimers()
    try {
      render(<Toast />)
      show("Could not save", "error")
      act(() => vi.advanceTimersByTime(SUCCESS_TOAST_MS))
      expect(screen.getByRole("status")).toHaveTextContent("Could not save")
      act(() => vi.advanceTimersByTime(ERROR_TOAST_MS - SUCCESS_TOAST_MS))
      expect(useUiStore.getState().toast).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("holds the toast while the pointer rests on it", async () => {
    const user = startFakeTimersWithUser()
    render(<Toast />)
    show("Saved")

    await user.hover(screen.getByRole("status"))
    act(() => vi.advanceTimersByTime(SUCCESS_TOAST_MS * 3))
    expect(screen.getByRole("status")).toHaveTextContent("Saved")

    await user.unhover(screen.getByRole("status"))
    act(() => vi.advanceTimersByTime(SUCCESS_TOAST_MS))
    expect(useUiStore.getState().toast).toBeNull()
  })
})
