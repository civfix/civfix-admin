"use client"

import * as React from "react"
import type { MailStatsResponse } from "@civfix/contract"

import { Icons } from "@/components/icons"
import { FOLDERS, type Folder } from "@/features/mail/mail-page-state"

const FOLDER_ARROW_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

export function MailboxSwitch({
  folder,
  stats,
  onSwitch,
}: {
  folder: Folder
  stats: MailStatsResponse | undefined
  onSwitch: (next: Folder) => void
}) {
  const folderRefs = React.useRef<Record<Folder, HTMLButtonElement | null>>({
    outreach: null,
    inbox: null,
  })
  const outreach = folder === "outreach"

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = FOLDER_ARROW_STEP[e.key]
    if (!step) return
    const next = FOLDERS[(FOLDERS.indexOf(folder) + step + FOLDERS.length) % FOLDERS.length]
    if (next === undefined) return
    e.preventDefault()
    onSwitch(next)
    folderRefs.current[next]?.focus()
  }

  return (
    <div className="mailbox-switch" role="radiogroup" aria-label="Mailbox folder">
      <button
        ref={(el) => {
          folderRefs.current.outreach = el
        }}
        type="button"
        className={`mbx ${outreach ? "active" : ""}`}
        role="radio"
        aria-checked={outreach}
        tabIndex={outreach ? 0 : -1}
        onKeyDown={onKeyDown}
        onClick={() => onSwitch("outreach")}
      >
        <Icons.Mail size={13} /> Outreach
        {stats && stats.threads > 0 && <span className="mbx-c">{stats.threads}</span>}
      </button>
      <button
        ref={(el) => {
          folderRefs.current.inbox = el
        }}
        type="button"
        className={`mbx ${!outreach ? "active" : ""}`}
        role="radio"
        aria-checked={!outreach}
        tabIndex={outreach ? -1 : 0}
        onKeyDown={onKeyDown}
        onClick={() => onSwitch("inbox")}
      >
        <Icons.Inbox size={13} /> Inbox
      </button>
    </div>
  )
}
