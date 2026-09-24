"use client"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import type { PeekItem } from "@/features/home/home-preview-rows"
import type { PreviewState } from "@/features/home/home-preview-state"
import { categoryPinSrc } from "@/lib/category"
import { INITIALS_MAX_LETTERS } from "@/lib/display"
import { useNav, type PageId } from "@/store/ui-store"

function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0] ?? "")
    .slice(0, INITIALS_MAX_LETTERS)
    .join("")
    .toUpperCase()
}

function PeekGlyph({ item }: { item: PeekItem }) {
  if (item.kind === "pin") {
    const src = item.cat ? categoryPinSrc(item.cat) : null
    return (
      <span className="peek-pin">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" />
        ) : (
          <Icons.Layers size={13} />
        )}
      </span>
    )
  }
  if (item.kind === "icon") {
    const Glyph = item.icon ?? Icons.Shield
    return (
      <span className={`peek-ico hue-${item.hue ?? "lilac"}`}>
        <Glyph size={13} />
      </span>
    )
  }
  if (item.kind === "dir") {
    return (
      <span className={`peek-dir ${item.dir}`}>
        {item.dir === "in" ? <Icons.ArrowDown size={12} /> : <Icons.ArrowUp size={12} />}
      </span>
    )
  }
  return <span className="peek-av">{initials(item.name ?? "")}</span>
}

function PreviewRow({ item, page }: { item: PeekItem; page: PageId }) {
  const nav = useNav()
  const open = () => nav(page, item.focusId)
  return (
    <button
      type="button"
      className="slr"
      onClick={open}
    >
      <PeekGlyph item={item} />
      <span className="slr-body">
        <span className="slr-title">{item.title}</span>
        <span className="slr-meta">{item.meta}</span>
      </span>
      <span className="slr-age">{item.age}</span>
      <span className="slr-arr">
        <Icons.ChevronRight size={13} />
      </span>
    </button>
  )
}

export function PreviewList({
  page,
  state,
  rows,
}: {
  page: PageId
  state: PreviewState
  rows: PeekItem[]
}) {
  if (state.isLoading) {
    return (
      <div className="stile-list">
        <LoadingState label="Loading..." />
      </div>
    )
  }
  if (state.isError) {
    return (
      <div className="stile-list">
        <ErrorState error={state.error} onRetry={state.onRetry} />
      </div>
    )
  }
  const partial = state.partialError && (
    <ErrorState
      error={state.partialError.error}
      onRetry={state.partialError.onRetry}
      title={state.partialError.title}
    />
  )
  if (rows.length === 0) {
    return (
      <div className="stile-list">
        {partial ?? <div className="slr-empty">Nothing here right now.</div>}
      </div>
    )
  }
  return (
    <div className="stile-list">
      {rows.map((item) => (
        <PreviewRow key={item.focusId} item={item} page={page} />
      ))}
      {partial}
    </div>
  )
}
