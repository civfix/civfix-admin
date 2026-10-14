import { BYTES_PER_KB, BYTES_PER_MB } from "@/lib/bytes"
import { MINUTE_MS } from "@/lib/timing"

// Attachment links are presigned GET urls the API signs for 15 minutes (MEDIA_GET_URL_TTL_SEC), so a
// reader left open re-reads its message before the links it shows go dead.
const ATTACHMENT_URL_REFRESH_MS = 10 * MINUTE_MS

const ONE_DECIMAL_BELOW_MB = 10
const TRAILING_ZERO_DECIMAL = /\.0$/

export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`
  if (bytes < BYTES_PER_MB) return `${Math.round(bytes / BYTES_PER_KB)} KB`
  const mb = bytes / BYTES_PER_MB
  return `${mb < ONE_DECIMAL_BELOW_MB ? mb.toFixed(1).replace(TRAILING_ZERO_DECIMAL, "") : Math.round(mb)} MB`
}

export function attachmentRefreshInterval(attachmentCount: number): number | false {
  return attachmentCount > 0 ? ATTACHMENT_URL_REFRESH_MS : false
}
