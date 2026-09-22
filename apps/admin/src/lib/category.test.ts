import { existsSync } from "node:fs"

import { REPORT_CATEGORY_LABELS, ReportCategorySchema } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import {
  CATEGORY_GLYPHS,
  categoryCssVar,
  categoryLabel,
  categoryPinSrc,
} from "@/lib/category"

const PUBLIC_DIR = new URL("../../public/", import.meta.url)

const CATEGORIES = ReportCategorySchema.options

describe("category presentation", () => {
  it("covers every canonical report category with a glyph", () => {
    expect(Object.keys(CATEGORY_GLYPHS).sort()).toEqual([...CATEGORIES].sort())
    for (const category of CATEGORIES) {
      expect(CATEGORY_GLYPHS[category]).toMatch(/^M/)
    }
  })

  it("ships a pin asset for every category", () => {
    for (const category of CATEGORIES) {
      const src = categoryPinSrc(category)
      expect(src).toBe(`/ds/pin-${category}.svg`)
      expect(existsSync(new URL(`.${src}`, PUBLIC_DIR))).toBe(true)
    }
  })

  it("names a category css variable and label per category", () => {
    for (const category of CATEGORIES) {
      expect(categoryCssVar(category)).toBe(`var(--cat-${category})`)
      expect(categoryLabel(category)).toBe(REPORT_CATEGORY_LABELS[category])
    }
  })
})
