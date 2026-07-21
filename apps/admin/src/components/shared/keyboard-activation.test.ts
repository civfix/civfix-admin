import { describe, expect, it } from "vitest"

import { isKeyboardActivationKey } from "./keyboard-activation"

describe("isKeyboardActivationKey", () => {
  it("accepts Enter and Space but rejects unrelated keys", () => {
    expect(isKeyboardActivationKey("Enter")).toBe(true)
    expect(isKeyboardActivationKey(" ")).toBe(true)
    expect(isKeyboardActivationKey("Spacebar")).toBe(true)
    expect(isKeyboardActivationKey("Escape")).toBe(false)
  })
})
