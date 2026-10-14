import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const SRC = fileURLToPath(new URL("..", import.meta.url))

// Main's Hours tab (#47) landed after the copy sweep; its void prompt title keeps main's wording.
const KEPT_FROM_MAIN = new Set(["features/users/user-hours-panel.tsx"])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("UI copy", () => {
  it("uses no em dash", () => {
    for (const file of sourceFiles(SRC)) {
      const name = relative(SRC, file)
      if (KEPT_FROM_MAIN.has(name)) continue
      expect(withoutComments(readFileSync(file, "utf8")), name).not.toContain("—")
    }
  })
})
