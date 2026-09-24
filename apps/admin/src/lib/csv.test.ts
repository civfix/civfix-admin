// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"

import { downloadCsv, toCsv } from "./csv"

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

describe("downloadCsv", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // jsdom's Blob has no text(); FileReader is its supported read path.
  function readBytes(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob)
    })
  }

  function captureBlob(): { blob: () => Blob } {
    let captured: Blob | null = null
    URL.createObjectURL = vi.fn((b: Blob) => {
      captured = b
      return "blob:csv"
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    return {
      blob: () => {
        if (!captured) throw new Error("no blob was downloaded")
        return captured
      },
    }
  }

  it("declares UTF-8 and starts with a byte order mark so spreadsheet apps decode accents", async () => {
    const download = captureBlob()
    downloadCsv("jurisdictions.csv", [["Peñasco", "Bayamón"]])

    const blob = download.blob()
    expect(blob.type).toBe("text/csv;charset=utf-8")
    const bytes = await readBytes(blob)
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('"Peñasco","Bayamón"')
  })
})
