import type { EventPageBlock, EventPageBlockKind } from "@civfix/shared"
import { markdownToPlainText, parseMarkdownSubset } from "@civfix/shared/markdown"

const PAGE_BLOCK_LABEL: Record<EventPageBlockKind, string> = {
  hero: "Hero",
  about: "About",
  agenda: "Agenda",
  hosts: "Hosts",
  faq: "FAQ",
  location: "Location",
  sponsors: "Sponsors",
  donate: "Donate",
  registration: "Registration",
  contact: "Contact",
}

export interface PageBlockView {
  id: string
  kind: EventPageBlockKind
  label: string
  title: string | null
  lines: string[]
  links: string[]
}

function plain(source: string | null | undefined): string {
  if (source === null || source === undefined) return ""
  const trimmed = source.trim()
  if (trimmed === "") return ""
  return markdownToPlainText(parseMarkdownSubset(trimmed))
}

function pushText(lines: string[], value: string | null | undefined): void {
  const text = plain(value)
  if (text !== "") lines.push(text)
}

function pushLink(links: string[], value: string | null | undefined): void {
  if (value === null || value === undefined) return
  const trimmed = value.trim()
  if (trimmed !== "" && !links.includes(trimmed)) links.push(trimmed)
}

function blockTitle(block: EventPageBlock): string | null {
  return plain(block.kind === "hero" ? block.headline : block.title) || null
}

function collectBlockBody(block: EventPageBlock, lines: string[], links: string[]): void {
  switch (block.kind) {
    case "hero":
      pushText(lines, block.subhead)
      return
    case "about":
      pushText(lines, block.body)
      return
    case "agenda":
      for (const item of block.items) {
        const when = plain(item.time)
        const what = plain(item.title)
        lines.push(when === "" ? what : `${when} · ${what}`)
        pushText(lines, item.description)
      }
      return
    case "hosts":
      for (const entry of block.entries) {
        const role = plain(entry.role)
        lines.push(role === "" ? plain(entry.name) : `${plain(entry.name)} · ${role}`)
        pushText(lines, entry.bio)
      }
      return
    case "faq":
      for (const item of block.items) {
        lines.push(plain(item.question))
        pushText(lines, item.answer)
      }
      return
    case "location":
    case "registration":
      pushText(lines, block.note)
      return
    case "sponsors":
      for (const entry of block.entries) {
        lines.push(plain(entry.name))
        pushLink(links, entry.url)
      }
      return
    case "donate":
      pushText(lines, block.blurb)
      pushLink(links, block.url)
      return
    case "contact":
      pushText(lines, block.body)
      pushLink(links, block.replyTo)
      return
  }
}

export function pageBlockView(block: EventPageBlock): PageBlockView {
  const lines: string[] = []
  const links: string[] = []
  collectBlockBody(block, lines, links)
  return {
    id: block.id,
    kind: block.kind,
    label: PAGE_BLOCK_LABEL[block.kind],
    title: blockTitle(block),
    lines: lines.filter((line) => line !== ""),
    links,
  }
}

export function pageBlockViews(blocks: readonly EventPageBlock[]): PageBlockView[] {
  return blocks.map(pageBlockView)
}
