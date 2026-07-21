export function getMailPreviewPresentation(outreachUnread: number, loadedInboxUnread: number) {
  return {
    lead: outreachUnread,
    unit: outreachUnread === 1 ? "unread outreach message" : "unread outreach messages",
    loadedInboxLabel: "Loaded catch-all unread",
    loadedInboxUnread,
  }
}

export function getModerationPreviewPresentation(shown: number) {
  return {
    lead: shown,
    unit: shown === 1 ? "loaded queue item" : "loaded queue items",
  }
}
