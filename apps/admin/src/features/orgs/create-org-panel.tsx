"use client"

import * as React from "react"
import type { AdminOrgDTO, OrgVerificationKind } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { usePristineDismiss } from "@/components/shared/backdrop-dismiss"
import { useModalFocus } from "@/components/shared/modal-focus"
import {
  buildCreateRequest,
  clearChangedFieldErrors,
  emptyProfileDraft,
  fieldErrorsFromError,
  validateProfileDraft,
  type OrgProfileDraft,
  type OrgProfileErrors,
} from "@/features/orgs/org-form"
import {
  FieldError,
  OrgProfileFields,
  ReasonField,
  fieldErrorId,
  fieldHintId,
} from "@/features/orgs/org-form-fields"
import { useCreateOrg } from "@/features/orgs/use-orgs"
import { UserPicker, type PickedUser } from "@/features/orgs/user-picker"
import { ORG_KIND_LABEL } from "@/features/orgs/org-verification"

const VERIFICATION_OPTIONS: { value: "" | OrgVerificationKind; label: string }[] = [
  { value: "", label: "Leave unverified" },
  { value: "nonprofit", label: `Verified as ${ORG_KIND_LABEL.nonprofit.toLowerCase()}` },
  { value: "government", label: `Verified as ${ORG_KIND_LABEL.government.toLowerCase()}` },
  { value: "community", label: `Verified as ${ORG_KIND_LABEL.community.toLowerCase()}` },
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

function validateCreate(
  draft: OrgProfileDraft,
  owner: PickedUser | null,
  reason: string,
): OrgProfileErrors {
  const errors = validateProfileDraft(draft)
  if (!owner) errors.ownerUserId = "Pick the person who owns this organization."
  if (reason.trim() === "") errors.reason = "A reason is required."
  return errors
}

/**
 * The verification shortcut is for operator-onboarded partners (DECISIONS §32). Local validation
 * errors are recomputed live once the operator has tried to submit; server errors (slug conflict,
 * VALIDATION.fields) are held apart and cleared per field as that field changes, so a message never
 * outlives the value it was about.
 */
function CreateOrgSlideOver({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (org: AdminOrgDTO) => void
}) {
  const create = useCreateOrg()
  const [draft, setDraft] = React.useState<OrgProfileDraft>(emptyProfileDraft)
  const [owner, setOwnerState] = React.useState<PickedUser | null>(null)
  const [verifiedKind, setVerifiedKind] = React.useState<"" | OrgVerificationKind>("")
  const [reason, setReasonState] = React.useState("")
  const [serverErrors, setServerErrors] = React.useState<OrgProfileErrors>({})
  const [submitted, setSubmitted] = React.useState(false)
  const [logoUploading, setLogoUploading] = React.useState(false)
  // Set synchronously on submit, before React has re-rendered with `create.isPending`, so a second
  // Enter in the same frame cannot start a second POST.
  const inFlight = React.useRef(false)

  const pending = create.isPending
  // Overlay click, Escape, the close button and Cancel all come through here: none of them may
  // dismiss the form while the request is in flight, nor while a logo upload would be orphaned.
  const close = React.useCallback(() => {
    if (inFlight.current || pending || logoUploading) return
    onClose()
  }, [onClose, pending, logoUploading])

  const pristine =
    !logoUploading &&
    owner === null &&
    draft.logoMediaId === null &&
    verifiedKind === "" &&
    reason === "" &&
    Object.values(draft.social).every((v) => v === "") &&
    draft.name === "" &&
    draft.slug === "" &&
    draft.description === "" &&
    draft.websiteUrl === ""
  const backdrop = usePristineDismiss(close, pristine)
  const panelRef = useModalFocus<HTMLElement>(true)

  const localErrors = React.useMemo(
    () => (submitted ? validateCreate(draft, owner, reason) : {}),
    [submitted, draft, owner, reason],
  )
  const errors = React.useMemo(
    () => ({ ...localErrors, ...serverErrors }),
    [localErrors, serverErrors],
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlight.current || pending || logoUploading) return
    setSubmitted(true)
    if (Object.keys(validateCreate(draft, owner, reason)).length > 0 || !owner) return
    const request = buildCreateRequest(draft, {
      ownerUserId: owner.id,
      verifiedKind: verifiedKind === "" ? null : verifiedKind,
      reason,
    })
    inFlight.current = true
    setServerErrors({})
    create.mutate(request, {
      onSuccess: (org) => onCreated(org),
      // Every key fieldErrorsFromError can produce has a field in this form, so whatever it maps is
      // shown inline; useCreateOrg toasts anything else.
      onError: (err) => setServerErrors(fieldErrorsFromError(err, request)),
      onSettled: () => {
        inFlight.current = false
      },
    })
  }

  const onDraftChange = (next: OrgProfileDraft) => {
    setServerErrors((prev) => clearChangedFieldErrors(prev, draft, next))
    setDraft(next)
  }
  const setOwner = (next: PickedUser | null) => {
    setOwnerState(next)
    setServerErrors(({ ownerUserId: _o, ...rest }) => rest)
  }
  const setReason = (next: string) => {
    setReasonState(next)
    setServerErrors(({ reason: _r, ...rest }) => rest)
  }

  return (
    <>
      <div className="panel-overlay open" {...backdrop} />
      <aside
        ref={panelRef}
        className="panel org-create-panel open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-create-title"
        aria-busy={pending}
      >
        <form onSubmit={submit} className="org-create-form">
          <div className="panel-head">
            <div className="panel-head-titles">
              <div className="crumb">Organizations</div>
              <h2 id="org-create-title">New organization</h2>
            </div>
            <div className="spacer" />
            <button
              type="button"
              className="closebtn"
              onClick={close}
              aria-label="Close"
              disabled={pending || logoUploading}
            >
              <Icons.X size={16} />
            </button>
          </div>

          <div className="panel-body">
            <div className="panel-top">
              <div className="col">
                <div className="sub">
                  <div className="sub-head">Profile</div>
                  <div className="sub-body">
                    <OrgProfileFields
                      draft={draft}
                      errors={errors}
                      onChange={onDraftChange}
                      mode="create"
                      disabled={pending}
                      onLogoUploadingChange={setLogoUploading}
                    />
                  </div>
                </div>
              </div>
              <div className="col">
                <div className="sub">
                  <div className="sub-head">Owner</div>
                  <div className="sub-body">
                    <div
                      className={`field ${errors.ownerUserId ? "has-error" : ""}`}
                      role="group"
                      aria-labelledby="org-create-owner-label"
                      aria-describedby={
                        errors.ownerUserId
                          ? fieldErrorId("org-create-owner")
                          : fieldHintId("org-create-owner")
                      }
                    >
                      <span className="lbl" id="org-create-owner-label">
                        Owner
                        <span className="opt">an existing civfix account</span>
                      </span>
                      <UserPicker value={owner} onChange={setOwner} />
                      <FieldError
                        id={fieldErrorId("org-create-owner")}
                        text={errors.ownerUserId}
                      />
                      <span className="hint" id={fieldHintId("org-create-owner")}>
                        The owner can edit the organization, manage its members and host under its
                        name. Ownership can be transferred later from the Members tab.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sub">
                  <div className="sub-head">Verification</div>
                  <div className="sub-body">
                    <div className="field">
                      <label className="lbl" htmlFor="org-verified-kind">
                        Status at creation
                      </label>
                      <select
                        id="org-verified-kind"
                        value={verifiedKind}
                        disabled={pending}
                        onChange={(e) => setVerifiedKind(e.target.value as "" | OrgVerificationKind)}
                      >
                        {VERIFICATION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <span className="hint">
                        {verifiedKind === ""
                          ? "The organization can apply for verification itself from its settings."
                          : "Created already verified, with no evidence round-trip. Use for partners you onboard directly (a city department, a known nonprofit)."}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sub">
                  <div className="sub-head">Audit</div>
                  <div className="sub-body">
                    <ReasonField
                      value={reason}
                      onChange={setReason}
                      error={errors.reason}
                      placeholder="Onboarded at the Council District 4 partner meeting…"
                      disabled={pending}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel-foot">
            {logoUploading && <span className="hint">Uploading the logo…</span>}
            <div className="spacer" />
            <button
              type="button"
              className="btn ghost"
              onClick={close}
              disabled={pending || logoUploading}
            >
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={pending || logoUploading}>
              <Icons.Plus size={14} /> {pending ? "Creating…" : "Create organization"}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
