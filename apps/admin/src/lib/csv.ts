export type CsvCell = string | number | null | undefined

const FORMULA_PREFIX = /^[=+@\t\r]/
const NUMERIC = /^-?\d+(\.\d+)?$/

function guard(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ""
  if (typeof cell === "number") return String(cell)
  if (FORMULA_PREFIX.test(cell)) return `'${cell}`
  if (cell.startsWith("-") && !NUMERIC.test(cell)) return `'${cell}`
  return cell
}

export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows
    .map((row) => row.map((cell) => `"${guard(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
}

export function downloadCsv(filename: string, rows: readonly (readonly CsvCell[])[]): void {
  if (typeof document === "undefined") return
  const blob = new Blob([toCsv(rows)], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
