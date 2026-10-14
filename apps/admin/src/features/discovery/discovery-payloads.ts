import { JurisdictionHandleSchema, type ReportCategory } from "@civfix/shared"

import { REPORT_CATEGORIES } from "@/lib/category"

type ContactDraft = Readonly<Partial<Record<string, string>>>

/** Per category, how many edits the operator has made since that contact was last saved. */
export type ContactEdits = Readonly<Partial<Record<string, number>>>

// Save draft sends only the categories the operator edited since the last save, so it never overwrites
// or deletes a contact another operator changed meanwhile. The server deletes a category contact only on an
// explicit null, so an edited category that is now empty is sent as null, whatever it held at load.
export function contactsPayload(
  edits: ContactEdits,
  current: ContactDraft,
): Partial<Record<ReportCategory, string | null>> {
  const out: Partial<Record<ReportCategory, string | null>> = {}
  for (const category of REPORT_CATEGORIES) {
    if (!edits[category]) continue
    out[category] = current[category]?.trim() || null
  }
  return out
}

// Save & route confirms the routing set the operator sees, and the server checks only the request body
// for a routable contact, so every contact shown goes out, not just the edited ones.
export function routingContactsPayload(
  edits: ContactEdits,
  current: ContactDraft,
): Partial<Record<ReportCategory, string | null>> {
  const out: Partial<Record<ReportCategory, string | null>> = {}
  for (const category of REPORT_CATEGORIES) {
    const email = current[category]?.trim()
    if (email) out[category] = email
    else if (edits[category]) out[category] = null
  }
  return out
}

export function withContactEdit(edits: ContactEdits, category: string): ContactEdits {
  return { ...edits, [category]: (edits[category] ?? 0) + 1 }
}

/**
 * The edits still unsaved once a save of `sent` succeeds: an edit made while that save was in flight
 * changed the category's count, so it stays marked and goes out with the next save.
 */
export function afterContactsSaved(edits: ContactEdits, sent: ContactEdits): ContactEdits {
  const next: Partial<Record<string, number>> = {}
  for (const [category, count] of Object.entries(edits)) {
    if (count !== undefined && count !== sent[category]) next[category] = count
  }
  return next
}

export function jurisdictionFields(
  defaultEmail: string,
  formUrl: string,
): { defaultEmails?: string[]; formUrl?: string } {
  const email = defaultEmail.trim()
  const url = formUrl.trim()
  return {
    ...(email ? { defaultEmails: [email] } : {}),
    ...(url ? { formUrl: url } : {}),
  }
}

export function parseHandle(input: string): { value: string; error: string | null } {
  const parsed = JurisdictionHandleSchema.safeParse(input)
  if (parsed.success) return { value: parsed.data ?? "", error: null }
  return { value: "", error: parsed.error.issues[0]!.message }
}

export interface SavedExtras {
  notes?: string
  handle?: string
}

export function noteAndHandleFields(
  note: string,
  handle: string,
  storedHandle: string | null,
): SavedExtras {
  const trimmed = note.trim()
  return {
    ...(trimmed ? { notes: trimmed } : {}),
    ...(handle !== (storedHandle ?? "") ? { handle } : {}),
  }
}

export function partialSaveMessage(saved: SavedExtras, reason: string): string {
  const parts: string[] = []
  if (saved.notes !== undefined) parts.push("note")
  if (saved.handle !== undefined) parts.push("@handle")
  const verb = parts.length > 1 ? "were" : "was"
  return `The ${parts.join(" and ")} ${verb} saved, but the contacts were not: ${reason}`
}