"use client"

import * as React from "react"
import { OrgVerificationKindSchema, type AdminOrgDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { usePristineDismiss } from "@/components/shared/backdrop-dismiss"
import { useModalFocus } from "@/components/shared/modal-focus"
import type { OrgProfileErrors } from "@/features/orgs/org-form"
import {
  FieldError,
  OrgProfileFields,
  ReasonField,
  fieldErrorId,
  fieldHintId,
} from "@/features/orgs/org-form-fields"
import { UserPicker, type PickedUser } from "@/features/orgs/user-picker"
import { ORG_KIND_LABEL } from "@/features/orgs/org-verification"
import { useCreateOrgForm, type VerifiedKindChoice } from "@/features/orgs/use-create-org-form"

const OWNER_FIELD_ID = "org-create-owner"
const OWNER_LABEL_ID = "org-create-owner-label"
const TITLE_ID = "org-create-title"
const VERIFIED_KIND_ID = "org-verified-kind"

const VERIFICATION_OPTIONS: { value: VerifiedKindChoice; label: string }[] = [
  { value: "", label: "Leave unverified" },
  ...OrgVerificationKindSchema.options.map((kind) => ({
    value: kind,
    label: `Verified as ${ORG_KIND_LABEL[kind].toLowerCase()}`,
  })),
]

/**
 * The form only exists while the panel is open, so closing it discards the draft, the submitted flag
 * and every error: reopening always starts clean.
 */
export function CreateOrgPanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (org: AdminOrgDTO) => void
}) {
  if (!open) return null
  return <CreateOrgSlideOver onClose={onClose} onCreated={onCreated} />
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sub">
      <div className="sub-head">{title}</div>
      <div className="sub-body">{children}</div>
    </div>
  )
}

function OwnerSection({
  owner,
  onChange,
  errors,
}: {
  owner: PickedUser | null
  onChange: (next: PickedUser | null) => void
  errors: OrgProfileErrors
}) {
  return (
    <FormSection title="Owner">
      <div
        className={`field ${errors.ownerUserId ? "has-error" : ""}`}
        role="group"
        aria-labelledby={OWNER_LABEL_ID}
        aria-describedby={
          errors.ownerUserId ? fieldErrorId(OWNER_FIELD_ID) : fieldHintId(OWNER_FIELD_ID)
        }
      >
        <span className="lbl" id={OWNER_LABEL_ID}>
          Owner
          <span className="opt">an existing civfix account</span>
        </span>
        <UserPicker value={owner} onChange={onChange} />
        <FieldError id={fieldErrorId(OWNER_FIELD_ID)} text={errors.ownerUserId} />
        <span className="hint" id={fieldHintId(OWNER_FIELD_ID)}>
          The owner can edit the organization, manage its members and host under its name.
          Ownership can be transferred later from the Members tab.
        </span>
      </div>
    </FormSection>
  )
}

/** The verification shortcut is for operator-onboarded partners (DECISIONS §32). */
function VerificationSection({
  value,
  onChange,
  disabled,
}: {
  value: VerifiedKindChoice
  onChange: (next: VerifiedKindChoice) => void
  disabled: boolean
}) {
  return (
    <FormSection title="Verification">
      <div className="field">
        <label className="lbl" htmlFor={VERIFIED_KIND_ID}>
          Status at creation
        </label>
        <select
          id={VERIFIED_KIND_ID}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as VerifiedKindChoice)}
        >
          {VERIFICATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="hint">
          {value === ""
            ? "The organization can apply for verification itself from its settings."
            : "Created already verified, with no evidence round-trip. Use for partners you onboard directly (a city department, a known nonprofit)."}
        </span>
      </div>
    </FormSection>
  )
}

function CreateOrgSlideOver({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (org: AdminOrgDTO) => void
}) {
  const form = useCreateOrgForm({ onClose, onCreated })
  const { errors, pending, logoUploading, close } = form
  const backdrop = usePristineDismiss(close, form.pristine)
  const panelRef = useModalFocus<HTMLElement>(true)
  const locked = pending || logoUploading

  return (
    <>
      <div className="panel-overlay open" {...backdrop} />
      <aside
        ref={panelRef}
        className="panel org-create-panel open"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-busy={pending}
      >
        <form onSubmit={form.submit} className="org-create-form">
          <div className="panel-head">
            <div className="panel-head-titles">
              <div className="crumb">Organizations</div>
              <h2 id={TITLE_ID}>New organization</h2>
            </div>
            <div className="spacer" />
            <button
              type="button"
              className="closebtn"
              onClick={close}
              aria-label="Close"
              disabled={locked}
            >
              <Icons.X size={16} />
            </button>
          </div>

          <div className="panel-body">
            <div className="panel-top">
              <div className="col">
                <FormSection title="Profile">
                  <OrgProfileFields
                    draft={form.draft}
                    errors={errors}
                    onChange={form.changeDraft}
                    mode="create"
                    disabled={pending}
                    onLogoUploadingChange={form.setLogoUploading}
                  />
                </FormSection>
              </div>
              <div className="col">
                <OwnerSection owner={form.owner} onChange={form.setOwner} errors={errors} />
                <VerificationSection
                  value={form.verifiedKind}
                  onChange={form.setVerifiedKind}
                  disabled={pending}
                />
                <FormSection title="Audit">
                  <ReasonField
                    value={form.reason}
                    onChange={form.setReason}
                    error={errors.reason}
                    placeholder="Onboarded at the Council District 4 partner meeting…"
                    disabled={pending}
                  />
                </FormSection>
              </div>
            </div>
          </div>

          <div className="panel-foot">
            {logoUploading && <span className="hint">Uploading the logo…</span>}
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={close} disabled={locked}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={locked}>
              <Icons.Plus size={14} /> {pending ? "Creating…" : "Create organization"}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
