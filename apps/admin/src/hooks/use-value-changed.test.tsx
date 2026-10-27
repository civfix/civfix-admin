import * as React from "react"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useValueChanged } from "./use-value-changed"

function useResetCount(value: string | null): number {
  const [resets, setResets] = React.useState(0)
  const changed = useValueChanged(value)
  if (changed) setResets((n) => n + 1)
  return resets
}

describe("useValueChanged", () => {
  it("reports each change exactly once and never the first value", () => {
    const hook = renderHook<number, { value: string | null }>(({ value }) => useResetCount(value), {
      initialProps: { value: "a" },
    })
    expect(hook.result.current).toBe(0)

    hook.rerender({ value: "a" })
    expect(hook.result.current).toBe(0)

    hook.rerender({ value: "b" })
    expect(hook.result.current).toBe(1)

    hook.rerender({ value: "b" })
    expect(hook.result.current).toBe(1)

    hook.rerender({ value: null })
    expect(hook.result.current).toBe(2)
  })
})
