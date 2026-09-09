/**
 * Layers that own the Escape key while they are open: the slide-over task panel, a row action menu
 * and a modal dialog. The shell's global "Escape goes home" must yield to them, otherwise pressing
 * Escape with focus on a panel button navigates away and destroys the draft. The create panel is
 * rendered only while open and the dialog host only while a dialog is up, so presence alone is the
 * signal; `aria-hidden` is excluded as a belt-and-braces for a dialog kept mounted while closed.
 * The shell must run this check in the capture phase (see app-shell.tsx): by the bubble phase the
 * layer may already have closed itself and left the DOM.
 */
export const ESCAPE_OWNER_SELECTOR =
  '.panel.open, .row-menu-pop, [role="dialog"][aria-modal="true"]:not([aria-hidden="true"])'

export function hasEscapeOwner(doc: Pick<Document, "querySelector">): boolean {
  return doc.querySelector(ESCAPE_OWNER_SELECTOR) !== null
}

/** Elements whose own Escape/keyboard handling the shell never overrides. */
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

/**
 * Whether a keydown should send the shell back home: Escape, off the home page, not inside a text
 * control, and with no open layer that owns the key.
 */
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
