"use client"

import * as React from "react"

interface BackdropProps<T extends HTMLElement> {
  ref: React.RefObject<T | null>
  onClick: React.MouseEventHandler<T>
}

// A press that starts in the modal (a text-selection drag, typically) and is released over the
// backdrop must not dismiss: browsers dispatch that click on the nearest common ancestor of press and
// release, which is the backdrop itself when it wraps the modal. So only a click whose press also
// started on the backdrop counts. The press is read on the window in the capture phase because a
// backdrop that is a sibling of its panel never receives a press that began inside the panel.
export function useBackdropDismiss<T extends HTMLElement = HTMLDivElement>(
  onDismiss: () => void,
): BackdropProps<T> {
  const ref = React.useRef<T>(null)
  const pressedOnBackdrop = React.useRef(false)

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      pressedOnBackdrop.current = ref.current !== null && e.target === ref.current
    }
    window.addEventListener("pointerdown", onPointerDown, true)
    return () => window.removeEventListener("pointerdown", onPointerDown, true)
  }, [])

  const onClick = (e: React.MouseEvent<T>) => {
    const dismiss = pressedOnBackdrop.current && e.target === e.currentTarget
    pressedOnBackdrop.current = false
    if (dismiss) onDismiss()
  }

  return { ref, onClick }
}

/**
 * Escape and the backdrop dismiss a modal only while it holds nothing the operator would lose; once
 * there is a draft, its close button and Cancel are the deliberate ways to discard it. Returns the
 * backdrop props. The shell yields Escape to any open modal (escape-owner.ts), so Escape here closes
 * only the modal and never navigates.
 */
export function usePristineDismiss<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  pristine: boolean,
): BackdropProps<T> {
  const dismiss = React.useCallback(() => {
    if (pristine) onClose()
  }, [pristine, onClose])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dismiss])

  return useBackdropDismiss<T>(dismiss)
}
