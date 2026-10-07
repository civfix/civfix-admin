"use client"

import * as React from "react"
import type { JurisdictionDirectoryDTO } from "@civfix/shared"

import { promptDialog } from "@/components/shared/dialog"
import {
  afterContactsSaved,
  contactsPayload,
  jurisdictionFields,
  noteAndHandleFields,
  parseHandle,
  routingContactsPayload,
  withContactEdit,
  type ContactEdits,
} from "@/features/discovery/discovery-payloads"
import { REPORT_TYPES, routingCount } from "@/features/discovery/jurisdiction-view"
import { usePatchJurisdiction, useSaveJurisdictionContacts } from "@/features/discovery/use-discovery"
import { useToast } from "@/store/ui-store"

function seedContacts(dto: JurisdictionDirectoryDTO): Record<string, string> {
  const seed: Record<string, string> = {}
  for (const contact of dto.contacts) {
    if (contact.email) seed[contact.category] = contact.email
  }
  return seed
}

function isEmpty(fields: object): boolean {
  return Object.keys(fields).length === 0
}

function useJurisdictionDraft(dto: JurisdictionDirectoryDTO) {
  const [contacts, setContacts] = React.useState<Record<string, string>>(() => seedContacts(dto))
  const [contactEdits, setContactEdits] = React.useState<ContactEdits>({})
  const [note, setNote] = React.useState("")
  const [defaultEmail, setDefaultEmail] = React.useState(dto.email ?? "")
  const [formUrl, setFormUrl] = React.useState(dto.form ?? "")
  const [handle, setHandle] = React.useState(dto.handle ?? "")

  const setCategoryContact = (category: string, email: string) => {
    setContacts((prev) => ({ ...prev, [category]: email }))
    setContactEdits((prev) => withContactEdit(prev, category))
  }
  const contactsSaved = (sent: ContactEdits) =>
    setContactEdits((prev) => afterContactsSaved(prev, sent))

  const hasDefault = defaultEmail.trim() !== ""
  const filledCount = REPORT_TYPES.filter((c) => contacts[c.id]).length
  return {
    contacts,
    contactEdits,
    setCategoryContact,
    contactsSaved,
    note,
    setNote,
    defaultEmail,
    setDefaultEmail,
    formUrl,
    setFormUrl,
    handle,
    setHandle,
    parsedHandle: parseHandle(handle),
    hasDefault,
    filledCount,
    missingCount: REPORT_TYPES.filter(
      (c) => routingCount(dto.perCategoryCounts, c.id) > 0 && !contacts[c.id] && !hasDefault,
    ).length,
    canSave: filledCount > 0 || hasDefault,
  }
}

export function useJurisdictionEditor(dto: JurisdictionDirectoryDTO) {
  const toast = useToast()
  const patch = usePatchJurisdiction()
  const saveContacts = useSaveJurisdictionContacts()
  const draft = useJurisdictionDraft(dto)
  const { contacts, contactEdits, contactsSaved, note, defaultEmail, formUrl, parsedHandle, canSave } =
    draft
  const isFlagged = dto.flaggedAt !== null
  const saveBlocked = saveContacts.isPending || patch.isPending || parsedHandle.error !== null

  const toggleFlag = async () => {
    if (isFlagged) {
      patch.mutate({ request: { geoid: dto.geoid, flagged: false }, org: dto.org, action: "flag" })
      return
    }
    const reason = await promptDialog({ title: "Flag jurisdiction", label: "Reason (optional)" })
    if (reason === null) return
    patch.mutate({
      request: { geoid: dto.geoid, flagged: true, flagReason: reason || undefined },
      org: dto.org,
      action: "flag",
    })
  }

  const saveDraft = () => {
    const sentEdits = contactEdits
    const contactFields = contactsPayload(sentEdits, contacts)
    const fields = jurisdictionFields(defaultEmail, formUrl)
    const extras = noteAndHandleFields(note, parsedHandle.value, dto.handle)
    if (isEmpty(contactFields) && isEmpty(fields) && isEmpty(extras)) {
      toast("Nothing to save yet")
      return
    }
    patch.mutate(
      {
        request: { geoid: dto.geoid, contacts: contactFields, ...fields, ...extras },
        org: dto.org,
        action: "draft",
      },
      { onSuccess: () => contactsSaved(sentEdits) },
    )
  }

  const saveAndRoute = async () => {
    if (!canSave) return
    const extras = noteAndHandleFields(note, parsedHandle.value, dto.handle)
    const savesExtrasFirst = !isEmpty(extras)
    const sentEdits = contactEdits
    const saveRoutingContacts = () =>
      saveContacts.mutate(
        {
          request: {
            geoid: dto.geoid,
            contacts: routingContactsPayload(sentEdits, contacts),
            ...jurisdictionFields(defaultEmail, formUrl),
          },
          org: dto.org,
          ...(savesExtrasFirst ? { savedFirst: extras } : {}),
        },
        { onSuccess: () => contactsSaved(sentEdits) },
      )
    if (!savesExtrasFirst) {
      saveRoutingContacts()
      return
    }
    // Awaited rather than chained through a per-call callback: that is dropped once this pane unmounts,
    // which would save the note but never the contacts.
    try {
      await patch.mutateAsync({ request: { geoid: dto.geoid, ...extras }, org: dto.org, action: "extras" })
    } catch {
      // The query client already toasted the failure, and the contacts must not save without the note.
      return
    }
    saveRoutingContacts()
  }

  return { ...draft, patch, isFlagged, saveBlocked, toggleFlag, saveDraft, saveAndRoute }
}
