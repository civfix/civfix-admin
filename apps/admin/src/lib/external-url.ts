export function isHttpsUrl(value: string | null | undefined): value is string {
  if (value === null || value === undefined) return false
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}
