"use client"

import * as React from "react"

export const SUBMIT_KEYSHORTCUTS = "Meta+Enter Control+Enter"

function subscribeNever(): () => void {
  return () => {}
}

function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
}

// The static export is prerendered with no navigator, so the server snapshot keeps the Mac glyphs and
// the client corrects them after hydration instead of mismatching the markup.
export function SubmitShortcutHint() {
  const apple = React.useSyncExternalStore(subscribeNever, isApplePlatform, () => true)
  return (
    <span className="kbdhint" aria-hidden="true">
      {apple ? "⌘⏎" : "Ctrl⏎"}
    </span>
  )
}
