/**
 * The shell's "Escape goes home" must yield to an open slide-over, row menu or modal, or Escape on a
 * panel button navigates away and destroys the draft. These layers render only while open, so presence
 * is the signal; `aria-hidden` covers a dialog kept mounted while closed. The shell must check in the
 * capture phase: by the bubble phase the layer may already have closed itself and left the DOM.
 */
export const ESCAPE_OWNER_SELECTOR =
  '.panel.open, .row-menu-pop, [role="dialog"][aria-modal="true"]:not([aria-hidden="true"])'

export function hasEscapeOwner(doc: Pick<Document, "querySelector">): boolean {
  return doc.querySelector(ESCAPE_OWNER_SELECTOR) !== null
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

export function shellEscapeGoesHome(opts: {
  key: string
  page: string
  targetTag: string | undefined
  doc: Pick<Document, "querySelector">
}): boolean {
  if (opts.key !== "Escape" || opts.page === "home") return false
  if (opts.targetTag && EDITABLE_TAGS.has(opts.targetTag)) return false
  return !hasEscapeOwner(opts.doc)
}
