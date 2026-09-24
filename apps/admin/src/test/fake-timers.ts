import userEvent, { type UserEvent } from "@testing-library/user-event"
import { onTestFinished, vi } from "vitest"

// Testing Library only detects Jest's fake timers: its async wrapper drains with a `setTimeout(0)`
// that never fires under vitest's fakes unless a `jest` global can advance the clock.
export function startFakeTimersWithUser(): UserEvent {
  vi.useFakeTimers()
  vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  onTestFinished(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}
