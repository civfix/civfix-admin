"use client"

import type { ModerationItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import {
  useApproveModeration,
  useAppealModeration,
  useHoldModeration,
  useRemoveModeration,
} from "@/features/moderation/use-moderation"

const NOTE_LABEL = "Note (optional)"
const REASON_LABEL = "Reason (optional)"

type AppealDecision = "uphold" | "overturn"

// Called by the detail pane rather than the bar: the per-call onSuccess that clears the resolved item
// fires only while the hook that ran the mutation is still mounted.
export function useModerationDecisions() {
  const approve = useApproveModeration()
  const remove = useRemoveModeration()
  const hold = useHoldModeration()
  const appeal = useAppealModeration()
  const busy = approve.isPending || remove.isPending || hold.isPending || appeal.isPending
  return { approve, remove, hold, appeal, busy }
}

type ModerationDecisions = ReturnType<typeof useModerationDecisions>

function approveVerbLabel(item: Pick<ModerationItemDTO, "kind">): string {
  return item.kind === "user_report" ? "Keep" : "Approve"
}

async function askThen(title: string, label: string, decide: (text: string) => void): Promise<void> {
  const text = await promptDialog({ title, label })
  if (text === null) return
  decide(text)
}

export function ModerationDecisionBar({
  item,
  decisions,
  onResolved,
}: {
  item: ModerationItemDTO
  decisions: ModerationDecisions
  onResolved: (id: string) => void
}) {
  const { approve, remove, hold, appeal, busy } = decisions
  const approveVerb = approveVerbLabel(item)
  const clearOnSuccess = { onSuccess: () => onResolved(item.id) }

  const onApprove = () =>
    askThen(`${approveVerb} ${item.flag}`, NOTE_LABEL, (note) =>
      approve.mutate({ request: { id: item.id, ...(note ? { note } : {}) }, item }, clearOnSuccess),
    )

  const onRemove = async () => {
    const ok = await confirmDialog({
      title: `Remove ${item.flag}`,
      body: "This takes the reported content down.",
      danger: true,
      confirmLabel: "Remove",
    })
    if (!ok) return
    await askThen(`Remove ${item.flag}`, REASON_LABEL, (reason) =>
      remove.mutate({ request: { id: item.id, ...(reason ? { reason } : {}) }, item }, clearOnSuccess),
    )
  }

  const onHold = () =>
    askThen(`Hold ${item.flag} for review`, NOTE_LABEL, (note) =>
      hold.mutate({ request: { id: item.id, ...(note ? { note } : {}) }, item }, clearOnSuccess),
    )

  const onAppeal = (decision: AppealDecision) =>
    askThen(decision === "uphold" ? "Uphold action" : "Overturn action", NOTE_LABEL, (note) =>
      appeal.mutate(
        { request: { id: item.id, decision, ...(note ? { note } : {}) }, item },
        clearOnSuccess,
      ),
    )

  return (
    <div className="rep-actions">
      <span className="rep-actions-label">Decision</span>
      {item.kind === "appeal" ? (
        <>
          <button className="btn sm primary" disabled={busy} onClick={() => onAppeal("overturn")}>
            <Icons.Check size={11} /> Overturn
          </button>
          <button className="btn sm" disabled={busy} onClick={() => onAppeal("uphold")}>
            Uphold
          </button>
        </>
      ) : (
        <button className="btn sm primary" disabled={busy} onClick={onApprove}>
          <Icons.Check size={11} /> {approveVerb}
        </button>
      )}
      <button className="btn sm" disabled={busy} onClick={onHold}>
        <Icons.Clock size={11} /> Hold
      </button>
      <div className="spacer" />
      <button className="btn danger" disabled={busy} onClick={onRemove}>
        <Icons.Trash size={13} /> Remove
      </button>
    </div>
  )
}
