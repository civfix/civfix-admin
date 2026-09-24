"use client"

import * as React from "react"
import { MODERATION_KIND_LABELS, type ModerationListItemDTO } from "@civfix/shared"

import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { kindIcon, moderationKindLabel, priorityView } from "@/features/moderation/moderation-views"

function ModerationRow({
  item,
  selected,
  onSelect,
}: {
  item: ModerationListItemDTO
  selected: boolean
  onSelect: (id: string) => void
}) {
  const KindIcon = kindIcon(item.kind)
  const priority = priorityView(item.priority)
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
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
      <span className="prow-ico hue-lilac" title={MODERATION_KIND_LABELS[item.kind]}>
        <KindIcon size={15} />
      </span>
      <div className="body">
        <div className="top">
          <span className="title">{moderationKindLabel(item)}</span>
          <span className="ident">{item.flag}</span>
        </div>
        <div className="sub">
          <span className="strong">{item.reason}</span>
          <span className="sep">·</span>
          <span>{item.reporter}</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${priority.cls} tight`}>{priority.label}</span>
        <span className="age">{item.age}</span>
      </div>
    </div>
  )
}

export const ModerationRowMemo = React.memo(ModerationRow)
