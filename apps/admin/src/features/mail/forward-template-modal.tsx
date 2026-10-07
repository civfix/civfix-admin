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
import { usePristineDismiss } from "@/components/shared/backdrop-dismiss"
import { useModalFocus } from "@/components/shared/modal-focus"
import { errorMessage } from "@/lib/error-messages"
import { usePreviewForwardTemplate } from "@/features/mail/use-mail"
import {
  insertAt,
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

interface ForwardTemplateModalProps {
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

function TemplatePreview({ rendered }: { rendered: PreviewForwardTemplateResponse }) {
  return (
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
  )
}

type TemplateField = "subject" | "body"

interface TemplateFieldsProps {
  subtitle: string
  fallback: ForwardTemplatePair
  fallbackLabel: string
  subject: string
  body: string
  subjectId: string
  bodyId: string
  subjectIssues: ForwardTemplateIssue[]
  bodyIssues: ForwardTemplateIssue[]
  onSubjectChange: (value: string) => void
  onBodyChange: (value: string) => void
  subjectRef: React.RefObject<HTMLInputElement | null>
  bodyRef: React.RefObject<HTMLTextAreaElement | null>
  onFieldFocus: (field: TemplateField) => void
  onInsertToken: (token: string) => void
  preview: { isPending: boolean; isError: boolean; error: unknown }
}

function TemplateFields({
  subtitle,
  fallback,
  fallbackLabel,
  subject,
  body,
  subjectId,
  bodyId,
  subjectIssues,
  bodyIssues,
  onSubjectChange,
  onBodyChange,
  subjectRef,
  bodyRef,
  onFieldFocus,
  onInsertToken,
  preview,
}: TemplateFieldsProps) {
  return (
    <div className="modal-body">
      <div className="hint">{subtitle}</div>
      <div className="tpl-legend" aria-label="Insert a variable">
        {FORWARD_TEMPLATE_VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            className="tpl-chip"
            title={`${v.label}: ${v.description}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsertToken(v.token)}
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
          onFocus={() => onFieldFocus("subject")}
          onChange={(e) => onSubjectChange(e.target.value)}
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
          onFocus={() => onFieldFocus("body")}
          onChange={(e) => onBodyChange(e.target.value)}
        />
        <IssueList issues={bodyIssues} />
      </div>

      {preview.isPending && <div className="hint">Rendering a preview…</div>}
      {preview.isError && !preview.isPending && (
        <div className="tpl-issue" role="alert">
          {errorMessage(preview.error)}
        </div>
      )}
    </div>
  )
}

function useTemplateDraft(initial: ForwardTemplateInitial, fallback: ForwardTemplatePair) {
  const [seed] = React.useState(() => resolveTemplateSeed(initial, fallback))
  const [subject, setSubject] = React.useState(seed.subject)
  const [body, setBody] = React.useState(seed.body)
  const subjectRef = React.useRef<HTMLInputElement | null>(null)
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null)
  const focusedField = React.useRef<TemplateField>("body")

  const insertToken = (token: string) => {
    const field = focusedField.current
    const el = field === "subject" ? subjectRef.current : bodyRef.current
    const value = field === "subject" ? subject : body
    const setValue = field === "subject" ? setSubject : setBody
    const next = insertAt(
      value,
      el?.selectionStart ?? value.length,
      el?.selectionEnd ?? value.length,
      token,
    )
    setValue(next.value)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  const fill = (next: ForwardTemplatePair) => {
    setSubject(next.subject)
    setBody(next.body)
  }

  return {
    subject,
    setSubject,
    body,
    setBody,
    pristine: subject === seed.subject && body === seed.body,
    fill,
    subjectRef,
    bodyRef,
    focusField: (field: TemplateField) => (focusedField.current = field),
    insertToken,
  }
}

function TemplateModalFoot({
  previewing,
  fallback,
  fallbackLabel,
  onBack,
  onFill,
  previewDisabled,
  onPreview,
  onClose,
  saveDisabled,
  onSave,
}: {
  previewing: boolean
  fallback: ForwardTemplatePair
  fallbackLabel: string
  onBack: () => void
  onFill: (next: ForwardTemplatePair) => void
  previewDisabled: boolean
  onPreview: () => void
  onClose: () => void
  saveDisabled: boolean
  onSave: () => void
}) {
  return (
    <div className="modal-foot">
      {previewing ? (
        <button className="btn" onClick={onBack}>
          <Icons.ChevronLeft size={13} /> Back to editor
        </button>
      ) : (
        <>
          <button className="btn" onClick={() => onFill(fallback)}>
            Copy in the {fallbackLabel}
          </button>
          <button className="btn" onClick={() => onFill({ subject: "", body: "" })}>
            Clear
          </button>
        </>
      )}
      <div className="spacer" />
      {!previewing && (
        <button className="btn" disabled={previewDisabled} onClick={onPreview}>
          <Icons.Eye size={13} /> Preview
        </button>
      )}
      <button className="btn" onClick={onClose}>
        Cancel
      </button>
      <button className="btn primary" disabled={saveDisabled} onClick={onSave}>
        <Icons.Check size={13} /> Save
      </button>
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
  const draft = useTemplateDraft(initial, fallback)
  const { subject, body } = draft
  const [rendered, setRendered] = React.useState<PreviewForwardTemplateResponse | null>(null)
  const modalRef = useModalFocus<HTMLDivElement>(true)
  const titleId = React.useId()
  const subjectId = React.useId()
  const bodyId = React.useId()

  const subjectIssues = forwardTemplateIssues(subject)
  const bodyIssues = forwardTemplateIssues(body)
  const hasIssues = subjectIssues.length > 0 || bodyIssues.length > 0

  const backdrop = usePristineDismiss(onClose, draft.pristine)

  const onPreview = () => {
    const input: PreviewForwardTemplateRequest = {}
    if (subject.trim() !== "") input.subjectTemplate = subject
    if (body.trim() !== "") input.bodyTemplate = body
    preview.mutate(input, { onSuccess: (res) => setRendered(res) })
  }

  return (
    <div className="modal-overlay" {...backdrop}>
      <div
        ref={modalRef}
        className="modal tpl-modal"
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
          <TemplatePreview rendered={rendered} />
        ) : (
          <TemplateFields
            subtitle={subtitle}
            fallback={fallback}
            fallbackLabel={fallbackLabel}
            subject={subject}
            body={body}
            subjectId={subjectId}
            bodyId={bodyId}
            subjectIssues={subjectIssues}
            bodyIssues={bodyIssues}
            onSubjectChange={draft.setSubject}
            onBodyChange={draft.setBody}
            subjectRef={draft.subjectRef}
            bodyRef={draft.bodyRef}
            onFieldFocus={draft.focusField}
            onInsertToken={draft.insertToken}
            preview={preview}
          />
        )}

        <TemplateModalFoot
          previewing={rendered !== null}
          fallback={fallback}
          fallbackLabel={fallbackLabel}
          onBack={() => setRendered(null)}
          onFill={draft.fill}
          previewDisabled={hasIssues || preview.isPending}
          onPreview={onPreview}
          onClose={onClose}
          saveDisabled={hasIssues || pending}
          onSave={() => onSave({ subject: toStoredTemplate(subject), body: toStoredTemplate(body) })}
        />
      </div>
    </div>
  )
}
