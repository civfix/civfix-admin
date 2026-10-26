"use client"

import * as React from "react"
import type { LegalDocumentType, LegalDocumentVersionDTO } from "@civfix/contract"

import { Icons } from "@/components/icons"
import { PageHead, EmptyState } from "@/components/shared/page-primitives"
import { ListStates } from "@/components/shared/section-list"
import { useLegalVersions } from "@/features/legal/use-legal"
import type { SectionPageProps } from "@/components/shell/page-registry"

const DOCUMENTS: { type: LegalDocumentType; label: string }[] = [
  { type: "terms", label: "Terms of Service" },
  { type: "privacy", label: "Privacy Policy" },
  { type: "cookies", label: "Cookie Policy" },
  { type: "subprocessors", label: "Subprocessors" },
]

// Versions published before change notes existed carry no flag or summary (DECISIONS §66): neither
// "Material" nor "Notice only" is true of them, so they say so instead of guessing.
const UNFLAGGED_NOTE = "Published before change notes were kept"

function newestFirst(a: LegalDocumentVersionDTO, b: LegalDocumentVersionDTO): number {
  return new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime()
}

function VersionRow({ doc }: { doc: LegalDocumentVersionDTO }) {
  const { acceptedCount, activeAccounts } = doc
  return (
    <div className="qrow static">
      <div className="leading">
        <span className="prow-ico hue-slate">
          <Icons.Layers size={15} />
        </span>
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{doc.version}</span>
          {doc.material === true && <span className="pill attention tight">Material</span>}
          {doc.material === false && <span className="pill priority-low tight">Notice only</span>}
        </div>
        <div className="sub">
          {doc.summary ? <span>{doc.summary}</span> : <span className="muted">{UNFLAGGED_NOTE}</span>}
        </div>
      </div>
      <div className="trailing">
        {acceptedCount != null && activeAccounts != null && (
          <span className="age">
            {acceptedCount.toLocaleString()} of {activeAccounts.toLocaleString()} accounts accepted
          </span>
        )}
      </div>
    </div>
  )
}

function DocumentCard({ label, versions }: { label: string; versions: LegalDocumentVersionDTO[] }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>{label}</h3>
        <div className="spacer" />
        <span className="meta">
          {versions.length} {versions.length === 1 ? "version" : "versions"}
        </span>
      </div>
      <div className="queue-list">
        {versions.length === 0 ? (
          <EmptyState title="No versions published" icon={<Icons.Layers size={20} />} />
        ) : (
          versions.map((doc) => <VersionRow key={doc.version} doc={doc} />)
        )}
      </div>
    </section>
  )
}

export function LegalPage(_props: SectionPageProps) {
  const query = useLegalVersions()
  const byType = React.useMemo(() => {
    const docs = query.data?.documents ?? []
    return DOCUMENTS.map(({ type, label }) => ({
      type,
      label,
      versions: docs.filter((doc) => doc.type === type).sort(newestFirst),
    }))
  }, [query.data])

  return (
    <>
      <PageHead
        title="Legal"
        subtitle={
          <span>
            Every published version of each legal document, newest first, and how many active accounts
            accepted the current Terms and Privacy Policy.
          </span>
        }
      />

      <ListStates
        query={query}
        loadingLabel="Loading legal documents..."
        isEmpty={query.data?.documents.length === 0}
        empty={
          <section className="card">
            <EmptyState
              title="No legal documents"
              sub="The API returned no published versions."
              icon={<Icons.Layers size={20} />}
            />
          </section>
        }
      >
        {byType.map((doc) => (
          <DocumentCard key={doc.type} label={doc.label} versions={doc.versions} />
        ))}
      </ListStates>
    </>
  )
}
