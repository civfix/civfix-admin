"use client"

import {
  MAIL_AUTH_VERDICT_LABELS,
  MAIL_REPLY_PUBLICATION_LABELS,
  type MailAuthVerdict,
  type MailReplyPublication,
} from "@civfix/shared"

import {
  AUTH_VERDICT_VIEW,
  PUBLICATION_CLS,
  publicationTitle,
} from "@/features/mail/mail-presentation"

export function AuthVerdictBadge({ verdict }: { verdict: MailAuthVerdict | null | undefined }) {
  if (!verdict) return null
  const view = AUTH_VERDICT_VIEW[verdict]
  return (
    <span className={`pill ${view.cls} tight`} title={view.title}>
      {MAIL_AUTH_VERDICT_LABELS[verdict]}
    </span>
  )
}

export function PublicationBadge({
  publication,
  isReport,
  className = "",
}: {
  publication: MailReplyPublication | null | undefined
  isReport: boolean
  className?: string
}) {
  if (!publication) return null
  return (
    <span
      className={`pill ${PUBLICATION_CLS[publication]} tight ${className}`}
      title={publicationTitle(publication, isReport)}
    >
      {MAIL_REPLY_PUBLICATION_LABELS[publication]}
    </span>
  )
}
