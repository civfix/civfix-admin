export function getMailPreviewPresentation(outreachUnread: number) {
  return {
    lead: outreachUnread,
    unit: outreachUnread === 1 ? "unread outreach message" : "unread outreach messages",
  }
}

/**
 * The moderation tile leads with the server-side queue total when the summary carries one. When the
 * field is absent (an older API) it leads with a plain label instead of the length of the two-row
 * preview, which is not a count of anything.
 */
const MODERATION_MIX = "user reports, held media, clusters and appeals"

export function getModerationPreviewPresentation(queueTotal?: number) {
  if (queueTotal === undefined) return { lead: null, unit: MODERATION_MIX }
  return { lead: queueTotal, unit: `queued — ${MODERATION_MIX}` }
}
