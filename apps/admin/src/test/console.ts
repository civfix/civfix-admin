import { format } from "node:util"

type ConsoleLevel = "error" | "warn"
type Matcher = string | RegExp

interface Expectation {
  level: ConsoleLevel
  matcher: Matcher
  matched: boolean
}

const LEVELS: readonly ConsoleLevel[] = ["error", "warn"]

let originals: Partial<Record<ConsoleLevel, Console[ConsoleLevel]>> = {}
let expectations: Expectation[] = []
let unexpected: string[] = []

function matches(matcher: Matcher, message: string): boolean {
  return typeof matcher === "string" ? message.includes(matcher) : message.search(matcher) !== -1
}

function record(level: ConsoleLevel, args: unknown[]): void {
  const message = format(...args)
  const hits = expectations.filter((e) => e.level === level && matches(e.matcher, message))
  if (hits.length === 0) {
    unexpected.push(`console.${level}: ${message}`)
    return
  }
  for (const hit of hits) hit.matched = true
}

/**
 * Declares that the current test logs a console.error containing `matcher` (a substring of the formatted
 * call, or a RegExp tested against it). Matching calls are swallowed, and the test fails if none happens.
 */
export function expectConsoleError(matcher: Matcher): void {
  expectations.push({ level: "error", matcher, matched: false })
}

export function expectConsoleWarn(matcher: Matcher): void {
  expectations.push({ level: "warn", matcher, matched: false })
}

// A plain property swap rather than vi.spyOn, so a test's own vi.restoreAllMocks() cannot remove the guard
// before its afterEach check runs.
export function startConsoleGuard(): void {
  expectations = []
  unexpected = []
  originals = {}
  for (const level of LEVELS) {
    originals[level] = console[level]
    console[level] = (...args: unknown[]) => record(level, args)
  }
}

export function stopConsoleGuard(): void {
  for (const level of LEVELS) {
    const original = originals[level]
    if (original) console[level] = original
  }
  const missing = expectations
    .filter((e) => !e.matched)
    .map((e) => `expected a console.${e.level} matching ${String(e.matcher)}, but none was logged`)
  const problems = [...unexpected, ...missing]
  expectations = []
  unexpected = []
  if (problems.length > 0) throw new Error(problems.join("\n\n"))
}
