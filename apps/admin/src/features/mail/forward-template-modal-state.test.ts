import { describe, expect, it } from "vitest"

import { resolveTemplateSeed, toStoredTemplate } from "./forward-template-modal-state"

const FALLBACK = { subject: "Fallback subject", body: "Fallback body" }

describe("forward template editor seed", () => {
  it("starts from the fallback when nothing is stored", () => {
    expect(resolveTemplateSeed({ subject: null, body: null }, FALLBACK)).toEqual(FALLBACK)
  })

  it("keeps the stored template when either field is set", () => {
    expect(resolveTemplateSeed({ subject: "Mine {title}", body: null }, FALLBACK)).toEqual({
      subject: "Mine {title}",
      body: "",
    })
    expect(resolveTemplateSeed({ subject: null, body: "Mine {description}" }, FALLBACK)).toEqual({
      subject: "",
      body: "Mine {description}",
    })
  })

  it("saves trimmed values and clears empty fields to inherit", () => {
    expect(toStoredTemplate("  Report {title}  ")).toBe("Report {title}")
    expect(toStoredTemplate("   ")).toBeNull()
    expect(toStoredTemplate("")).toBeNull()
  })
})
