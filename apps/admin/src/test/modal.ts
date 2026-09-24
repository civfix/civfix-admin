import { fireEvent } from "@testing-library/react"

// The backdrop is decorative (no role or name); every wrapping modal renders its dialog as the
// backdrop's only child, so the dialog is the handle on it.
export function overlayOf(dialog: HTMLElement): HTMLElement {
  const overlay = dialog.parentElement
  if (!overlay) throw new Error("dialog has no overlay")
  return overlay
}

// A press that starts inside the modal (a text-selection drag, typically) and is released over the
// backdrop. The click goes to the backdrop: that is the nearest common ancestor for a wrapping
// backdrop, and the release target for engines that dispatch there.
export function dragOutToBackdrop(inside: HTMLElement, backdrop: HTMLElement): void {
  fireEvent.pointerDown(inside)
  fireEvent.mouseDown(inside)
  fireEvent.pointerUp(backdrop)
  fireEvent.mouseUp(backdrop)
  fireEvent.click(backdrop)
}
