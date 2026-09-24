// The prefix of a UUID shown as a short reference; one length everywhere, so the same entity reads
// the same on every surface.
const SHORT_ID_LENGTH = 8

const INITIALS_MAX_LETTERS = 2

const WHITESPACE = /\s+/

const COMPACT_COUNT_FORMAT = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

// A plain prefix, never dash-stripped: server mail subjects quote `id.slice(0, 8)`, and an operator
// matches the two by eye.
export function shortId(id: string): string {
  return id.slice(0, SHORT_ID_LENGTH)
}

export function shortRef(id: string): string {
  return `#${shortId(id)}`
}

export function firstName(name: string): string {
  const [first = ""] = name.trim().split(WHITESPACE)
  return first
}

// Code points rather than UTF-16 units, so a name that starts with an emoji keeps the whole glyph.
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(WHITESPACE)
    .filter(Boolean)
    .slice(0, INITIALS_MAX_LETTERS)
    .map((word) => [...word][0])
    .join("")
    .toUpperCase()
  return letters || "?"
}

export function formatCompactCount(value: number): string {
  return COMPACT_COUNT_FORMAT.format(value)
}
