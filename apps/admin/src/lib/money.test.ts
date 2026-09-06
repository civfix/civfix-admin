import { describe, expect, it } from "vitest"

import { formatMoneyMinor, moneyMinorToDecimalString } from "./money"

describe("money formatting", () => {
  it("renders minor units as a currency string", () => {
    expect(formatMoneyMinor(0)).toBe("$0.00")
    expect(formatMoneyMinor(2500)).toBe("$25.00")
    expect(formatMoneyMinor(123456789)).toBe("$1,234,567.89")
  })

  it("falls back to an em dash for non-finite amounts", () => {
    expect(formatMoneyMinor(Number.NaN)).toBe("—")
  })

  it("renders an unformatted decimal string for CSV cells", () => {
    expect(moneyMinorToDecimalString(0)).toBe("0.00")
    expect(moneyMinorToDecimalString(5)).toBe("0.05")
    expect(moneyMinorToDecimalString(2500)).toBe("25.00")
    expect(moneyMinorToDecimalString(-2505)).toBe("-25.05")
  })
})
