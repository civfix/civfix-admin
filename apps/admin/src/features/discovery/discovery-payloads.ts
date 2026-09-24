import { JurisdictionHandleSchema, type ReportCategory } from "@civfix/shared"

import { REPORT_CATEGORIES } from "@/lib/category"

type ContactDraft = Readonly<Partial<Record<string, string>>>

// The server deletes a category contact only on an explicit null, so a contact the operator emptied
// is sent as null; a category that was already blank when the form loaded stays out of the payload,
// so a Save never deletes a contact another operator added in the meantime.
export function contactsPayload(
  seed: ContactDraft,
  current: ContactDraft,
): Partial<Record<ReportCategory, string | null>> {
  const out: Partial<Record<ReportCategory, string | null>> = {}
  for (const category of REPORT_CATEGORIES) {
    const value = current[category]?.trim()
    if (value) out[category] = value
    else if (seed[category]) out[category] = null
  }
  return out
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

export function noteAndHandleFields(
  note: string,
  handle: string,
  storedHandle: string | null,
): { notes?: string; handle?: string } {
  const trimmed = note.trim()
  return {
    ...(trimmed ? { notes: trimmed } : {}),
    ...(handle !== (storedHandle ?? "") ? { handle } : {}),
  }
}

export function partialSaveMessage(
  saved: { notes?: string; handle?: string },
  reason: string,
): string {
  const parts: string[] = []
  if (saved.notes !== undefined) parts.push("note")
  if (saved.handle !== undefined) parts.push("@handle")
  const verb = parts.length > 1 ? "were" : "was"
  return `The ${parts.join(" and ")} ${verb} saved, but the contacts were not: ${reason}`
}