"use client"

import type { ChatMessageDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LightboxSync, type LightboxImage } from "@/components/shared/lightbox"
import { formatPreciseDateTime } from "@/lib/dates"
import { initials } from "@/lib/display"
import { ImageThumbButton, openLightboxAt, StillThumbFace } from "@/features/reports/media-thumb"
import { reactionLabel, systemLabel } from "@/features/reports/report-chat"
import { useNav } from "@/store/ui-store"

type ChatAttachment = NonNullable<ChatMessageDTO["attachments"]>[number]

function chatAuthorName(msg: ChatMessageDTO): string {
  return msg.from?.name ?? "Removed"
}

export function ChatSystemRow({ msg }: { msg: ChatMessageDTO }) {
  return (
    <div className="dsc-msg system" title="Automated status event">
      <span className="dsc-msg-av" aria-hidden="true">
        <Icons.Clock size={13} />
      </span>
      <div className="dsc-msg-body">
        <div className="dsc-msg-top">
          <span className="dsc-msg-who">{systemLabel(msg)}</span>
          <span className="dsc-msg-when">{formatPreciseDateTime(msg.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

function MessageAuthor({
  msg,
  removed,
  authorName,
}: {
  msg: ChatMessageDTO
  removed: boolean
  authorName: string
}) {
  const nav = useNav()
  const handle = msg.from?.handle
  const authorId = msg.from?.id
  return (
    <div className="dsc-msg-top">
      {authorId && !removed ? (
        <button
          type="button"
          className="dsc-msg-who lnk-inline"
          title={`Open ${authorName}'s profile`}
          onClick={(e) => {
            e.stopPropagation()
            nav("users", authorId)
          }}
        >
          {authorName}
        </button>
      ) : (
        <span className="dsc-msg-who">{authorName}</span>
      )}
      {handle && !removed && <span className="dsc-msg-handle mono">{handle}</span>}
      {msg.from?.official && !removed && (
        <span className="pill status-ok tight" title="The official CivFix account">
          <Icons.Check size={10} /> Official
        </span>
      )}
      {msg.forwardedToCity && (
        <span className="pill status-progress tight" title="Forwarded to the routed city">
          <Icons.Send size={10} /> Forwarded to city
        </span>
      )}
      <span className="dsc-msg-when">{formatPreciseDateTime(msg.createdAt)}</span>
    </div>
  )
}

function MessageMedia({
  attachments,
  authorName,
  refreshPhotos,
}: {
  attachments: ChatAttachment[]
  authorName: string
  refreshPhotos: () => void
}) {
  const chatImages: LightboxImage[] = attachments
    .filter((m) => m.kind === "image")
    .map((m) => ({ id: m.id, url: m.url, alt: `Photo from ${authorName}` }))
  return (
    <div className="dsc-msg-media">
      <LightboxSync images={chatImages} />
      {attachments.map((m) =>
        m.kind === "image" ? (
          <ImageThumbButton
            key={m.id}
            media={m}
            onOpen={() => openLightboxAt(chatImages, m.id, refreshPhotos)}
          />
        ) : (
          <span key={m.id} className="dsc-msg-thumb">
            <StillThumbFace thumbUrl={m.thumbUrl} />
          </span>
        ),
      )}
    </div>
  )
}

function MessageFooter({
  msg,
  removed,
  removing,
  onRemove,
}: {
  msg: ChatMessageDTO
  removed: boolean
  removing: boolean
  onRemove: (msg: ChatMessageDTO) => void
}) {
  const reactions = (msg.reactions ?? []).filter((r) => r.count > 0)
  return (
    <div className="dsc-msg-foot">
      {reactions.length > 0 && (
        <span className="dsc-msg-reactions">
          {reactions.map((r) => (
            <span key={r.emoji} className={`dsc-reaction ${r.mine ? "mine" : ""}`}>
              {reactionLabel(r.emoji)} {r.count}
            </span>
          ))}
        </span>
      )}
      <div className="spacer" />
      {!removed && (
        <button
          className="btn sm danger"
          disabled={removing}
          onClick={() => onRemove(msg)}
          title="Remove this message (soft-delete; operators still see it as removed)"
        >
          <Icons.Trash size={11} /> Remove
        </button>
      )}
    </div>
  )
}

export function ChatMessageRow({
  msg,
  onRemove,
  removing,
  refreshPhotos,
}: {
  msg: ChatMessageDTO
  onRemove: (msg: ChatMessageDTO) => void
  removing: boolean
  refreshPhotos: () => void
}) {
  const removed = !!msg.deletedAt || msg.from == null
  const authorName = chatAuthorName(msg)
  const attachments = msg.attachments ?? []

  return (
    <div className={`dsc-msg ${removed ? "removed" : ""}`}>
      <span className="dsc-msg-av" aria-hidden="true">
        {removed ? <Icons.Trash size={13} /> : initials(authorName)}
      </span>
      <div className="dsc-msg-body">
        <MessageAuthor msg={msg} removed={removed} authorName={authorName} />

        {removed ? (
          <p className="dsc-msg-text tombstone">
            <Icons.EyeOff size={12} /> Message removed
            {msg.deletedAt ? ` · ${formatPreciseDateTime(msg.deletedAt)}` : ""}
          </p>
        ) : (
          <p className="dsc-msg-text">{msg.body}</p>
        )}

        {!removed && attachments.length > 0 && (
          <MessageMedia
            attachments={attachments}
            authorName={authorName}
            refreshPhotos={refreshPhotos}
          />
        )}

        <MessageFooter msg={msg} removed={removed} removing={removing} onRemove={onRemove} />
      </div>
    </div>
  )
}
