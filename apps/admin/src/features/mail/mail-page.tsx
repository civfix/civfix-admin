"use client"

import * as React from "react"
import {
  DEFAULT_FORWARD_BODY_TEMPLATE,
  DEFAULT_FORWARD_SUBJECT_TEMPLATE,
  INBOX_FEED_FILTER_LABELS,
  type GetForwardTemplateDefaultResponse,
  type MailStatsResponse,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, type FilterOption } from "@/components/shared/page-primitives"
import { SearchBox } from "@/components/shared/section-list"
import { INBOX_FEED_FILTER_ORDER } from "@/features/inbox/inbox-feed"
import { ComposeModal, type ComposeInput } from "@/features/mail/compose-modal"
import { ForwardTemplateModal } from "@/features/mail/forward-template-modal"
import { MailDetailPane } from "@/features/mail/mail-detail-pane"
import { MailListPane } from "@/features/mail/mail-list-pane"
import { OUTREACH_BOXES, type MailBox } from "@/features/mail/mail-page-state"
import { MailStatsStrip } from "@/features/mail/mail-stats-strip"
import { MailboxSwitch } from "@/features/mail/mailbox-switch"
import {
  useComposeMail,
  useForwardTemplateDefault,
  useMailStats,
  useSetForwardTemplateDefault,
} from "@/features/mail/use-mail"
import { useMailbox } from "@/features/mail/use-mailbox"
import { useToast } from "@/store/ui-store"
import { errorMessage } from "@/lib/error-messages"
import type { SectionPageProps } from "@/components/shell/page-registry"

function boxOptions(outreach: boolean, stats: MailStatsResponse | undefined): FilterOption[] {
  if (!outreach) {
    return INBOX_FEED_FILTER_ORDER.map((f) => ({ value: f, label: INBOX_FEED_FILTER_LABELS[f] }))
  }
  return OUTREACH_BOXES.map(({ value, label }) =>
    value === "all" && stats ? { value, label, count: stats.threads } : { value, label },
  )
}

function MailPageHead({
  templateLoading,
  onOpenTemplate,
  onCompose,
}: {
  templateLoading: boolean
  onOpenTemplate: () => void
  onCompose: () => void
}) {
  return (
    <PageHead
      title="Mail"
      subtitle={
        <span>
          Two-way outreach with municipal contacts. The Inbox collects city replies and all other
          mail sent to civfix.
        </span>
      }
    >
      <button className="btn" disabled={templateLoading} onClick={onOpenTemplate}>
        <Icons.FileText size={13} /> Default template
      </button>
      <button className="btn primary" onClick={onCompose}>
        <Icons.Send size={13} /> Compose
      </button>
    </PageHead>
  )
}

function MailToolbar({
  outreach,
  box,
  onBoxChange,
  stats,
  query,
  onQueryChange,
}: {
  outreach: boolean
  box: MailBox
  onBoxChange: (box: MailBox) => void
  stats: MailStatsResponse | undefined
  query: string
  onQueryChange: (query: string) => void
}) {
  return (
    <div className="toolbar">
      <FilterChips
        options={boxOptions(outreach, stats)}
        value={box}
        onChange={(value) => onBoxChange(value as MailBox)}
      />
      <div className="toolbar-spacer" />
      <SearchBox
        label="Search mail"
        placeholder={outreach ? "Search org, subject, sender…" : "Search sender, subject, org…"}
        value={query}
        onChange={onQueryChange}
      />
    </div>
  )
}

function DefaultTemplateModal({
  open,
  onClose,
  template,
}: {
  open: boolean
  onClose: () => void
  template: GetForwardTemplateDefaultResponse | undefined
}) {
  const setForwardTemplate = useSetForwardTemplateDefault()
  return (
    <ForwardTemplateModal
      open={open}
      onClose={onClose}
      title="Default forwarding email"
      subtitle="Sent for every jurisdiction that has no template of its own. Clear both fields to fall back to the built-in template."
      initial={{
        subject: template?.subjectTemplate ?? null,
        body: template?.bodyTemplate ?? null,
      }}
      fallback={{
        subject: DEFAULT_FORWARD_SUBJECT_TEMPLATE,
        body: DEFAULT_FORWARD_BODY_TEMPLATE,
      }}
      fallbackLabel="built-in template"
      pending={setForwardTemplate.isPending}
      onSave={({ subject, body }) =>
        setForwardTemplate.mutate(
          { subjectTemplate: subject, bodyTemplate: body },
          { onSuccess: onClose },
        )
      }
    />
  )
}

export function MailPage({ focusId }: SectionPageProps) {
  const mailbox = useMailbox(focusId)
  const [composeOpen, setComposeOpen] = React.useState(false)
  const [templateOpen, setTemplateOpen] = React.useState(false)
  const toast = useToast()
  const compose = useComposeMail()
  const forwardTemplate = useForwardTemplateDefault()
  const statsQuery = useMailStats()
  const stats = statsQuery.data
  const { lists } = mailbox

  const openTemplate = () => {
    if (forwardTemplate.isError) {
      toast(errorMessage(forwardTemplate.error), "error")
      return
    }
    setTemplateOpen(true)
  }

  const onSend = (input: ComposeInput) => {
    compose.mutate(input, {
      onSuccess: () => {
        setComposeOpen(false)
        mailbox.openFresh("outreach")
      },
    })
  }

  return (
    <>
      <MailPageHead
        templateLoading={forwardTemplate.isLoading}
        onOpenTemplate={openTemplate}
        onCompose={() => setComposeOpen(true)}
      />

      <MailboxSwitch folder={mailbox.folder} stats={stats} onSwitch={mailbox.switchFolder} />

      {mailbox.outreach && <MailStatsStrip statsQuery={statsQuery} />}

      <MailToolbar
        outreach={mailbox.outreach}
        box={mailbox.box}
        onBoxChange={mailbox.setBox}
        stats={stats}
        query={mailbox.search.query}
        onQueryChange={mailbox.search.setQuery}
      />

      <div className="master-detail">
        <MailListPane
          outreach={mailbox.outreach}
          box={mailbox.box}
          feedFilter={mailbox.feedFilter}
          searchTerm={mailbox.search.searchTerm}
          stats={stats}
          listQuery={lists.activeListQuery}
          activeCount={lists.activeCount}
          mailItems={lists.mailItems}
          feedItems={lists.feedItems}
          selectedId={mailbox.selectedId}
          onSelect={mailbox.select}
        />
        <MailDetailPane
          outreach={mailbox.outreach}
          selectedId={mailbox.selectedId}
          selectedFeedItem={mailbox.selectedFeedItem}
        />
      </div>

      <ComposeModal
        open={composeOpen}
        pending={compose.isPending}
        onClose={() => setComposeOpen(false)}
        onSend={onSend}
      />

      <DefaultTemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        template={forwardTemplate.data}
      />
    </>
  )
}
