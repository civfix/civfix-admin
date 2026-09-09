"use client"

import * as React from "react"
import type { AdminOrgDTO, OrgVerificationKind } from "@civfix/shared"

import { Icons } from "@/components/icons"
import {
  buildCreateRequest,
  emptyProfileDraft,
  fieldErrorsFromError,
  validateProfileDraft,
  type OrgProfileDraft,
  type OrgProfileErrors,
} from "@/features/orgs/org-form"
import { OrgProfileFields, ReasonField, FieldError } from "@/features/orgs/org-form-fields"
import { useCreateOrg } from "@/features/orgs/use-orgs"
import { UserPicker, type PickedUser } from "@/features/orgs/user-picker"
import { ORG_KIND_LABEL } from "@/features/orgs/verification-panel"

const VERIFICATION_OPTIONS: { value: "" | OrgVerificationKind; label: string }[] = [
  { value: "", label: "Leave unverified" },
  { value: "nonprofit", label: `Verified as ${ORG_KIND_LABEL.nonprofit.toLowerCase()}` },
  { value: "government", label: `Verified as ${ORG_KIND_LABEL.government.toLowerCase()}` },
  { value: "community", label: `Verified as ${ORG_KIND_LABEL.community.toLowerCase()}` },
]

/**
 * The "New organization" slide-over (`.panel`). Everything the create request needs lives here: the
 * profile fields, the owner picker (resolves a person to a userId), the verification shortcut for
 * operator-onboarded partners (DECISIONS §32) and the audit reason.
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
  const create = useCreateOrg()
  const [draft, setDraft] = React.useState<OrgProfileDraft>(emptyProfileDraft)
  const [owner, setOwner] = React.useState<PickedUser | null>(null)
  const [verifiedKind, setVerifiedKind] = React.useState<"" | OrgVerificationKind>("")
  const [reason, setReason] = React.useState("")
  const [errors, setErrors] = React.useState<OrgProfileErrors>({})
  const [submitted, setSubmitted] = React.useState(false)

  const reset = React.useCallback(() => {
    setDraft(emptyProfileDraft())
    setOwner(null)
    setVerifiedKind("")
    setReason("")
    setErrors({})
    setSubmitted(false)
    create.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const liveErrors = React.useMemo(() => {
    if (!submitted) return errors
    const next: OrgProfileErrors = { ...validateProfileDraft(draft), ...serverOnly(errors) }
    if (!owner) next.ownerUserId = "Pick the person who owns this organization."
    if (reason.trim() === "") next.reason = "A reason is required."
    return next
  }, [submitted, errors, draft, owner, reason])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const next: OrgProfileErrors = validateProfileDraft(draft)
    if (!owner) next.ownerUserId = "Pick the person who owns this organization."
    if (reason.trim() === "") next.reason = "A reason is required."
    setErrors(next)
    if (Object.keys(next).length > 0 || !owner) return
    create.mutate(
      buildCreateRequest(draft, {
        ownerUserId: owner.id,
        verifiedKind: verifiedKind === "" ? null : verifiedKind,
        reason,
      }),
      {
        onSuccess: (org) => {
          reset()
          onCreated(org)
        },
        onError: (err) => setErrors((prev) => ({ ...prev, ...fieldErrorsFromError(err) })),
      },
    )
  }

  const onDraftChange = (next: OrgProfileDraft) => {
    setDraft(next)
    // A server-side slug conflict is cleared as soon as the slug changes.
    if (next.slug !== draft.slug && errors.slug) setErrors(({ slug: _s, ...rest }) => rest)
  }

  return (
    <>
      <div className={`panel-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <aside
        className={`panel org-create-panel ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-create-title"
        aria-hidden={!open}
      >
        <form onSubmit={submit} className="org-create-form">
          <div className="panel-head">
            <div className="panel-head-titles">
              <div className="crumb">Organizations</div>
              <h2 id="org-create-title">New organization</h2>
            </div>
            <div className="spacer" />
            <button type="button" className="closebtn" onClick={onClose} aria-label="Close">
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
                      errors={liveErrors}
                      onChange={onDraftChange}
                      mode="create"
                      disabled={create.isPending}
                    />
                  </div>
                </div>
              </div>
              <div className="col">
                <div className="sub">
                  <div className="sub-head">Owner</div>
                  <div className="sub-body">
                    <div className={`field ${liveErrors.ownerUserId ? "has-error" : ""}`}>
                      <span className="lbl">
                        Owner
                        <span className="opt">an existing civfix account</span>
                      </span>
                      <UserPicker value={owner} onChange={setOwner} />
                      <FieldError text={liveErrors.ownerUserId} />
                      <span className="hint">
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
                        disabled={create.isPending}
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
                          : "Created already verified — no evidence round-trip. Use for partners you onboard directly (a city department, a known nonprofit)."}
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
                      error={liveErrors.reason}
                      placeholder="Onboarded at the Council District 4 partner meeting…"
                      disabled={create.isPending}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel-foot">
            <span className="hint">Logo upload is not available in the console yet; the owner can add one from the app.</span>
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose} disabled={create.isPending}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={create.isPending}>
              <Icons.Plus size={14} /> {create.isPending ? "Creating…" : "Create organization"}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}

/** Keep only the errors the server produced (conflict / VALIDATION.fields) when re-validating locally. */
function serverOnly(errors: OrgProfileErrors): OrgProfileErrors {
  const out: OrgProfileErrors = {}
  if (errors.slug === "This slug is already taken.") out.slug = errors.slug
  return out
}
