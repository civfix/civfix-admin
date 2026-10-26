"use client"

import * as React from "react"

import { Icons } from "@/components/icons"
import { ERROR_TOAST_MS, SUCCESS_TOAST_MS } from "@/components/shell/toast"

type DevToastTone = "ok" | "error"
type ShowDevToast = (text: string, tone: DevToastTone) => void

interface DevToastMessage {
  text: string
  tone: DevToastTone
}

const DevToastContext = React.createContext<ShowDevToast | null>(null)

/** The page's own toast: the admin shell's toast is not on this page. */
export function useDevToast(): ShowDevToast {
  const show = React.useContext(DevToastContext)
  if (!show) throw new Error("useDevToast needs DevToastProvider")
  return show
}

export function DevToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState<DevToastMessage | null>(null)
  const show = React.useCallback<ShowDevToast>((text, tone) => setMessage({ text, tone }), [])
  const dismiss = React.useCallback(() => setMessage(null), [])

  // Each message is a new object, so a repeat of the same text restarts the timer.
  React.useEffect(() => {
    if (!message) return
    const timer = setTimeout(dismiss, message.tone === "error" ? ERROR_TOAST_MS : SUCCESS_TOAST_MS)
    return () => clearTimeout(timer)
  }, [message, dismiss])

  const isError = message?.tone === "error"
  return (
    <DevToastContext.Provider value={show}>
      {children}
      {/* Always mounted, so screen readers announce each new message. */}
      <div className={["toast-wrap", message ? "open" : "", isError ? "error" : ""].join(" ")}>
        <div role="status" className="toast-msg">
          {message ? (
            <>
              <span className="ico" aria-hidden="true">
                {isError ? <Icons.AlertTriangle size={11} /> : <Icons.Check size={11} />}
              </span>
              <span>{message.text}</span>
            </>
          ) : null}
        </div>
        {message ? (
          <button type="button" className="undo" aria-label="Dismiss" onClick={dismiss}>
            <Icons.X size={13} />
          </button>
        ) : null}
      </div>
    </DevToastContext.Provider>
  )
}
