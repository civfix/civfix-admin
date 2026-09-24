"use client"

import type { MailMessageDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { confirmDialog } from "@/components/shared/dialog"
import { usePublishMailReply } from "@/features/mail/use-mail"
import {
  PUBLISH_TOAST,
  publishConfirmBody,
  withheldNote,
  withheldReason,
} from "@/features/mail/mail-presentation"
import { useToast } from "@/store/ui-store"

export function WithheldReplyNote({
  threadId,
  msg,
  isReport,
}: {
  threadId: string
  msg: MailMessageDTO
  isReport: boolean
}) {
  const publish = usePublishMailReply()
  const toast = useToast()
  const auth = withheldReason(msg.authVerdict) === "auth"

  const onPublish = async () => {
    const ok = await confirmDialog({
      title: "Publish this reply?",
      body: publishConfirmBody(isReport),
      confirmLabel: "Publish reply",
      cancelLabel: "Cancel",
      danger: auth,
    })
    if (!ok) return
    publish.mutate(
      { id: threadId, messageId: msg.id },
      { onSuccess: (res) => toast(PUBLISH_TOAST[res.publication]) },
    )
  }

  return (
    <div className={`${auth ? "mail-bounce-note" : "mail-action-note"} mail-withheld-note`}>
      {auth ? <Icons.AlertTriangle size={14} /> : <Icons.Shield size={14} />}
      <span>{withheldNote(msg, isReport)}</span>
      <button className="btn sm primary" disabled={publish.isPending} onClick={onPublish}>
        <Icons.MessageSquare size={13} /> Publish reply
      </button>
    </div>
  )
}
