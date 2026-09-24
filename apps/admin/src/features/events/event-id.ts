export function shortId(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8)}`
}
