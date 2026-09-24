"use client"

import * as React from "react"
import {
  FORWARD_TEMPLATE_VARIABLES,
  describeForwardTemplateIssue,
  forwardTemplateIssues,
  type ForwardTemplateIssue,
  type ForwardTemplateSource,
  type PreviewForwardTemplateRequest,
  type PreviewForwardTemplateResponse,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { useModalFocus } from "@/components/shared/modal-focus"
import { toAppError } from "@/lib/api"
import { usePreviewForwardTemplate } from "@/features/mail/use-mail"
import {
  resolveTemplateSeed,
  toStoredTemplate,
  type ForwardTemplateInitial,
  type ForwardTemplatePair,
} from "@/features/mail/forward-template-modal-state"

const SOURCE_LABEL: Record<ForwardTemplateSource, string> = {
  custom: "this template",
  default: "the saved default",
  builtin: "the built-in template",
}

export interface ForwardTemplateModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  initial: ForwardTemplateInitial
  fallback: ForwardTemplatePair
  fallbackLabel: string
  onSave: (value: { subject: string | null; body: string | null }) => void
  pending: boolean
}

export function ForwardTemplateModal(props: ForwardTemplateModalProps) {
  if (!props.open) return null
  return <ForwardTemplateEditor {...props} />
}

function IssueList({ issues }: { issues: ForwardTemplateIssue[] }) {
  if (issues.length === 0) return null
  return (
    <div className="tpl-issues" role="alert">
      {issues.map((issue) => (
        <div key={`${issue.kind}-${issue.index}`} className="tpl-issue">
          {describeForwardTemplateIssue(issue)}
        </div>
      ))}
    </div>
  )
}

function ForwardTemplateEditor({
  onClose,
  title,
  subtitle,
  initial,
  fallback,
  fallbackLabel,
  onSave,
  pending,
}: ForwardTemplateModalProps) {
  const preview = usePreviewForwardTemplate()
  const [seed] = React.useState(() => resolveTemplateSeed(initial, fallback))
  const [subject, setSubject] = React.useState(seed.subject)
  const [body, setBody] = React.useState(seed.body)
  const [rendered, setRendered] = React.useState<PreviewForwardTemplateResponse | null>(null)
  const modalRef = useModalFocus<HTMLDivElement>(true)
  const titleId = React.useId()

  const subjectRef = React.useRef<HTMLInputElement | null>(null)
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null)
  const focusedField = React.useRef<"subject" | "body">("body")
  const subjectId = React.useId()
  const bodyId = React.useId()

  const insertToken = (token: string) => {
    const field = focusedField.current
    const el = field === "subject" ? subjectRef.current : bodyRef.current
    const value = field === "subject" ? subject : body
    const setValue = field === "subject" ? setSubject : setBody
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    setValue(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const caret = start + token.length
      el.setSelectionRange(caret, caret)
    })
  }

  const subjectIssues = forwardTemplateIssues(subject)
  const bodyIssues = forwardTemplateIssues(body)
  const hasIssues = subjectIssues.length > 0 || bodyIssues.length > 0

  // Escape and the backdrop only dismiss an unedited template; once it is edited, Cancel and the close
  // button are the deliberate ways to discard it (the same rule as the create-org panel).
  const pristine = subject === seed.subject && body === seed.body
  const dismiss = React.useCallback(() => {
    if (pristine) onClose()
  }, [pristine, onClose])
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dismiss])

  const onPreview = () => {
    const input: PreviewForwardTemplateRequest = {}
    if (subject.trim() !== "") input.subjectTemplate = subject
    if (body.trim() !== "") input.bodyTemplate = body
    preview.mutate(input, { onSuccess: (res) => setRendered(res) })
  }

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div
        ref={modalRef}
        className="modal tpl-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button className="closebtn" aria-label="Close" onClick={onClose}>
            <Icons.X size={16} />
          </button>
        </div>

        {rendered ? (
          <div className="modal-body">
            <div className="tpl-email">
              <div className="tpl-email-subject">{rendered.subject}</div>
              <iframe
                className="tpl-preview-frame"
                sandbox=""
                srcDoc={rendered.html}
                title="Email preview"
              />
            </div>
            <div className="hint">
              Rendered with sample data · subject from {SOURCE_LABEL[rendered.subjectSource]} · body
              from {SOURCE_LABEL[rendered.bodySource]}
            </div>
          </div>
        ) : (
          <div className="modal-body">
            <div className="hint">{subtitle}</div>
            <div className="tpl-legend" aria-label="Insert a variable">
              {FORWARD_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  className="tpl-chip"
                  title={`${v.label} — ${v.description}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertToken(v.token)}
                >
                  {v.token}
                </button>
              ))}
            </div>
            <div className="hint">Click a variable to insert it where your cursor is.</div>

            <div className="compose-field">
              <label htmlFor={subjectId}>Subject</label>
              <input
                id={subjectId}
                ref={subjectRef}
                type="text"
                value={subject}
                placeholder={fallback.subject}
                onFocus={() => (focusedField.current = "subject")}
                onChange={(e) => setSubject(e.target.value)}
              />
              <IssueList issues={subjectIssues} />
            </div>

            <div className="compose-field">
              <label htmlFor={bodyId}>Body</label>
              <textarea
                id={bodyId}
                ref={bodyRef}
                className="tpl-body"
                rows={12}
                value={body}
                placeholder={`Leave both fields empty to use ${fallbackLabel}…`}
                onFocus={() => (focusedField.current = "body")}
                onChange={(e) => setBody(e.target.value)}
              />
              <IssueList issues={bodyIssues} />
            </div>

            {preview.isPending && <div className="hint">Rendering a preview…</div>}
            {preview.isError && !preview.isPending && (
              <div className="tpl-issue" role="alert">
                {toAppError(preview.error).message}
              </div>
            )}
          </div>
        )}

        <div className="modal-foot">
          {rendered ? (
            <button className="btn" onClick={() => setRendered(null)}>
              <Icons.ChevronLeft size={13} /> Back to editor
            </button>
          ) : (
            <>
              <button
                className="btn"
                onClick={() => {
                  setSubject(fallback.subject)
                  setBody(fallback.body)
                }}
              >
                Copy in the {fallbackLabel}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setSubject("")
                  setBody("")
                }}
              >
                Clear
              </button>
            </>
          )}
          <div className="spacer" />
          {!rendered && (
            <button className="btn" disabled={hasIssues || preview.isPending} onClick={onPreview}>
              <Icons.Eye size={13} /> Preview
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={hasIssues || pending}
            onClick={() =>
              onSave({ subject: toStoredTemplate(subject), body: toStoredTemplate(body) })
            }
          >
            <Icons.Check size={13} /> Save
          </button>
        </div>
      </div>
    </div>
  )
}
