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

export function withheldReason(verdict: MailAuthVerdict | null | undefined): "auth" | "domain" {
  return verdict === "pass" ? "domain" : "auth"
}

export function domainOfAddress(address: string): string {
  return address.slice(address.lastIndexOf("@") + 1)
}

export function withheldNote(
  msg: { authVerdict?: MailAuthVerdict | null; from: string },
  isReport: boolean,
): string {
  const target = isReport ? "the report chat" : "the event timeline"
  if (withheldReason(msg.authVerdict) === "auth") {
    const check =
      msg.authVerdict === "fail" ? "failed sender authentication" : "couldn't be authenticated"
    return `This reply ${check}, so it wasn't posted to ${target}. It could be forged: confirm it with the city before publishing, or use Mark replied to leave it withheld.`
  }
  const sender = domainOfAddress(msg.from) || "an unknown sender"
  return `This reply came from ${sender}, which isn't a domain this thread was sent to, so it wasn't posted to ${target}. Publish it if it's a genuine reply from the city, or use Mark replied to leave it withheld.`
}

export function publishConfirmBody(isReport: boolean): string {
  return isReport
    ? "It will be posted in the report's public chat, the report moves to In progress if it's still open, and the reporter gets a notification. This can't be undone."
    : "It will be added to the event's timeline. This can't be undone."
}

export const PUBLISH_TOAST: Record<MailReplyPublication, string> = {
  published: "Reply published",
  pending: "Reply approved. It will be published shortly.",
  withheld: "The reply is still withheld. Please try again.",
}
