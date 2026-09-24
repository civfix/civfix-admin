export function getMailPreviewPresentation(outreachUnread: number) {
  return {
    lead: outreachUnread,
    unit: outreachUnread === 1 ? "unread outreach message" : "unread outreach messages",
  }
}

const MODERATION_MIX = "user reports, held media, clusters and appeals"

// Without a server-side queue total (an older API) the tile leads with a plain label, never the
// length of the two-row preview, which counts nothing.
export function getModerationPreviewPresentation(queueTotal?: number) {
  if (queueTotal === undefined) return { lead: null, unit: MODERATION_MIX }
  return { lead: queueTotal, unit: `queued — ${MODERATION_MIX}` }
}
