"use client"

import * as React from "react"

import { Icons } from "@/components/icons"
import { usePristineDismiss } from "@/components/shared/backdrop-dismiss"
import { useModalFocus } from "@/components/shared/modal-focus"

export interface ComposeInput {
  to: string
  subject: string
  body: string
}

interface ComposeModalProps {
  open: boolean
  onClose: () => void
  onSend: (input: ComposeInput) => void
  pending: boolean
}

export function ComposeModal(props: ComposeModalProps) {
  if (!props.open) return null
  return <ComposeEditor {...props} />
}

function ComposeFoot({
  canSend,
  onClose,
  onSend,
}: {
  canSend: boolean
  onClose: () => void
  onSend: () => void
}) {
  return (
    <div className="modal-foot">
      <span className="compose-from">
        From civfix, via a per-conversation <span className="mono">reply-…</span> address
      </span>
      <div className="spacer" />
      <button className="btn" onClick={onClose}>
        Cancel
      </button>
      <button
        className={`btn ${canSend ? "primary" : ""}`}
        disabled={!canSend}
        style={!canSend ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
        onClick={onSend}
      >
        <Icons.Send size={13} /> Send
      </button>
    </div>
  )
}

function ComposeEditor({ onClose, onSend, pending }: ComposeModalProps) {
  const [to, setTo] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const modalRef = useModalFocus<HTMLDivElement>(true)
  const toRef = React.useRef<HTMLInputElement>(null)
  const titleId = React.useId()
  const toId = React.useId()
  const subjectId = React.useId()
  const bodyId = React.useId()

  // Focused here rather than with autoFocus: autoFocus lands before useModalFocus records the element
  // to restore, so closing would return focus to the dead field instead of the Compose button.
  React.useEffect(() => {
    toRef.current?.focus()
  }, [])

  const backdrop = usePristineDismiss(onClose, to === "" && subject === "" && body === "")

  const canSend = !!to.trim() && !!subject.trim() && !!body.trim() && !pending

  return (
    <div className="modal-overlay" {...backdrop}>
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <h3 id={titleId}>New message</h3>
          <button className="closebtn" onClick={onClose} aria-label="Close">
            <Icons.X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="compose-field">
            <label htmlFor={toId}>To</label>
            <input
              id={toId}
              ref={toRef}
              type="email"
              placeholder="contact@city.gov"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="compose-field">
            <label htmlFor={subjectId}>Subject</label>
            <input
              id={subjectId}
              type="text"
              placeholder="Subject line"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="compose-field">
            <label htmlFor={bodyId}>Message</label>
            <textarea
              id={bodyId}
              rows={7}
              placeholder="Write your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
        <ComposeFoot
          canSend={canSend}
          onClose={onClose}
          onSend={() => onSend({ to: to.trim(), subject: subject.trim(), body: body.trim() })}
        />
      </div>
    </div>
  )
}
