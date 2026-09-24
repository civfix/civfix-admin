import { SHORT_ID_LENGTH } from "@/lib/display"

const ID_DASHES = /-/g

export function shortId(id: string): string {
  return `#${id.replace(ID_DASHES, "").slice(0, SHORT_ID_LENGTH)}`
}
