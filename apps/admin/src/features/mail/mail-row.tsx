"use client"

import * as React from "react"
import { MAIL_STATUS_LABELS, relativeAgo, type MailThreadListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { formatPreciseDateTime } from "@/lib/dates"
import { MAIL_STATUS_CLS } from "@/features/mail/mail-presentation"

function rowCorrespondent(item: MailThreadListItemDTO): string {
  if (item.org) return item.org
  return item.dir === "in" ? item.from || "(no sender)" : item.to || "(no recipient)"
}

export const MailRow = React.memo(function MailRow({
  item,
  selected,
  onSelect,
  now,
}: {
  item: MailThreadListItemDTO
  selected: boolean
  onSelect: (id: string) => void
  now: number
}) {
  return (
    <div
      className={`mail-row ${selected ? "selected" : ""} ${item.unread ? "unread" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onSelect(item.id)
      }}
    >
      <span className={`mail-dir ${item.dir}`}>
        {item.dir === "in" ? <Icons.ArrowDown size={13} /> : <Icons.ArrowUp size={13} />}
      </span>
      <div className="mail-row-body">
        <div className="mail-row-top">
          <span className="mail-from">{rowCorrespondent(item)}</span>
          <span className="mail-ts mono" title={formatPreciseDateTime(item.ts)}>
            {relativeAgo(item.ts, now)}
          </span>
        </div>
        <div className="mail-subject">{item.subject || "(no subject)"}</div>
        <div className="mail-preview">{item.preview}</div>
      </div>
      <span className={`pill ${MAIL_STATUS_CLS[item.status]} tight mail-status-pill`}>
        {MAIL_STATUS_LABELS[item.status]}
      </span>
    </div>
  )
})
