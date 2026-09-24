"use client"

import * as React from "react"
import { create } from "zustand"

import { Icons } from "@/components/icons"
import { useBackdropDismiss } from "@/components/shared/backdrop-dismiss"
import { useModalFocus } from "@/components/shared/modal-focus"

interface ConfirmRequest {
  kind: "confirm"
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

interface PromptRequest {
  kind: "prompt"
  title: string
  body?: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  required?: boolean
  danger?: boolean
  resolve: (value: string | null) => void
}

type DialogRequest = ConfirmRequest | PromptRequest

interface DialogState {
  current: DialogRequest | null
  open: (req: DialogRequest) => void
  close: () => void
}

const useDialogStore = create<DialogState>((set) => ({
  current: null,
  open: (req) => set({ current: req }),
  close: () => set({ current: null }),
}))

export function confirmDialog(opts: Omit<ConfirmRequest, "kind" | "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().open({ kind: "confirm", ...opts, resolve })
  })
}

export function promptDialog(
  opts: Omit<PromptRequest, "kind" | "resolve">,
): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().open({ kind: "prompt", ...opts, resolve })
  })
}

const NATIVE_ENTER_TAGS = new Set(["BUTTON", "A", "SELECT"])

// The window listener sees Enter from every focused control. A focused button, link or select must
// keep its own activation (Enter on Close or Cancel must not confirm), and a held key's auto-repeat
// must not accept the dialog that its first press opened.
function enterAccepts({
  kind,
  targetTag,
  modified,
  repeat,
}: {
  kind: DialogRequest["kind"]
  targetTag: string | undefined
  modified: boolean
  repeat: boolean
}): boolean {
  if (repeat) return false
  if (targetTag && NATIVE_ENTER_TAGS.has(targetTag)) return false
  if (targetTag === "TEXTAREA" && !modified) return false
  return kind === "confirm" || modified
}

export function DialogHost() {
  const current = useDialogStore((s) => s.current)
  const close = useDialogStore((s) => s.close)
  const [value, setValue] = React.useState("")
  const modalRef = useModalFocus<HTMLDivElement>(current !== null)
  const cancelRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (current?.kind === "prompt") setValue(current.defaultValue ?? "")
  }, [current])

  // Runs after useModalFocus's effect, so that hook has already recorded the opener to restore.
  React.useEffect(() => {
    if (current?.kind === "confirm" && current.danger) cancelRef.current?.focus()
  }, [current])

  const cancel = React.useCallback(() => {
    if (!current) return
    if (current.kind === "prompt") current.resolve(null)
    else current.resolve(false)
    close()
  }, [current, close])

  const accept = React.useCallback(() => {
    if (!current) return
    if (current.kind === "prompt") {
      if (current.required && value.trim() === "") return
      current.resolve(value)
    } else {
      current.resolve(true)
    }
    close()
  }, [current, value, close])

  React.useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        cancel()
      } else if (
        e.key === "Enter" &&
        enterAccepts({
          kind: current.kind,
          targetTag: (e.target as HTMLElement | null)?.tagName,
          modified: e.metaKey || e.ctrlKey,
          repeat: e.repeat,
        })
      ) {
        e.preventDefault()
        accept()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, cancel, accept])

  const backdrop = useBackdropDismiss(cancel)

  if (!current) return null
  const confirmDisabled =
    current.kind === "prompt" && current.required === true && value.trim() === ""

  return (
    <div className="modal-overlay" {...backdrop}>
      <div
        ref={modalRef}
        className="modal dialog-modal"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <h3>{current.title}</h3>
          <button className="closebtn" onClick={cancel} aria-label="Close">
            <Icons.X size={16} />
          </button>
        </div>
        <div className="dialog-body">
          {current.body && <p className="dialog-text">{current.body}</p>}
          {current.kind === "prompt" && (
            <>
              {current.label && <label className="dialog-label">{current.label}</label>}
              <textarea
                className="dialog-input"
                autoFocus
                rows={3}
                value={value}
                placeholder={current.placeholder}
                onChange={(e) => setValue(e.target.value)}
              />
            </>
          )}
        </div>
        <div className="modal-foot dialog-foot">
          <button ref={cancelRef} className="btn ghost" onClick={cancel}>
            {current.kind === "confirm" ? (current.cancelLabel ?? "Cancel") : "Cancel"}
          </button>
          <button
            className={`btn ${current.danger ? "danger" : "primary"}`}
            onClick={accept}
            disabled={confirmDisabled}
          >
            {current.confirmLabel ?? (current.kind === "prompt" ? "Submit" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  )
}
