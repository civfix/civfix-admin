export function getMailPreviewPresentation(outreachUnread: number) {
  return {
    lead: outreachUnread,
    unit: outreachUnread === 1 ? "unread outreach message" : "unread outreach messages",
  }
}

/**
 * The moderation tile has no server-side queue total yet, so it leads with a plain label instead of the
 * length of the two-row preview, which is not a count of anything.
 */
export function getModerationPreviewPresentation() {
  return {
    lead: null,
    unit: "held media, clusters and appeals",
  }
}
