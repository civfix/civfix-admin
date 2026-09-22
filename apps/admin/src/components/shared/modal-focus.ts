"use client"

import * as React from "react"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
}

export function useModalFocus<T extends HTMLElement>(open: boolean): React.RefObject<T | null> {
  const ref = React.useRef<T>(null)

  React.useEffect(() => {
    const container = ref.current
    if (!open || !container) return
    const restoreTo = document.activeElement as HTMLElement | null

    if (!container.contains(document.activeElement)) focusableWithin(container)[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const focusable = focusableWithin(container)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) {
        e.preventDefault()
        return
      }
      const active = document.activeElement
      const leavingBackwards = e.shiftKey && (active === first || !container.contains(active))
      const leavingForwards = !e.shiftKey && (active === last || !container.contains(active))
      if (!leavingBackwards && !leavingForwards) return
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
    }

    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      if (restoreTo && document.contains(restoreTo)) restoreTo.focus()
    }
  }, [open])

  return ref
}
