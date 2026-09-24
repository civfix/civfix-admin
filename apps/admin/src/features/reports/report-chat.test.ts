import { REACTION_EMOJIS, type AdminReportStatus, type ChatMessageDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { reactionLabel, sortChatOldestFirst, systemLabel } from "./report-chat"

function msg(over: Partial<ChatMessageDTO> & { id: string }): ChatMessageDTO {
  return {
    cleanupId: "c0c0c0c0-0000-4000-8000-00000000000c",
    from: null,
    body: null,
    kind: "system",
    createdAt: "2026-09-23T09:00:00.000Z",
    reactions: [],
    mentions: [],
    ...over,
  }
}

describe("systemLabel", () => {
  it("names the status alone when there is no detail", () => {
    expect(systemLabel(msg({ id: "a", system: { status: "acknowledged" } }))).toBe("System · Acknowledged")
  })

  it("prefers the note over the body", () => {
    expect(
      systemLabel(msg({ id: "a", system: { status: "in_progress", note: " Crew out ", body: "Body" } })),
    ).toBe("System · In progress · Crew out")
  })

  it("falls back to the message body when the system body is blank", () => {
    expect(
      systemLabel(msg({ id: "a", body: "Crew dispatched", system: { status: "acknowledged", body: "  " } })),
    ).toBe("System · Acknowledged · Crew dispatched")
  })

  it("shows a status newer than this build raw", () => {
    expect(systemLabel(msg({ id: "a", system: { status: "archived" as AdminReportStatus } }))).toBe(
      "System · archived",
    )
  })

  it("is plain System without a status", () => {
    expect(systemLabel(msg({ id: "a" }))).toBe("System")
  })
})

describe("sortChatOldestFirst", () => {
  it("orders by time, then by id for equal times, without mutating the input", () => {
    const late = msg({ id: "c", createdAt: "2026-09-23T10:00:00.000Z" })
    const tieB = msg({ id: "b", createdAt: "2026-09-23T09:00:00.000Z" })
    const tieA = msg({ id: "a", createdAt: "2026-09-23T09:00:00.000Z" })
    const input = [late, tieB, tieA]
    expect(sortChatOldestFirst(input).map((m) => m.id)).toEqual(["a", "b", "c"])
    expect(input.map((m) => m.id)).toEqual(["c", "b", "a"])
  })

  it("puts unparseable times last, ordered by id", () => {
    const bad2 = msg({ id: "y", createdAt: "not a date" })
    const bad1 = msg({ id: "x", createdAt: "also not a date" })
    const ok = msg({ id: "z", createdAt: "2026-09-23T09:00:00.000Z" })
    expect(sortChatOldestFirst([bad2, ok, bad1]).map((m) => m.id)).toEqual(["z", "x", "y"])
  })
})

describe("reactionLabel", () => {
  it("labels every reaction the contract defines", () => {
    for (const emoji of REACTION_EMOJIS) expect(reactionLabel(emoji)).not.toBe(emoji)
    expect(reactionLabel("laugh")).toBe("Laugh")
    expect(reactionLabel("sad")).toBe("Sad")
  })

  it("shows a reaction newer than this build raw", () => {
    expect(reactionLabel("rocket")).toBe("rocket")
    expect(reactionLabel("toString")).toBe("toString")
  })
})
