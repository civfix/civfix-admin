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
 * The status region stays mounted so screen readers announce each new toast, and holds only the message:
 * the dismiss button sits beside it, so "Dismiss" is not read as part of the announcement, and exists
 * only while a toast is shown, so the hidden toast leaves no tab stop behind.
 */
export function Toast() {
  const toast = useUiStore((s) => s.toast)
  const dismiss = useUiStore((s) => s.dismissToast)
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const held = hovered || focused
  const dismissButton = React.useRef<HTMLButtonElement>(null)
  const focusBeforeToast = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!toast || held) return
    const t = setTimeout(dismiss, TOAST_MS[toast.tone])
    return () => clearTimeout(t)
  }, [toast, held, dismiss])

  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    setFocused(true)
    if (e.currentTarget.contains(e.relatedTarget)) return
    focusBeforeToast.current = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null
  }

  // The button unmounts with the toast, so no mouseleave or blur follows the click that removed it, and
  // focus on it would fall to the body: hand it back to where the operator was before the toast.
  const close = () => {
    const hadFocus = dismissButton.current === document.activeElement
    const returnTo = focusBeforeToast.current
    focusBeforeToast.current = null
    setHovered(false)
    setFocused(false)
    dismiss()
    if (hadFocus && returnTo?.isConnected) returnTo.focus()
  }

  const tone = toast?.tone ?? "ok"

  return (
    <div
      className={`toast-wrap ${toast ? "open" : ""} ${tone === "error" ? "error" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={onFocus}
      onBlur={() => setFocused(false)}
    >
      <div role="status" className="toast-msg">
        {toast && (
          <>
            <span className="ico" aria-hidden="true">
              {tone === "error" ? <Icons.AlertTriangle size={11} /> : <Icons.Check size={11} />}
            </span>
            <span>{toast.text}</span>
          </>
        )}
      </div>
      {toast && (
        <button
          ref={dismissButton}
          type="button"
          className="undo"
          aria-label="Dismiss"
          onClick={close}
        >
          <Icons.X size={13} />
        </button>
      )}
    </div>
  )
}
