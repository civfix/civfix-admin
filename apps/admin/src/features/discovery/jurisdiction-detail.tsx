"use client"

import * as React from "react"
import {
  DEFAULT_FORWARD_BODY_TEMPLATE,
  DEFAULT_FORWARD_SUBJECT_TEMPLATE,
  type GetForwardTemplateDefaultResponse,
  type JurisdictionDirectoryDTO,
} from "@civfix/shared"

import {
  BoundaryPanel,
  CategoryContactsGrid,
  DefaultContactFields,
  DetailActions,
  HandleField,
  JurisdictionHeader,
  NotesPanel,
  TemplateSection,
} from "@/features/discovery/jurisdiction-detail-panels"
import { useJurisdictionEditor } from "@/features/discovery/use-jurisdiction-editor"
import { ForwardTemplateModal } from "@/features/mail/forward-template-modal"
import type { ForwardTemplatePair } from "@/features/mail/forward-template-modal-state"
import { useForwardTemplateDefault } from "@/features/mail/use-mail"
import { errorMessage } from "@/lib/error-messages"
import { useToast } from "@/store/ui-store"

function templateFallback(stored: GetForwardTemplateDefaultResponse | undefined): ForwardTemplatePair {
  if (stored && (stored.subjectTemplate !== null || stored.bodyTemplate !== null)) {
    return { subject: stored.subjectTemplate ?? "", body: stored.bodyTemplate ?? "" }
  }
  return { subject: DEFAULT_FORWARD_SUBJECT_TEMPLATE, body: DEFAULT_FORWARD_BODY_TEMPLATE }
}

export function JurisdictionDetail({ dto }: { dto: JurisdictionDirectoryDTO }) {
  const toast = useToast()
  const editor = useJurisdictionEditor(dto)
  const { patch } = editor
  const defaultTemplate = useForwardTemplateDefault()
  const [templateOpen, setTemplateOpen] = React.useState(false)

  const openTemplate = () => {
    if (defaultTemplate.isError) {
      toast(errorMessage(defaultTemplate.error), "error")
      return
    }
    setTemplateOpen(true)
  }

  return (
    <div className="rep-detail">
      <JurisdictionHeader dto={dto} />

      <div className="rep-grid">
        <div className="rep-col">
          <BoundaryPanel dto={dto} />
          <NotesPanel note={editor.note} onChange={editor.setNote} />
        </div>

        <div className="rep-col">
          <HandleField handle={editor.handle} parsed={editor.parsedHandle} onChange={editor.setHandle} />
          <DefaultContactFields
            email={editor.defaultEmail}
            formUrl={editor.formUrl}
            onEmailChange={editor.setDefaultEmail}
            onFormUrlChange={editor.setFormUrl}
          />
          <CategoryContactsGrid
            counts={dto.perCategoryCounts}
            contacts={editor.contacts}
            hasDefault={editor.hasDefault}
            missingCount={editor.missingCount}
            onChange={editor.setCategoryContact}
          />
          <TemplateSection
            hasCustomTemplate={dto.forwardSubjectTemplate !== null || dto.forwardBodyTemplate !== null}
            loading={defaultTemplate.isLoading}
            onEdit={openTemplate}
          />
        </div>
      </div>

      <DetailActions
        filledCount={editor.filledCount}
        canSave={editor.canSave}
        saveBlocked={editor.saveBlocked}
        isFlagged={editor.isFlagged}
        flagging={patch.isPending}
        onFlag={editor.toggleFlag}
        onSaveDraft={editor.saveDraft}
        onSaveAndRoute={editor.saveAndRoute}
      />

      <ForwardTemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title={`Forwarding email for ${dto.org}`}
        subtitle="Overrides the default forwarding email for this jurisdiction. Clear both fields to go back to the default."
        initial={{ subject: dto.forwardSubjectTemplate, body: dto.forwardBodyTemplate }}
        fallback={templateFallback(defaultTemplate.data)}
        fallbackLabel="default template"
        pending={patch.isPending}
        onSave={({ subject, body }) =>
          patch.mutate(
            {
              request: {
                geoid: dto.geoid,
                forwardSubjectTemplate: subject,
                forwardBodyTemplate: body,
              },
              org: dto.org,
              action: "template",
            },
            { onSuccess: () => setTemplateOpen(false) },
          )
        }
      />
    </div>
  )
}
