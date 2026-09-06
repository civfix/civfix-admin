import { describe, expect, it } from "vitest"

import { toCsv } from "./csv"

describe("toCsv", () => {
  it("quotes every cell and escapes embedded quotes", () => {
    expect(toCsv([["a", 'say "hi"'], [1, 2]])).toBe('"a","say ""hi"""\n"1","2"')
  })

  it("renders null and undefined as empty cells", () => {
    expect(toCsv([[null, undefined, 0]])).toBe('"","","0"')
  })

  it("keeps blank spacer rows", () => {
    expect(toCsv([["a"], [], ["b"]])).toBe('"a"\n\n"b"')
  })

  it("neutralizes spreadsheet formulas in operator-supplied text", () => {
    expect(toCsv([["=HYPERLINK(\"http://evil\")"]])).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(toCsv([["+1+1"], ["@SUM(A1)"]])).toBe('"\'+1+1"\n"\'@SUM(A1)"')
    expect(toCsv([["-1+1 as a name"]])).toBe('"\'-1+1 as a name"')
  })

  it("leaves real negative money and numbers untouched", () => {
    expect(toCsv([["-25.05", -3, "0.00"]])).toBe('"-25.05","-3","0.00"')
  })
})
