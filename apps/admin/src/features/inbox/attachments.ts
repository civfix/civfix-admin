const KB = 1024
const MB = KB * 1024

// Attachment links are presigned GET urls the API signs for 15 minutes (MEDIA_GET_URL_TTL_SEC), so a
// reader left open re-reads its message before the links it shows go dead.
const ATTACHMENT_URL_REFRESH_MS = 10 * 60_000

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`
  const mb = bytes / MB
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, "") : Math.round(mb)} MB`
}

export function attachmentRefreshInterval(attachmentCount: number): number | false {
  return attachmentCount > 0 ? ATTACHMENT_URL_REFRESH_MS : false
}