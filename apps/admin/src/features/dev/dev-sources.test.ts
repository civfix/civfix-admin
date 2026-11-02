import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const SRC = fileURLToPath(new URL("../..", import.meta.url))
const DEV = join(SRC, "features/dev")

const IMPORT_FROM =
  /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g

function importsOf(source: string): string[] {
  return [...source.matchAll(IMPORT_FROM)].map((m) => m[1] ?? m[2] ?? m[3] ?? "")
}

function devSources(): string[] {
  const files = readdirSync(DEV, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
  return [...files, join(SRC, "app/dev/page.tsx")]
}

describe("the developer page's sources", () => {
  it("T8: never import the admin hash router", () => {
    const files = devSources()
    expect(files.length).toBeGreaterThan(1)
    for (const file of files) {
      const imports = importsOf(readFileSync(file, "utf8"))
      const routerImports = imports.filter(
        (path) => path === "@/store/ui-store" || /(^|\/)store\/ui-store(\.tsx?|\.js)?$/.test(path),
      )
      expect(routerImports, relative(SRC, file)).toEqual([])
    }
  })
})
