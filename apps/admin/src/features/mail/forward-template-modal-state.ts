export interface ForwardTemplatePair {
  subject: string
  body: string
}

export interface ForwardTemplateInitial {
  subject: string | null
  body: string | null
}

export function resolveTemplateSeed(
  initial: ForwardTemplateInitial,
  fallback: ForwardTemplatePair,
): ForwardTemplatePair {
  if (initial.subject === null && initial.body === null) return { ...fallback }
  return { subject: initial.subject ?? "", body: initial.body ?? "" }
}

export function toStoredTemplate(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}
