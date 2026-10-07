import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// ICU reads the locale once at process start, so it must be in the env before the forked workers spawn;
// worker threads would share this process's already-initialized ICU and ignore it.
process.env.TZ = "UTC"
process.env.LANG = "en_US.UTF-8"
process.env.LC_ALL = "en_US.UTF-8"

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
    projects: [
      {
        extends: true,
        test: { name: "node", environment: "node", include: ["src/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
})
