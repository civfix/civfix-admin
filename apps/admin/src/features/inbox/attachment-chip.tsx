"use client"

import type { MailAttachment } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { formatBytes } from "@/features/inbox/attachments"
import { isWebUrl } from "@/lib/external-url"

// An attachment key comes from mail the platform received, so only an http(s) url becomes a link;
// any other scheme (javascript:, data:) or a bare storage key renders inert.
export function AttachmentChip({ attachment }: { attachment: MailAttachment }) {
  if (!isWebUrl(attachment.key)) {
    return (
      <span className="btn sm attachment-chip unlinked">
        {attachment.filename}
        <span className="attachment-meta">{formatBytes(attachment.size)}</span>
        <span className="attachment-meta">link unavailable</span>
      </span>
    )
  }
  return (
    <a
      className="btn sm attachment-chip"
      href={attachment.key}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icons.ExternalLink size={13} /> {attachment.filename}
      <span className="attachment-meta">{formatBytes(attachment.size)}</span>
    </a>
  )
}

export function AttachmentList({ attachments }: { attachments: MailAttachment[] }) {
  if (attachments.length === 0) return null
  return (
    <div className="mail-attachments">
      {attachments.map((att) => (
        <AttachmentChip key={att.key} attachment={att} />
      ))}
    </div>
  )
}
