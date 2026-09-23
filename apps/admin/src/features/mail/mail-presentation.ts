import type { MailAuthVerdict, MailReplyPublication, MailStatus } from "@civfix/shared"

export const MAIL_STATUS_CLS: Record<MailStatus, string> = {
  replied: "status-ok",
  delivered: "status-ok",
  auto: "status-progress",
  opened: "status-progress",
  sent: "status-progress",
  needs_action: "status-flag",
  bounced: "status-flag",
}

export const AUTH_VERDICT_VIEW: Record<MailAuthVerdict, { cls: string; title: string }> = {
  pass: { cls: "status-ok", title: "The sender's domain passed authentication." },
  fail: {
    cls: "status-flag",
    title: "This message failed sender authentication and may be forged.",
  },
  unknown: {
    cls: "status-progress",
    title: "No authentication result was recorded for this message.",
  },
}

export const PUBLICATION_CLS: Record<MailReplyPublication, string> = {
  withheld: "status-flag",
  pending: "status-progress",
  published: "status-ok",
}

export function publicationTitle(publication: MailReplyPublication, isReport: boolean): string {
  if (publication === "withheld") return "Not posted publicly. Open the thread to review it."
  if (publication === "pending") return "Approved. It will be posted shortly."
  return isReport ? "Posted to the report chat and timeline." : "Added to the event timeline."
}
