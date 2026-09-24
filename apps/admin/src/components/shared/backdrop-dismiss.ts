"use client"

import * as React from "react"

interface BackdropHandlers {
  onMouseDown: React.MouseEventHandler<HTMLElement>
  onClick: React.MouseEventHandler<HTMLElement>
}

// A click is dispatched on the nearest common ancestor of its press and release, so a text selection
// dragged out of the modal lands on the backdrop. Dismiss only when the press started there too.
export function useBackdropDismiss(onDismiss: () => void): BackdropHandlers {
  const pressedOnBackdrop = React.useRef(false)
  return {
    onMouseDown: (e) => {
      pressedOnBackdrop.current = e.target === e.currentTarget
    },
    onClick: (e) => {
      const dismiss = pressedOnBackdrop.current && e.target === e.currentTarget
      pressedOnBackdrop.current = false
      if (dismiss) onDismiss()
    },
  }
}
