"use client"

import type { AdminDevQueue } from "@civfix/contract"

import { ErrorState, LoadingState } from "@/components/shared/data-states"
import { EmptyState } from "@/components/shared/page-primitives"
import { useNow } from "@/hooks/use-now"
import { useDevConfirm } from "@/features/dev/dev-confirm"
import { Ago, NOT_SET, formatDuration } from "@/features/dev/dev-format"
import { useDevJobs, useRunDevJob } from "@/features/dev/use-dev"

const HEADERS = [
  "Queue",
  "Owner",
  "Schedule",
  "Created",
  "Retry",
  "Active",
  "Failed",
  "Failed in 24 hours",
  "Oldest waiting",
  "Last completed",
]

/** A failure or a job left waiting is what an operator opens this tab to find. */
function Count({ value, danger = false }: { value: string | number; danger?: boolean }) {
  return (
    <span role="cell" className={danger ? "mono dev-danger" : "mono"}>
      {value}
    </span>
  )
}

function QueueRow({
  queue,
  now,
  running,
  onRun,
}: {
  queue: AdminDevQueue
  now: number
  running: boolean
  onRun: (name: string) => void
}) {
  const { counts } = queue
  return (
    <div className="trow dev-jobs" role="row">
      <span role="cell" className="td-strong mono">
        {queue.name}
      </span>
      <span role="cell">{queue.owner}</span>
      <span role="cell" className="mono">
        {queue.schedule ?? NOT_SET}
      </span>
      <Count value={counts.created} />
      <Count value={counts.retry} />
      <Count value={counts.active} />
      <Count value={counts.failed} danger={counts.failed > 0} />
      <Count value={queue.failedLast24h} danger={queue.failedLast24h > 0} />
      <Count
        value={formatDuration(queue.oldestPendingSeconds)}
        danger={queue.oldestPendingSeconds > 0}
      />
      <span role="cell">
        {queue.lastCompletedAt ? <Ago value={queue.lastCompletedAt} now={now} /> : "None in 2 days"}
      </span>
      <span role="cell">
        {queue.runnable && (
          <button
            type="button"
            className="btn sm"
            disabled={running}
            onClick={() => onRun(queue.name)}
          >
            Run now
          </button>
        )}
      </span>
    </div>
  )
}

export function JobsTab() {
  const jobs = useDevJobs()
  const runJob = useRunDevJob()
  const confirm = useDevConfirm()
  const now = useNow()

  const run = async (name: string) => {
    if (await confirm({ title: `Run ${name} now?`, verb: "Run" })) runJob.mutate(name)
  }

  const failure = jobs.isError && (
    <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
  )
  if (!jobs.data) return failure || <LoadingState label="Loading queues..." />
  if (jobs.data.queues.length === 0) return <EmptyState title="No queues reported" />

  return (
    <>
      {/* A failed refresh keeps the last queues on screen under its message. */}
      {failure}
      <section className="card">
        <div className="table-scroll">
          <div className="table dev-jobs-table" role="table" aria-label="Queues">
            <div className="trow thead dev-jobs" role="row">
              {HEADERS.map((header) => (
                <span key={header} role="columnheader">
                  {header}
                </span>
              ))}
              <span role="columnheader">
                <span className="visually-hidden">Actions</span>
              </span>
            </div>
            {jobs.data.queues.map((queue) => (
              <QueueRow
                key={queue.name}
                queue={queue}
                now={now}
                running={runJob.isPending && runJob.variables === queue.name}
                onRun={(name) => void run(name)}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
