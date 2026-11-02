import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// ICU reads the locale once at process start, so it must be in the env before the forked workers spawn;
// worker threads would share this process's already-initialized ICU and ignore it.
process.env.TZ = "UTC"
process.env.LANG = "en_US.UTF-8"
process.env.LC_ALL = "en_US.UTF-8"

// Listed first so its afterEach runs last and also sees what other hooks' cleanup logs.
const CONSOLE_GUARD = "./vitest.console-guard.ts"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // tsconfig keeps `jsx: preserve` for Next; tests need the automatic runtime.
  esbuild: { jsx: "automatic" },
  test: {
    pool: "forks",
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts"],
      reporter: ["text-summary"],
      // The measured baseline rounded down; raise these as coverage grows, never lower them.
      thresholds: {
        lines: 89,
        functions: 86,
        branches: 83,
        statements: 87,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          setupFiles: [CONSOLE_GUARD],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: [CONSOLE_GUARD, "./vitest.setup.ts"],
        },
      },
    ],
  },
})
