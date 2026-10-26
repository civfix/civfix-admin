#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

// civfix-admin ships under AGPL-3.0-only, so every production dependency must carry a license that can
// be combined with it. Anything not matched here fails, including licenses nobody has reviewed yet.
const ALLOWED_LICENSES = [
  /^MIT(-0)?$/i,
  /^ISC$/i,
  /^BSD-[0-9]-Clause(-.+)?$/i,
  /^0BSD$/i,
  /^Apache-2\.0$/i,
  /^CC0-1\.0$/i,
  /^CC-BY-4\.0$/i,
  /^BlueOak-1\.0\.0$/i,
  /^Python-2\.0$/i,
  /^MPL-2\.0$/i,
  /^LGPL-.+$/i,
  /^GPL-2\.0(-or-later|\+)$/i,
  /^GPL-3\.0(-only|-or-later|\+)?$/i,
  /^AGPL-3\.0(-only|-or-later|\+)?$/i,
  /^Unlicense$/i,
  /^WTFPL$/i,
  /^Zlib$/i,
]

const DENIED_LICENSES = [
  /^SSPL/i,
  /^BUSL/i,
  /^Commons[- ]Clause/i,
  /^CC-BY-NC/i,
  /^UNLICENSED$/i,
  /^UNKNOWN$/i,
]

// A package whose metadata misreports its license, accepted only while it still reports exactly the
// recorded string, so a later relicense is reviewed again. Each entry says why it is safe.
const ALLOWED_PACKAGES = {}

class LicenseSyntaxError extends Error {}

function tokenize(expression) {
  return expression.replace(/[()]/g, " $& ").trim().split(/\s+/).filter(Boolean)
}

export function parseLicenseExpression(expression) {
  const tokens = tokenize(expression)
  let index = 0
  const peek = () => tokens[index]
  const keyword = (word) => peek()?.toUpperCase() === word

  function parseOr() {
    const options = [parseAnd()]
    while (keyword("OR")) {
      index++
      options.push(parseAnd())
    }
    return options.length === 1 ? options[0] : { or: options }
  }

  function parseAnd() {
    const terms = [parseWith()]
    while (keyword("AND")) {
      index++
      terms.push(parseWith())
    }
    return terms.length === 1 ? terms[0] : { and: terms }
  }

  function parseWith() {
    const base = parseAtom()
    if (!keyword("WITH")) return base
    index++
    const exception = peek()
    if (exception === undefined || exception === "(" || exception === ")") {
      throw new LicenseSyntaxError(`missing exception after WITH in "${expression}"`)
    }
    index++
    return { with: base, exception }
  }

  function parseAtom() {
    const token = peek()
    if (token === undefined) throw new LicenseSyntaxError(`unexpected end of "${expression}"`)
    index++
    if (token === "(") {
      const inner = parseOr()
      if (peek() !== ")") throw new LicenseSyntaxError(`unbalanced parentheses in "${expression}"`)
      index++
      return inner
    }
    if (token === ")" || ["AND", "OR", "WITH"].includes(token.toUpperCase())) {
      throw new LicenseSyntaxError(`unexpected "${token}" in "${expression}"`)
    }
    return { id: token }
  }

  const tree = parseOr()
  if (index !== tokens.length) {
    throw new LicenseSyntaxError(`unexpected "${String(peek())}" in "${expression}"`)
  }
  return tree
}

const matchesAny = (patterns, id) => patterns.some((pattern) => pattern.test(id))

function evaluate(node) {
  if ("or" in node) return node.or.some(evaluate)
  if ("and" in node) return node.and.every(evaluate)
  // An exception only ever grants extra permissions, except Commons Clause, which takes them away.
  if ("with" in node) return !matchesAny(DENIED_LICENSES, node.exception) && evaluate(node.with)
  return !matchesAny(DENIED_LICENSES, node.id) && matchesAny(ALLOWED_LICENSES, node.id)
}

export function isLicenseAllowed(expression) {
  if (typeof expression !== "string" || expression.trim() === "") return false
  try {
    return evaluate(parseLicenseExpression(expression))
  } catch (error) {
    if (error instanceof LicenseSyntaxError) return false
    throw error
  }
}

export function findViolations(report, allowedPackages = ALLOWED_PACKAGES) {
  const violations = []
  for (const [license, packages] of Object.entries(report)) {
    for (const pkg of packages) {
      const reported = pkg.license ?? license
      if (isLicenseAllowed(reported)) continue
      if (Object.hasOwn(allowedPackages, pkg.name) && allowedPackages[pkg.name].license === reported) continue
      violations.push({ name: pkg.name, versions: pkg.versions, license: reported })
    }
  }
  return violations
}

function main() {
  const output = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  const violations = findViolations(JSON.parse(output))
  if (violations.length === 0) {
    console.log("check-licenses: every production dependency has an AGPL-3.0-compatible license.")
    return
  }
  console.error("check-licenses: production dependencies with a denied, unknown or unreviewed license:")
  for (const { name, versions, license } of violations) {
    console.error(`  ${name}@${versions.join(", ")}: ${license}`)
  }
  console.error(
    "Replace the dependency, or, if its real license is compatible, add it to ALLOWED_PACKAGES with the reason.",
  )
  process.exitCode = 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main()
