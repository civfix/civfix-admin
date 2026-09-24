"use client"

import * as React from "react"

export const SUBMIT_KEYSHORTCUTS = "Meta+Enter Control+Enter"

const APPLE_PLATFORM_PATTERN = /Mac|iPhone|iPad|iPod/

function subscribeNever(): () => void {
  return () => {}
}

function isApplePlatform(): boolean {
  return APPLE_PLATFORM_PATTERN.test(navigator.userAgent)
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
