import { existsSync } from "node:fs"

import { REPORT_CATEGORY_LABELS, ReportCategorySchema } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import {
  CATEGORY_GLYPHS,
  REPORT_CATEGORIES,
  categoryCssVar,
  categoryLabel,
  categoryPinSrc,
  categoryReportTypes,
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

  it("derives the category list from the contract enum, in enum order", () => {
    expect(REPORT_CATEGORIES).toEqual(CATEGORIES)
  })
})

describe("category report types", () => {
  it("folds the contract report types and the web picker's finer types into one caption", () => {
    expect(categoryReportTypes("hazard")).toBe("Pavement distress")
    expect(categoryReportTypes("recycling")).toBe("Overgrown vegetation, Recycling")
    expect(categoryReportTypes("water")).toBe("Broken infrastructure, Water/leak")
  })

  it("lists at least one report type for every category", () => {
    for (const category of CATEGORIES) {
      expect(categoryReportTypes(category)).not.toBe("")
    }
  })
})
