import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MINUTE_MS, SECOND_MS } from "@/lib/timing"
import { useNow } from "./use-now"

const START = Date.parse("2026-09-20T15:00:00.000Z")

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts at the current time and advances once per interval", () => {
    const hook = renderHook(() => useNow())
    expect(hook.result.current).toBe(START)

    act(() => {
      vi.advanceTimersByTime(MINUTE_MS - 1)
    })
    expect(hook.result.current).toBe(START)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(hook.result.current).toBe(START + MINUTE_MS)
  })

  it("honors a custom interval", () => {
    const hook = renderHook(() => useNow(SECOND_MS))
    act(() => {
      vi.advanceTimersByTime(SECOND_MS)
    })
    expect(hook.result.current).toBe(START + SECOND_MS)
  })

  it("clears its interval on unmount", () => {
    const hook = renderHook(() => useNow())
    expect(vi.getTimerCount()).toBe(1)
    hook.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
