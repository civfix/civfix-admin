"use client"

import * as React from "react"

import { Icons } from "@/components/icons"
import { useUiStore } from "@/store/ui-store"

/**
 * Global ephemeral confirmation toast (ported from app.jsx). Driven by the UI store instead of the
 * prototype's `window.__toast`. Fire it via the `useToast()` hook after a successful write. Auto-
 * dismisses after 2600ms. The "Undo" affordance just dismisses (no real undo is wired, matching the
 * prototype; a real undo would be wired per-action in wave 2 if needed).
 */
export function Toast() {
  const toast = useUiStore((s) => s.toast)
  const dismiss = useUiStore((s) => s.dismissToast)

  React.useEffect(() => {
    if (!toast) return
    const t = setTimeout(dismiss, 2600)
    return () => clearTimeout(t)
  }, [toast, dismiss])

  return (
    <div className={`toast-wrap ${toast ? "open" : ""}`}>
      <span className="ico">
        <Icons.Check size={11} />
      </span>
      <span>{toast?.text}</span>
      <span className="undo" onClick={dismiss}>
        Undo
      </span>
    </div>
  )
}
