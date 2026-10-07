import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { idOf, resolveSelected, useSelection, type SelectionOptions } from "./use-selection"

type Row = { id: string; label?: string }

const A: Row = { id: "a" }
const B: Row = { id: "b" }
const C: Row = { id: "c" }

const SETTLED = { isSuccess: true, isFetching: false }
const FETCHING = { isSuccess: true, isFetching: true }
const LOADING = { isSuccess: false, isFetching: true }

type Props = Partial<SelectionOptions<Row, string>>

function setup(initial: Props = {}) {
  const base: SelectionOptions<Row, string> = {
    focusId: null,
    list: SETTLED,
    items: [A, B],
    getId: idOf,
    listKey: "all",
    ...initial,
  }
  return renderHook((props: Props) => useSelection({ ...base, ...props }), { initialProps: {} })
}

describe("useSelection", () => {
  it("auto-picks the first row once the first load settles", () => {
    const hook = setup({ list: LOADING, items: [] })
    expect(hook.result.current.selectedId).toBeNull()

    hook.rerender({ list: FETCHING, items: [A, B] })
    expect(hook.result.current.selectedId).toBeNull()

    hook.rerender({ list: SETTLED, items: [A, B] })
    expect(hook.result.current.selectedId).toBe("a")
    expect(hook.result.current.selectedItem).toBe(A)
  })

  it("never auto-picks over a deep link, even when the link is not listed", () => {
    const hook = setup({ focusId: "z" })
    expect(hook.result.current.selectedId).toBe("z")
    expect(hook.result.current.selectedItem).toBeNull()
  })

  it("re-selects a new deep link", () => {
    const hook = setup({ focusId: "a" })
    act(() => hook.result.current.setSelectedId("b"))
    hook.rerender({ focusId: "c", items: [A, B, C] })
    expect(hook.result.current.selectedId).toBe("c")
  })

  it("leaves deep links to the page when syncFocus is off", () => {
    const hook = setup({ focusId: "a", syncFocus: false })
    act(() => hook.result.current.setSelectedId("b"))
    hook.rerender({ focusId: "c", items: [A, B, C] })
    expect(hook.result.current.selectedId).toBe("b")
  })

  it("keeps a pick that a filter or search leaves out", () => {
    const hook = setup()
    act(() => hook.result.current.setSelectedId("b"))
    hook.rerender({ listKey: "flagged", items: [A] })
    expect(hook.result.current.selectedId).toBe("b")
  })

  it("clears a pick that drops out of the same list after a refetch, without picking the first row", () => {
    const hook = setup()
    act(() => hook.result.current.setSelectedId("b"))
    hook.rerender({ list: FETCHING, items: [A, B] })
    expect(hook.result.current.selectedId).toBe("b")

    hook.rerender({ list: SETTLED, items: [A] })
    expect(hook.result.current.selectedId).toBeNull()

    hook.rerender({ list: SETTLED, items: [A, C] })
    expect(hook.result.current.selectedId).toBeNull()
  })

  it("does not judge a drop-out on a list still refetching", () => {
    const hook = setup()
    act(() => hook.result.current.setSelectedId("b"))
    hook.rerender({ list: FETCHING, items: [A] })
    expect(hook.result.current.selectedId).toBe("b")
  })

  it("keeps a deep link that drops out of another list before it was ever listed", () => {
    const hook = setup({ focusId: "z", items: [A] })
    hook.rerender({ listKey: "flagged", items: [B] })
    expect(hook.result.current.selectedId).toBe("z")
  })

  describe("readableById: false", () => {
    it("clears a pick that a filter leaves out", () => {
      const hook = setup({ readableById: false })
      act(() => hook.result.current.setSelectedId("b"))
      hook.rerender({ listKey: "suspended", items: [A] })
      expect(hook.result.current.selectedId).toBeNull()
    })

    it("keeps the unlisted deep link open", () => {
      const hook = setup({ readableById: false, focusId: "z" })
      hook.rerender({ listKey: "suspended", items: [A] })
      expect(hook.result.current.selectedId).toBe("z")
    })
  })

  it("clearIfSelected clears only the matching pick", () => {
    const hook = setup()
    expect(hook.result.current.selectedId).toBe("a")
    act(() => hook.result.current.clearIfSelected("b"))
    expect(hook.result.current.selectedId).toBe("a")
    act(() => hook.result.current.clearIfSelected("a"))
    expect(hook.result.current.selectedId).toBeNull()
  })

  it("restartAutoPick picks the first row again after a fresh load", () => {
    const hook = setup()
    act(() => hook.result.current.setSelectedId(null))
    expect(hook.result.current.selectedId).toBeNull()
    act(() => hook.result.current.restartAutoPick())
    expect(hook.result.current.selectedId).toBe("a")
  })

  describe("unreadIds", () => {
    it("keeps a message that opening it read out of the same unread list", () => {
      const hook = setup({ items: [A, B], unreadIds: new Set(["a", "b"]) })
      act(() => {
        hook.result.current.setSelectedId("b")
        hook.result.current.readOnOpen.current = "b"
      })
      hook.rerender({ items: [A], unreadIds: new Set(["a"]) })
      expect(hook.result.current.selectedId).toBe("b")
      expect(hook.result.current.readOnOpen.current).toBeNull()
    })

    it("clears it once the list has shown it read and it then drops out", () => {
      const hook = setup({ items: [A, B], unreadIds: new Set(["a", "b"]) })
      act(() => {
        hook.result.current.setSelectedId("b")
        hook.result.current.readOnOpen.current = "b"
      })
      hook.rerender({ items: [A, B], unreadIds: new Set(["a"]) })
      expect(hook.result.current.readOnOpen.current).toBeNull()

      hook.rerender({ items: [A], unreadIds: new Set(["a"]) })
      expect(hook.result.current.selectedId).toBeNull()
    })
  })

  describe("keepLastSeen", () => {
    it("keeps showing the last listed row for a pick a filter leaves out", () => {
      const hook = setup({ keepLastSeen: true })
      act(() => hook.result.current.setSelectedId("b"))
      expect(hook.result.current.selectedItem).toBe(B)
      hook.rerender({ listKey: "routed", items: [A] })
      expect(hook.result.current.selectedId).toBe("b")
      expect(hook.result.current.selectedItem).toBe(B)
    })

    it("resolves only listed rows without it", () => {
      const hook = setup()
      act(() => hook.result.current.setSelectedId("b"))
      hook.rerender({ listKey: "routed", items: [A] })
      expect(hook.result.current.selectedId).toBe("b")
      expect(hook.result.current.selectedItem).toBeNull()
    })
  })
})

describe("resolveSelected", () => {
  it("prefers the listed row, falls back to a matching last-seen row, and ignores a stale one", () => {
    const listedB = { id: "b", label: "fresh" }
    expect(resolveSelected([A, listedB], "b", B, idOf)).toBe(listedB)
    expect(resolveSelected([A], "b", B, idOf)).toBe(B)
    expect(resolveSelected([A], "b", C, idOf)).toBeNull()
    expect(resolveSelected([A], null, A, idOf)).toBeNull()
  })
})
