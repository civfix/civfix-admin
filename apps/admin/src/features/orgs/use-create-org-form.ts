"use client"

import * as React from "react"
import type { AdminOrgDTO, OrgVerificationKind } from "@civfix/shared"

import {
  buildCreateRequest,
  clearChangedFieldErrors,
  emptyProfileDraft,
  fieldErrorsFromError,
  isEmptyProfileDraft,
  validateCreateDraft,
  type OrgProfileDraft,
  type OrgProfileErrors,
} from "@/features/orgs/org-form"
import { useCreateOrg } from "@/features/orgs/use-orgs"
import type { PickedUser } from "@/features/orgs/user-picker"

export type VerifiedKindChoice = "" | OrgVerificationKind

/**
 * Local validation errors are recomputed live once the operator has tried to submit; server errors
 * (slug conflict, VALIDATION.fields) are held apart and cleared per field as that field changes, so a
 * message never outlives the value it was about.
 */
export function useCreateOrgForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (org: AdminOrgDTO) => void
}) {
  const create = useCreateOrg()
  const [draft, setDraft] = React.useState<OrgProfileDraft>(emptyProfileDraft)
  const [owner, setOwnerState] = React.useState<PickedUser | null>(null)
  const [verifiedKind, setVerifiedKind] = React.useState<VerifiedKindChoice>("")
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
    verifiedKind === "" &&
    reason === "" &&
    isEmptyProfileDraft(draft)

  const localErrors = React.useMemo(
    () => (submitted ? validateCreateDraft(draft, owner, reason) : {}),
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
    if (Object.keys(validateCreateDraft(draft, owner, reason)).length > 0 || !owner) return
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

  const changeDraft = (next: OrgProfileDraft) => {
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

  return {
    draft,
    changeDraft,
    owner,
    setOwner,
    verifiedKind,
    setVerifiedKind,
    reason,
    setReason,
    errors,
    pending,
    logoUploading,
    setLogoUploading,
    pristine,
    close,
    submit,
  }
}
