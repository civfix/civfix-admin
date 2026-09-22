import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { ESCAPE_OWNER_SELECTOR } from "@/components/shell/escape-owner"

const lightboxSource = readFileSync(new URL("./lightbox.tsx", import.meta.url), "utf8")
const dialogSource = readFileSync(new URL("./dialog.tsx", import.meta.url), "utf8")

const lightboxFrame =
  lightboxSource.match(/className="lightbox"[\s\S]{0,300}?aria-label=\{current\.alt\}/)?.[0] ?? ""

describe("modal host markup", () => {
  it("marks the lightbox frame as the modal dialog the shell yields Escape to", () => {
    expect(ESCAPE_OWNER_SELECTOR).toContain('[role="dialog"][aria-modal="true"]')
    expect(lightboxFrame).toMatch(/role="dialog"/)
    expect(lightboxFrame).toMatch(/aria-modal="true"/)
    expect(lightboxFrame).not.toMatch(/aria-hidden/)
  })

  it("traps and restores focus in both hosts through the shared helper", () => {
    for (const source of [lightboxSource, dialogSource]) {
      expect(source).toMatch(/useModalFocus<HTMLDivElement>\(/)
      expect(source).toMatch(/ref=\{(frameRef|modalRef)\}/)
    }
  })

  it("keeps an explicit outcome for a photo that fails to load", () => {
    expect(lightboxSource).toMatch(/onError=/)
    expect(lightboxSource).toMatch(/onLoad=/)
    expect(lightboxSource).toContain("Refresh photo")
  })
})
