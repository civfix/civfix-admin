/**
 * Pure helpers behind the email one-time-code (OTP) entry in the operator login gate. They live apart
 * from the React component so the completion + digit-distribution logic can be unit tested without a
 * DOM. Ported verbatim from community-web (src/lib/otp.ts).
 *
 * Two shapes of input land on a cell: a single typed digit (advance one cell), or several digits at
 * once - a paste, OR a browser autofilling the whole code into the first cell (its input carries
 * autoComplete="one-time-code"). applyOtpInput handles both with one rule: strip non-digits, then write
 * the digits across the cells starting at the edited index.
 */

/** True once the gap-stripped code has exactly `length` digits, i.e. every cell is filled. */
export function isOtpComplete(code: string, length: number): boolean {
  return code.length === length
}

export interface OtpInputResult {
  /** The new full code string (0..length digits, never longer). */
  code: string
  /** Where focus should move: the last cell we wrote, or the next empty cell after it. */
  focusIndex: number
  /** True when the resulting code is complete and should be auto-submitted. */
  complete: boolean
}

/**
 * Apply `raw` text entered at cell `index` to the current `prev` code.
 *
 * - Single digit: set that one cell and advance focus by one (classic per-cell typing).
 * - Multiple digits (paste, or one-time-code autofill dumped into a single cell): distribute them
 *   across consecutive cells starting at `index`, capped at `length`.
 * - Empty / non-digit input: clears the edited cell (e.g. selecting a digit and deleting it).
 *
 * Returns the new code plus the focus target and whether the code is now complete. Pure: no refs, no
 * focus side effects - the caller moves focus and triggers verify.
 */
export function applyOtpInput(
  prev: string,
  index: number,
  raw: string,
  length: number,
): OtpInputResult {
  const digits = raw.replace(/\D/g, "")

  // Expand the previous code into a fixed array of cells so we can address any index directly.
  const cells: string[] = []
  for (let c = 0; c < length; c += 1) cells[c] = prev[c] ?? ""

  if (digits.length === 0) {
    // No usable input: clear the edited cell, leave focus where it is.
    cells[index] = ""
    const code = cells.join("").slice(0, length)
    return { code, focusIndex: index, complete: isOtpComplete(code, length) }
  }

  if (digits.length === 1) {
    // Single-digit typing: write the cell and advance one (matching the original behavior).
    cells[index] = digits
    const code = cells.join("").slice(0, length)
    const focusIndex = index < length - 1 ? index + 1 : index
    return { code, focusIndex, complete: isOtpComplete(code, length) }
  }

  // Multi-digit: distribute across cells from `index`, dropping anything past the last cell.
  let lastWritten = index
  for (let d = 0; d < digits.length && index + d < length; d += 1) {
    const cell = index + d
    cells[cell] = digits[d] as string
    lastWritten = cell
  }
  const code = cells.join("").slice(0, length)

  // Prefer the next empty cell after what we wrote; otherwise sit on the last written cell.
  let focusIndex = lastWritten
  for (let c = lastWritten + 1; c < length; c += 1) {
    if (cells[c] === "") {
      focusIndex = c
      break
    }
    focusIndex = c
  }

  return { code, focusIndex, complete: isOtpComplete(code, length) }
}
