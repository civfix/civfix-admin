import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SubmitShortcutHint } from "./submit-shortcut"

afterEach(() => {
  vi.unstubAllGlobals()
})

function hintFor(userAgent: string): string | null {
  vi.stubGlobal("navigator", { ...navigator, userAgent })
  const { container } = render(<SubmitShortcutHint />)
  return container.textContent
}

describe("SubmitShortcutHint", () => {
  it.each([
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15", "⌘⏎"],
    ["Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15", "⌘⏎"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Ctrl⏎"],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36", "Ctrl⏎"],
  ])("shows the shortcut the platform uses for %s", (userAgent, glyphs) => {
    expect(hintFor(userAgent)).toBe(glyphs)
  })
})
