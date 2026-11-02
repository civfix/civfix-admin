import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { FlatCompat } from "@eslint/eslintrc"
import vitest from "@vitest/eslint-plugin"
import jsxA11y from "eslint-plugin-jsx-a11y"
import reactHooks from "eslint-plugin-react-hooks"

const baseDirectory = dirname(fileURLToPath(import.meta.url))

// eslint-config-next 15.x ships only eslintrc presets; FlatCompat is the supported bridge until 16.
const compat = new FlatCompat({ baseDirectory })

const TEST_FILES = [
  "src/**/*.test.{ts,tsx}",
  "src/test/**",
  "vitest.setup.ts",
  "vitest.console-guard.ts",
]

const a11yRecommended = jsxA11y.flatConfigs.recommended.rules
const [, controlLabelOptions] = a11yRecommended["jsx-a11y/control-has-associated-label"]
// A list row's name is its title, which the shared .qrow markup nests four levels down.
const CONTROL_LABEL_DEPTH = 4

// eslint-config-next 15 depends on react-hooks v5, and which copy its preset loads is up to module
// resolution, so its plugin and rules are dropped here and the pinned v7 below is the only one.
function withoutReactHooks(entry) {
  const { plugins, rules, ...rest } = entry
  const { "react-hooks": _reactHooks, ...otherPlugins } = plugins ?? {}
  return {
    ...rest,
    ...(plugins && { plugins: otherPlugins }),
    ...(rules && {
      rules: Object.fromEntries(
        Object.entries(rules).filter(([name]) => !name.startsWith("react-hooks/")),
      ),
    }),
  }
}

const reactHooksRecommended = reactHooks.configs.flat["recommended-latest"]

const config = [
  {
    ignores: [".next/**", "out/**", "coverage/**", "next-env.d.ts"],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  ...compat.extends("next/core-web-vitals", "next/typescript").map(withoutReactHooks),
  // Every recommended rule at error, including the ones the preset ships as warnings.
  {
    plugins: reactHooksRecommended.plugins,
    rules: Object.fromEntries(
      Object.keys(reactHooksRecommended.rules).map((name) => [name, "error"]),
    ),
  },
  {
    rules: {
      // images.unoptimized is set for the static export, so next/image would render a plain <img> anyway.
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // next/core-web-vitals already registers the jsx-a11y plugin, so only its rules are taken here.
      // control-has-associated-label ships off in recommended, with the options it is meant to run under.
      ...a11yRecommended,
      "jsx-a11y/control-has-associated-label": [
        "error",
        { ...controlLabelOptions, depth: CONTROL_LABEL_DEPTH },
      ],
      // A component's autoFocus prop is checked where it lands on a DOM element.
      "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: baseDirectory,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-declaration-merging": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-unsafe-function-type": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-unary-minus": "error",
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-dynamic-delete": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
          allowNever: false,
        },
      ],
      "@typescript-eslint/only-throw-error": "error",
      // Matches only-throw-error's defaults: forwarding a caught `unknown` is not inventing a non-Error.
      "@typescript-eslint/prefer-promise-reject-errors": ["error", { allowThrowingUnknown: true }],
      "@typescript-eslint/no-base-to-string": "error",
      // Location's members are own properties ([LegacyUnforgeable]), so a spread of it keeps them.
      "@typescript-eslint/no-misused-spread": [
        "error",
        { allow: [{ from: "lib", name: "Location" }] },
      ],
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  },
  {
    files: TEST_FILES,
    plugins: { vitest },
    rules: {
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "error",
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      // The rule follows helpers declared in the same file on its own; these are the shared ones that assert.
      "vitest/expect-expect": [
        "error",
        { assertFunctionNames: ["expect", "assert", "expectConsole*", "waitForSectionPage"] },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
]

export default config
