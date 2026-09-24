import { INITIALS_MAX_LETTERS } from "@/lib/display"

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, INITIALS_MAX_LETTERS)
    .join("")
    .toUpperCase()
}
