import { describe, expect, it } from "vitest"

import { firstName, formatCompactCount, initials, shortId, shortRef } from "./display"

describe("initials", () => {
  it.each([
    ["Ada Lovelace", "AL"],
    ["Mary Ann Smith", "MA"],
    ["ada", "A"],
    ["Ada  Lovelace", "AL"],
    ["  Ada Lovelace ", "AL"],
    ["Élodie Ñúñez", "ÉÑ"],
  ])("takes the first letter of up to two words of %j", (name, expected) => {
    expect(initials(name)).toBe(expected)
  })

  it("keeps a leading emoji whole instead of splitting its surrogate pair", () => {
    expect(initials("😀 Smile")).toBe("😀S")
  })

  it.each(["", "   "])("falls back to a question mark for the blank name %j", (name) => {
    expect(initials(name)).toBe("?")
  })
})

describe("firstName", () => {
  it.each([
    ["Ada Lovelace", "Ada"],
    ["Ada", "Ada"],
    [" Ada Lovelace", "Ada"],
    ["", ""],
  ])("reads %j as %j", (name, expected) => {
    expect(firstName(name)).toBe(expected)
  })
})

describe("short ids", () => {
  const uuid = "3f2b8c1e-9a4d-4c2e-8f1a-0b1c2d3e4f5a"

  it("shows the first eight characters, as server mail subjects quote them", () => {
    expect(shortId(uuid)).toBe("3f2b8c1e")
    expect(shortRef(uuid)).toBe("#3f2b8c1e")
  })

  it("keeps a short id whole", () => {
    expect(shortRef("0f3e")).toBe("#0f3e")
  })
})

describe("formatCompactCount", () => {
  it.each([
    [0, "0"],
    [950, "950"],
    [1_000, "1K"],
    [1_250, "1.3K"],
    [9_950, "10K"],
    [138_699, "138.7K"],
    [3_900_000, "3.9M"],
  ])("formats %d as %j", (value, expected) => {
    expect(formatCompactCount(value)).toBe(expected)
  })
})
