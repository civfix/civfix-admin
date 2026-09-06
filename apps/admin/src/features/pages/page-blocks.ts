import type { EventPageBlock, EventPageBlockKind } from "@civfix/shared"
import { markdownToPlainText, parseMarkdownSubset } from "@civfix/shared/markdown"

export const PAGE_BLOCK_LABEL: Record<EventPageBlockKind, string> = {
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

export function pageBlockView(block: EventPageBlock): PageBlockView {
  const lines: string[] = []
  const links: string[] = []
  let title: string | null = null

  switch (block.kind) {
    case "hero":
      title = plain(block.headline) || null
      pushText(lines, block.subhead)
      break
    case "about":
      title = plain(block.title) || null
      pushText(lines, block.body)
      break
    case "agenda":
      title = plain(block.title) || null
      for (const item of block.items) {
        const when = plain(item.time)
        const what = plain(item.title)
        lines.push(when === "" ? what : `${when} — ${what}`)
        pushText(lines, item.description)
      }
      break
    case "hosts":
      title = plain(block.title) || null
      for (const entry of block.entries) {
        const role = plain(entry.role)
        lines.push(role === "" ? plain(entry.name) : `${plain(entry.name)} — ${role}`)
        pushText(lines, entry.bio)
      }
      break
    case "faq":
      title = plain(block.title) || null
      for (const item of block.items) {
        lines.push(plain(item.question))
        pushText(lines, item.answer)
      }
      break
    case "location":
      title = plain(block.title) || null
      pushText(lines, block.note)
      break
    case "sponsors":
      title = plain(block.title) || null
      for (const entry of block.entries) {
        lines.push(plain(entry.name))
        pushLink(links, entry.url)
      }
      break
    case "donate":
      title = plain(block.title) || null
      pushText(lines, block.blurb)
      pushLink(links, block.url)
      break
    case "registration":
      title = plain(block.title) || null
      pushText(lines, block.note)
      break
    case "contact":
      title = plain(block.title) || null
      pushText(lines, block.body)
      pushLink(links, block.replyTo)
      break
  }

  return {
    id: block.id,
    kind: block.kind,
    label: PAGE_BLOCK_LABEL[block.kind],
    title,
    lines: lines.filter((line) => line !== ""),
    links,
  }
}

export function pageBlockViews(blocks: readonly EventPageBlock[]): PageBlockView[] {
  return blocks.map(pageBlockView)
}
