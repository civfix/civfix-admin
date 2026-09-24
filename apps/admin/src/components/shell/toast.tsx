"use client"

import * as React from "react"

import { Icons } from "@/components/icons"
import { useUiStore, type ToastTone } from "@/store/ui-store"

export const SUCCESS_TOAST_MS = 2600
// An error needs reading and often acting on, so it outlasts a confirmation.
export const ERROR_TOAST_MS = 8000

const TOAST_MS: Record<ToastTone, number> = { ok: SUCCESS_TOAST_MS, error: ERROR_TOAST_MS }

/**
 * Global ephemeral toast, driven by the UI store: `useToast()` after a successful write, and the query
 * client's mutation cache for every failed write. Toasts confirm destructive writes that have no real
 * undo, so the trailing affordance is a dismiss "X", not an "Undo" that would imply a revert.
 *
 * The status region stays mounted so screen readers announce each new toast; the dismiss button exists
 * only while a toast is shown, so the hidden toast leaves no tab stop behind.
 */
export function Toast() {
  const toast = useUiStore((s) => s.toast)
  const dismiss = useUiStore((s) => s.dismissToast)
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const held = hovered || focused

  React.useEffect(() => {
    if (!toast || held) return
    const t = setTimeout(dismiss, TOAST_MS[toast.tone])
    return () => clearTimeout(t)
  }, [toast, held, dismiss])

  // The button unmounts with the toast, so no mouseleave or blur follows the click that removed it.
  const close = () => {
    setHovered(false)
    setFocused(false)
    dismiss()
  }

  const tone = toast?.tone ?? "ok"

  return (
    <div
      role="status"
      className={`toast-wrap ${toast ? "open" : ""} ${tone === "error" ? "error" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {toast && (
        <>
          <span className="ico" aria-hidden="true">
            {tone === "error" ? <Icons.AlertTriangle size={11} /> : <Icons.Check size={11} />}
          </span>
          <span>{toast.text}</span>
          <button type="button" className="undo" aria-label="Dismiss" onClick={close}>
            <Icons.X size={13} />
          </button>
        </>
      )}
    </div>
  )
}
