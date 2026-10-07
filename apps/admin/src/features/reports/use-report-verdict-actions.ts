"use client"

import * as React from "react"
import type { AdminReportDTO } from "@civfix/shared"

import { confirmDialog } from "@/components/shared/dialog"
import { useRouteReport, useSetReportVerdict } from "@/features/reports/use-reports"
import { useToast } from "@/store/ui-store"

function approveBody(sendAttempted: boolean): string {
  return [
    "This approves this report's verification.",
    sendAttempted ? null : "It is not sent to the city.",
    "Once this reporter has two approved reports, their account is marked report-verified.",
  ]
    .filter((line): line is string => line !== null)
    .join(" ")
}

export function useReportVerdictControls() {
  const toast = useToast()
  const routeMutation = useRouteReport()
  const verdictMutation = useSetReportVerdict()
  const [routeOpen, setRouteOpen] = React.useState(false)
  const [routeNote, setRouteNote] = React.useState("")
  return { toast, routeMutation, verdictMutation, routeOpen, setRouteOpen, routeNote, setRouteNote }
}

export type ReportVerdictControls = ReturnType<typeof useReportVerdictControls>

export function reportVerdictActions(
  controls: ReportVerdictControls,
  report: AdminReportDTO,
  approvesOnSend: boolean,
  onApprovedChange: (approved: boolean) => void,
) {
  const { toast, routeMutation, verdictMutation, routeOpen, setRouteOpen, routeNote, setRouteNote } =
    controls
  const sendAttempted = report.outreach.routedAt !== null

  const openRoute = () => {
    setRouteNote("")
    setRouteOpen(true)
  }

  // Awaited rather than chained through per-call callbacks: those are dropped once the operator opens
  // another report (this pane remounts), which would leave a report approved but never sent.
  const routeToJurisdiction = async (note: string) => {
    const res = await routeMutation.mutateAsync({ id: report.id, ...(note ? { note } : {}) })
    setRouteOpen(false)
    setRouteNote("")
    toast(`Sent to ${res.routedTo}`)
  }

  const sendToJurisdiction = async () => {
    const contact = report.city.contact
    if (!contact || routeMutation.isPending || verdictMutation.isPending) return
    const note = routeNote.trim()
    const ok = await confirmDialog({
      title: approvesOnSend ? "Verify and send to the city?" : "Send to the city?",
      body: approvesOnSend
        ? `This approves this report's verification. It emails the report and its attached photos to ${contact}. Once this reporter has two approved reports, their account is marked report-verified.`
        : `This emails the report and its attached photos to ${contact}.`,
      confirmLabel: approvesOnSend ? "Verify and send" : "Send",
    })
    if (!ok) return
    try {
      if (approvesOnSend) {
        await verdictMutation.mutateAsync({ id: report.id, verdict: "approved" })
        onApprovedChange(true)
      }
      await routeToJurisdiction(note)
    } catch {
      // The query client already toasted the failure; a failed approve must stop before the send.
    }
  }

  const approve = async () => {
    if (verdictMutation.isPending) return
    const ok = await confirmDialog({
      title: "Approve report",
      body: approveBody(sendAttempted),
      confirmLabel: "Approve",
    })
    if (!ok) return
    verdictMutation.mutate(
      { id: report.id, verdict: "approved" },
      { onSuccess: () => onApprovedChange(true) },
    )
  }

  const reject = async () => {
    const ok = await confirmDialog({
      title: "Reject report",
      body: sendAttempted
        ? "This rejects the report's verification verdict. It was already emailed to the city, and rejecting does not recall that email."
        : "This rejects the report's verification verdict. It is not sent to the city.",
      danger: true,
      confirmLabel: "Reject",
    })
    if (!ok) return
    verdictMutation.mutate(
      { id: report.id, verdict: "rejected" },
      { onSuccess: () => onApprovedChange(false) },
    )
  }

  return {
    routeOpen,
    routeNote,
    setRouteNote,
    openRoute,
    closeRoute: () => setRouteOpen(false),
    sendToJurisdiction,
    approve,
    reject,
    routeBusy: routeMutation.isPending || verdictMutation.isPending,
    verdictPending: verdictMutation.isPending,
  }
}
