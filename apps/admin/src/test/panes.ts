// The master-detail panes and queue rows carry no role or accessible name, so their class hooks are
// the only locators; keeping them here means a CSS rename edits one place.
const DETAIL_PANE = ".md-detail-card"
const LIST_PANE = ".md-list"
const QUEUE_ROW = ".qrow"

function found(el: HTMLElement | null, what: string): HTMLElement {
  if (!el) throw new Error(`${what} is not rendered`)
  return el
}

export function detailCard(): HTMLElement {
  return found(document.querySelector<HTMLElement>(DETAIL_PANE), "detail pane")
}

export function listCard(): HTMLElement {
  return found(document.querySelector<HTMLElement>(LIST_PANE), "list pane")
}

export function queueRowOf(el: Element): HTMLElement {
  return found(el.closest<HTMLElement>(QUEUE_ROW), "queue row")
}
