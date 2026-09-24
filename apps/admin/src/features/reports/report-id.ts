import { SHORT_ID_LENGTH } from "@/lib/display"

export function shortId(id: string): string {
  return `#${id.slice(0, SHORT_ID_LENGTH)}`
}
