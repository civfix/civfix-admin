import type { KnipConfig } from "knip"

const CSS_IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g

const config: KnipConfig = {
  project: ["src/**/*.{ts,tsx,css}", "*.{ts,mjs}"],
  next: {
    config: ["next.config.mjs"],
    entry: ["src/app/**/{layout,page,not-found,error,loading}.tsx"],
  },
  vitest: {
    config: ["vitest.config.ts"],
    entry: ["src/**/*.test.{ts,tsx}", "vitest.setup.ts"],
  },
  // Knip skips any extension it cannot compile, so without this an orphaned stylesheet is never
  // reported; following @import is what keeps colors-and-type.css (reached only from admin.css) used.
  compilers: {
    css: (text: string) =>
      [...text.matchAll(CSS_IMPORT)].map(([, specifier]) => `import "${specifier}";`).join("\n"),
  },
  ignoreDependencies: [
    // Loaded by name through FlatCompat.extends("next/...") in eslint.config.mjs, which knip's ESLint
    // plugin cannot see into.
    "eslint-config-next",
  ],
}

export default config
