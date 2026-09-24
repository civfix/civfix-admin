const SHORT_ID_LENGTH = 8
const ID_DASHES = /-/g

export function shortId(id: string): string {
  return `#${id.replace(ID_DASHES, "").slice(0, SHORT_ID_LENGTH)}`
}
